import { describe, expect, it } from 'vitest'
import { ANIMALS, WORD_LISTS } from './lexicon'
import { matchClosedSet, tokens } from './match'
import { scoreTask } from './score'
import { DEFAULT_PARAMS, evaluate, expectedPractice, type Check } from './change'

const rowsOf = (words: string[]) => words.map((w) => [w])

describe('matcher', () => {
  it('counts an animal once however often it is said', () => {
    const found = matchClosedSet('dog dog a dog and dogs', ANIMALS.en, 'en')
    expect(found.size).toBe(1)
  })
  it('counts forms of one animal once', () => {
    expect(matchClosedSet('camel dromedary', ANIMALS.en, 'en').size).toBe(1)
    expect(matchClosedSet('جمل ناقة بعير', ANIMALS.ar, 'ar').size).toBe(1)
  })
  it('prefers the longest form', () => {
    const found = [...matchClosedSet('polar bear', ANIMALS.en, 'en')].map((i) => ANIMALS.en[i][0])
    expect(found).toEqual(['polar bear'])
  })
  it('ignores words outside the set', () => {
    expect(matchClosedSet('um well a table and a chair', ANIMALS.en, 'en').size).toBe(0)
  })
  it('handles plurals and punctuation', () => {
    expect(matchClosedSet('Horses, foxes; butterflies!', ANIMALS.en, 'en').size).toBe(3)
  })
  it('folds Arabic article, diacritics and alef forms', () => {
    expect(tokens('الأَسَد', 'ar')).toEqual(tokens('اسد', 'ar'))
    expect(matchClosedSet('الأسد والفيل', ANIMALS.ar, 'ar').size).toBeGreaterThanOrEqual(1)
  })
  it('returns nothing for silence', () => {
    expect(matchClosedSet('', ANIMALS.en, 'en').size).toBe(0)
  })
  it('has no word shared between a list and the animal set', () => {
    for (const lang of ['en', 'ar'] as const)
      for (const list of WORD_LISTS[lang]) expect(matchClosedSet(list.join(' '), ANIMALS[lang], lang).size).toBe(0)
  })
  it('has no duplicate form across animal rows', () => {
    for (const lang of ['en', 'ar'] as const) {
      const seen = new Map<string, number>()
      ANIMALS[lang].forEach((row, i) => row.forEach((f) => {
        const k = tokens(f, lang).join(' ')
        expect(seen.has(k) && seen.get(k) !== i, `${f} appears in two rows`).toBe(false)
        seen.set(k, i)
      }))
    }
  })
})

describe('range scoring', () => {
  const list = rowsOf(WORD_LISTS.en[0])
  it('gives a zero-width range when recognisers agree', () => {
    const s = scoreTask({ a: 'river candle doctor', b: 'doctor river candle' }, list, 'en')
    expect([s.low, s.high, s.scored]).toEqual([3, 3, true])
  })
  it('marks a word heard by one recogniser and widens the range', () => {
    const s = scoreTask({ a: 'river candle doctor window', b: 'river candle' }, list, 'en')
    expect([s.low, s.high]).toEqual([2, 4])
    expect(s.items.filter((i) => i.heard === 'one').map((i) => i.label)).toEqual(['doctor', 'window'])
  })
  it('refuses to score when the recognisers disagree on too much', () => {
    const s = scoreTask({ a: 'river candle doctor window garden pencil bridge', b: 'river' }, list, 'en')
    expect(s.scored).toBe(false)
  })
  it('never invents a word neither recogniser heard', () => {
    const s = scoreTask({ a: 'river', b: 'candle' }, list, 'en')
    expect(s.items.map((i) => i.label).sort()).toEqual(['candle', 'river'])
    expect(s.low).toBe(0)
  })
  it('scores silence as zero, not as an error', () => {
    const s = scoreTask({ a: '', b: '' }, list, 'en')
    expect([s.low, s.high, s.scored]).toEqual([0, 0, true])
  })
})

const flat = (scores: (number | null)[], off: number[] = []): Check[] =>
  scores.map((v, i) => ({ date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-01`, low: v, high: v, offDay: off.includes(i) }))

describe('change rule', () => {
  const p = { ...DEFAULT_PARAMS, practiceGain: 0 }
  it('needs three scored checks before it judges anything', () => {
    const t = evaluate(flat([30, 31]), p)
    expect(t.baseline).toBeNull()
    expect(t.status).toBe('building-baseline')
  })
  it('uses the mean of the first three scored checks as baseline', () => {
    const t = evaluate(flat([30, null, 33, 36, 33]), p)
    expect(t.baseline).toBe(33)
    expect(t.baselineChecks).toEqual([0, 2, 3])
  })
  it('stays in the usual range for a stable person', () => {
    expect(evaluate(flat([30, 31, 29, 30, 31, 29, 30]), p).status).toBe('usual-range')
  })
  it('does not flag one low check', () => {
    const t = evaluate(flat([30, 30, 30, 22, 30]), p)
    expect(t.results[3].status).toBe('watch')
    expect(t.status).toBe('usual-range')
  })
  it('flags a drop that persists across two checks', () => {
    const t = evaluate(flat([30, 30, 30, 22, 22]), p)
    expect(t.results[4].status).toBe('flag')
  })
  it('does not let a missed check break or fake persistence', () => {
    const t = evaluate(flat([30, 30, 30, 22, null, 22]), p)
    expect(t.results[4].scored).toBe(false)
    expect(t.results[5].status).toBe('flag')
  })
  it('does not count an off day towards a flag', () => {
    const t = evaluate(flat([30, 30, 30, 22, 22], [3]), p)
    expect(t.results[4].status).toBe('watch')
  })
  it('asks for urgent assessment on a very large fall since the last check', () => {
    expect(evaluate(flat([30, 30, 30, 8]), p).status).toBe('urgent')
  })
  it('sends a slow decline through the routine flag, never the urgent route', () => {
    const s = evaluate(flat([30, 30, 30, 26, 22, 18, 14, 10]), p).results.map((r) => r.status)
    expect(s).toContain('flag')
    expect(s).not.toContain('urgent')
  })
  it('never flags an improvement', () => {
    expect(evaluate(flat([30, 30, 30, 40, 41]), p).status).toBe('usual-range')
  })
  it('widens the error when the recognisers gave a range', () => {
    const exact = evaluate([...flat([30, 30, 30]), { date: 'x', low: 24, high: 24 }], p).results[3]
    const wide = evaluate([...flat([30, 30, 30]), { date: 'x', low: 20, high: 28 }], p).results[3]
    expect(wide.sd as number).toBeGreaterThan(exact.sd as number)
    expect(Math.abs(wide.z as number)).toBeLessThan(Math.abs(exact.z as number))
  })
  it('takes the expected practice gain off later checks', () => {
    const q = { ...DEFAULT_PARAMS, practiceGain: 3, practiceTau: 1 }
    expect(expectedPractice(1, q)).toBe(0)
    const noGain = evaluate(flat([30, 30, 30, 30]), { ...q, practiceGain: 0 }).results[3].change as number
    const withGain = evaluate(flat([30, 30, 30, 30]), q).results[3].change as number
    expect(withGain).toBeLessThan(noGain)
  })
  it('gives a probability of one half when the score equals baseline', () => {
    expect(evaluate(flat([30, 30, 30, 30]), p).results[3].pBelow as number).toBeCloseTo(0.5, 6)
  })
  it('is deterministic', () => {
    const c = flat([31, 29, 33, 27, 25, null, 24])
    expect(JSON.stringify(evaluate(c))).toBe(JSON.stringify(evaluate(c)))
  })
})
