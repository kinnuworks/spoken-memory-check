import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, PREVIOUS_PARAMS, TWO_IN_A_ROW_ONLY, evaluate, trendLine, type Check } from './change'
import { scoreTask } from './score'
import { treatableContributors, riskFactors } from './packet'
import type { ScreeningRecord } from './histories'
import { isCorrect, loadHearing, triplet } from './din'
import { pickForReview } from './rescore'

// Exact boundaries of each cut-off: a score right on the line counts, as the rule says.
const P = { ...DEFAULT_PARAMS, practiceGain: 0 }
const at = (i: number, v: number | null, extra: Partial<Check> = {}): Check => ({ date: `d${String(i).padStart(2, '0')}`, low: v, high: v, ...extra })
const base = [at(0, 33), at(1, 33), at(2, 33)]

describe('cut-offs are inclusive', () => {
  it('a check exactly on the flag line counts as low', () => {
    const z = evaluate([...base, at(3, 30)], { ...P, flagZ: -Infinity }).results[3].z as number
    expect(evaluate([...base, at(3, 30)], { ...P, flagZ: z }).results[3].status).toBe('watch')
    expect(evaluate([...base, at(3, 30)], { ...P, flagZ: z - 1e-9 }).results[3].status).toBe('usual-range')
  })

  it('a fall exactly on the urgent line is urgent', () => {
    const fall = (25 - 33) / (P.sem * Math.SQRT2)
    expect(evaluate([...base, at(3, 33), at(4, 25)], { ...P, urgentZ: fall, flagZ: -1 }).results[4].status).toBe('urgent')
    expect(evaluate([...base, at(3, 33), at(4, 25)], { ...P, urgentZ: fall - 1e-9, flagZ: -1 }).results[4].status).toBe('watch')
  })

  it('two checks whose average sits exactly on the two-check line raise a flag', () => {
    const two = [...base, at(3, 27), at(4, 26)]
    const pz = evaluate(two, { ...P, pairZ: -Infinity }).results[4].pairZ as number
    expect(evaluate(two, { ...P, pairZ: pz }).results[4].status).toBe('flag')
    expect(evaluate(two, { ...P, pairZ: pz - 1e-9 }).results[4].status).not.toBe('flag')
  })

  it('the two-check test counts each check, the ranges and the shared baseline error', () => {
    const exact = evaluate([...base, at(3, 27), at(4, 26)], P).results[4]
    const sem = P.sem
    expect(exact.pairZ as number).toBeCloseTo(((-6 + -7) / 2) / Math.sqrt(sem ** 2 / 2 + sem ** 2 / 3), 9)
    // Ranges of 6 and 8 points add 6² / 12 and 8² / 12, each weighted by a quarter in the average.
    const ranged = evaluate([...base, { date: 'd03', low: 24, high: 30 }, { date: 'd04', low: 22, high: 30 }], P).results[4]
    expect(ranged.pairZ as number).toBeCloseTo(((-6 + -7) / 2) / Math.sqrt(sem ** 2 / 2 + (36 / 12 + 64 / 12) / 4 + sem ** 2 / 3), 9)
  })

  it('names the two-check route in plain words, and the older rule its own way', () => {
    const two = [...base, at(3, 22), at(4, 22)]
    expect(evaluate(two, P).results[4].note).toMatch(/^Lower than usual across the last two checks together/)
    expect(evaluate(two, { ...PREVIOUS_PARAMS, practiceGain: 0 }).results[4].note).toMatch(/^Lower than usual on two checks in a row/)
  })

  it('with the older rule, the first check after the baseline cannot be the second low check', () => {
    expect(evaluate([...base, at(3, 22)], { ...PREVIOUS_PARAMS, practiceGain: 0 }).results[3].status).toBe('watch')
  })

  it('a large fall to a score that is not low is not urgent', () => {
    // From far above the baseline back to it: a big drop, but nothing is below the usual range.
    expect(evaluate([...base, at(3, 60), at(4, 33)], P).results[4].status).toBe('usual-range')
  })

  it('a trend exactly on the trend line counts', () => {
    const slow = Array.from({ length: 12 }, (_, i) => at(i, i < 3 ? 33 : 33 - 0.9 * (i - 2)))
    const loose = evaluate(slow, { ...P, trendZ: Infinity, trendRuns: 1, flagZ: -Infinity, urgentZ: -Infinity })
    const k = loose.results.findIndex((r) => r.slopeZ !== null)
    const z = loose.results[k].slopeZ as number
    expect(evaluate(slow, { ...P, trendZ: z, trendRuns: 1, flagZ: -Infinity, urgentZ: -Infinity }).results[k].status).toBe('trend')
    expect(evaluate(slow, { ...P, trendZ: z - 1e-9, trendRuns: 1, flagZ: -Infinity, urgentZ: -Infinity }).results[k].status).not.toBe('trend')
  })
})

describe('the two routes together', () => {
  const steep = Array.from({ length: 14 }, (_, i) => at(i, i < 3 ? 33 : 33 - 2.2 * (i - 2)))

  it('never replaces a flag or an urgent result with the slow-decline route', () => {
    const ours = evaluate(steep).results, older = evaluate(steep, TWO_IN_A_ROW_ONLY).results
    const both = older.filter((r) => r.status === 'flag' || r.status === 'urgent').map((r) => r.index)
    expect(both.length).toBeGreaterThan(0)
    expect(ours.some((r) => r.slopeZ !== null && r.slopeZ <= DEFAULT_PARAMS.trendZ && both.includes(r.index))).toBe(true)
    for (const i of both) expect(ours[i].status).toBe(older[i].status)
  })

  it('says when the line is falling but has not held for long enough (when a run of two is asked for)', () => {
    const slow = Array.from({ length: 14 }, (_, i) => at(i, i < 3 ? 33 : 33 - 1.4 * (i - 2)))
    const r = evaluate(slow, PREVIOUS_PARAMS).results
    expect(r.some((x) => x.status === 'usual-range' && /line through all checks is falling/.test(x.note))).toBe(true)
  })

  it('reports the slope once there are enough checks, and not before', () => {
    const r = evaluate(steep).results
    expect(r[DEFAULT_PARAMS.trendMinChecks - 2].slope).toBeNull()
    expect(r[DEFAULT_PARAMS.trendMinChecks - 1].slope).toBeLessThan(0)
    expect(r[DEFAULT_PARAMS.trendMinChecks - 1].slopeSd).toBeGreaterThan(0)
  })

  it('fits a line through exactly three points', () => {
    expect(trendLine([0, 1, 2].map((x) => ({ x, y: -x, v: 1 })))?.slope).toBeCloseTo(-1)
  })

  it('counts a check with only the high end as not scored', () => {
    expect(evaluate([...base, { date: 'x', low: null, high: 30 }]).results[3].scored).toBe(false)
  })

  it('numbers the baseline checks 1, 2 and 3', () => {
    expect(evaluate(base).results.map((r) => r.note)).toEqual(['Baseline check 1 of 3.', 'Baseline check 2 of 3.', 'Baseline check 3 of 3.'])
  })
})

describe('scoring with one listener', () => {
  it('has no range: every word heard counts', () => {
    const s = scoreTask({ A: 'cat dog' }, [['cat'], ['dog'], ['cow']], 'en')
    expect(s.items.map((i) => i.heard)).toEqual(['both', 'both'])
    expect([s.low, s.high]).toEqual([2, 2])
  })
})

const record: ScreeningRecord = {
  age: 62, sex: 'F', mocaAtVisit: 27, hba1c: 5.6, onMetformin: false, systolic: 128, ldl: 2.9, bmi: 26,
  smoker: false, hearing: 'normal', vision: 'normal', phq9: 3, activeMinutesWeek: 150, schoolingYears: 12,
  familyDementia: { relative: 'none' }, apoeE4Copies: null,
}

describe('packet boundaries', () => {
  it('counts 150 active minutes a week as active', () => {
    expect(riskFactors(record).find((f) => f.name === 'Physical inactivity')?.present).toBe(false)
  })

  it('suggests B12 without naming metformin when the person is not on it', () => {
    const b12 = treatableContributors(record)[0]
    expect(b12.why).toBe('Not measured at the screening visit.')
    expect(b12.inScreening).toBe(false)
    expect(treatableContributors({ ...record, onMetformin: true })[0].inScreening).toBe(false)
  })

  it('says sleep apnoea is not measured at the screening visit', () => {
    expect(treatableContributors({ ...record, bmi: 31 }).find((c) => c.name === 'Sleep apnoea')?.inScreening).toBe(false)
  })
})

describe('hearing check details', () => {
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage })

  it('takes the digit at the drawn position', () => {
    expect(triplet(() => 0.99)).toEqual([9, 8, 6])
    expect(triplet(() => 0)).toEqual([1, 2, 3])
  })

  it('marks an answer with an extra digit wrong', () => {
    expect(isCorrect([1, 2, 3], [1, 2, 3, 4])).toBe(false)
  })

  it('starts empty when stored results are unreadable', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = { getItem: () => '{bad', setItem: () => {} } as unknown as Storage
    expect(loadHearing()).toEqual([])
  })
})

describe('picking checks for blind re-scoring', () => {
  it('uses the stated hash on every character of the id', () => {
    const fnv = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0 } return h }
    for (let i = 0; i < 300; i++) expect(pickForReview(`c-${i}`)).toBe(fnv(`c-${i}`) % 10 === 0)
  })
})
