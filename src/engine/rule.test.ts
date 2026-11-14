import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, PACKET_STATUSES, STATUS_LABEL, TREND_PACKET_NOTE, evaluate, expectedPractice, trendLine, type Check } from './change'
import { MAX_RANGE_SHARE, scoreTask } from './score'

// Edge cases of the rule of record, written so that a small change to the rule makes a test fail.
const P = DEFAULT_PARAMS
const at = (i: number, v: number | null, extra: Partial<Check> = {}): Check => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, low: v, high: v, ...extra })
const base = [at(0, 33), at(1, 33), at(2, 33)]
// A score that sits clearly below the flag line once the practice gain is allowed for.
const LOW = 20

describe('normal probability behind "chance below baseline"', () => {
  it('matches known values on both sides of zero', () => {
    for (const z of [-2.5, -1.645, -1, -0.3, 0.3, 1, 1.645, 2.5]) {
      const sd = Math.sqrt(P.sem ** 2 + (P.sem ** 2 * 3) / 9)
      const basePractice = [1, 2, 3].reduce((s, n) => s + expectedPractice(n, P), 0) / 3
      const v = 33 + (expectedPractice(4, P) - basePractice) + z * sd
      const r = evaluate([...base, at(3, v)]).results[3]
      expect(r.z).toBeCloseTo(z, 6)
      expect(r.pBelow).toBeCloseTo(0.5 * (1 - erf(z / Math.SQRT2)), 5)
    }
  })
})

/** Reference erf from a different series, to check the rule's own approximation. */
function erf(x: number): number {
  let sum = 0, term = x
  for (let n = 0; n < 200; n++) { sum += term / (2 * n + 1); term *= -(x * x) / (n + 1) }
  return (2 / Math.sqrt(Math.PI)) * sum
}

describe('practice gain', () => {
  it('is zero at the first check and grows towards the full gain', () => {
    expect(expectedPractice(1, P)).toBe(0)
    expect(expectedPractice(2, P)).toBeCloseTo(P.practiceGain * (1 - Math.exp(-1 / P.practiceTau)))
    expect(expectedPractice(3, { ...P, practiceTau: 2 })).toBeCloseTo(P.practiceGain * (1 - Math.exp(-1)))
    expect(expectedPractice(50, P)).toBeCloseTo(P.practiceGain)
  })
})

describe('trend line', () => {
  it('needs three points with different times', () => {
    expect(trendLine([{ x: 0, y: 1, v: 1 }, { x: 1, y: 2, v: 1 }])).toBeNull()
    expect(trendLine([{ x: 2, y: 1, v: 1 }, { x: 2, y: 2, v: 1 }, { x: 2, y: 3, v: 1 }])).toBeNull()
  })

  it('finds the slope and its error exactly', () => {
    const pts = [0, 1, 2, 3].map((x) => ({ x, y: 10 - 0.5 * x, v: 1 }))
    const l = trendLine(pts)!
    expect(l.slope).toBeCloseTo(-0.5)
    expect(l.sd).toBeCloseTo(Math.sqrt(1 / 5))
    expect(l.z).toBeCloseTo(-0.5 / Math.sqrt(1 / 5))
  })

  it('does not depend on the level of the line', () => {
    const a = trendLine([0, 1, 2, 3, 4].map((x) => ({ x, y: 3 + x * 0.2 + (x % 2), v: 2 })))!
    const b = trendLine([0, 1, 2, 3, 4].map((x) => ({ x, y: 30 + x * 0.2 + (x % 2), v: 2 })))!
    expect(a.slope).toBeCloseTo(b.slope)
    expect(a.slope).toBeCloseTo(0.2)
  })
})

describe('which checks count', () => {
  it('treats a check with only one end of the range as not scored', () => {
    const t = evaluate([...base, { date: 'x', low: 30, high: null }])
    expect(t.results[3].scored).toBe(false)
    expect(t.baselineChecks).toEqual([0, 1, 2])
  })

  it('builds the baseline from the first three scored checks, skipping missed ones', () => {
    const t = evaluate([at(0, 30), at(1, null), at(2, 33), at(3, 36), at(4, 33)])
    expect(t.baselineChecks).toEqual([0, 2, 3])
    expect(t.baseline).toBeCloseTo(33)
    expect(t.results.slice(0, 4).every((r) => r.z === null)).toBe(true)
    expect(t.results[4].z).not.toBeNull()
  })

  it('widens the error by the width of each range, in the baseline too', () => {
    const wide = (i: number, lo: number, hi: number): Check => ({ date: `d${i}`, low: lo, high: hi })
    const t = evaluate([wide(0, 31, 35), wide(1, 33, 33), wide(2, 32, 34), wide(3, 30, 36)])
    const rv = (w: number) => (w * w) / 12
    const baseVar = (3 * P.sem ** 2 + rv(4) + rv(0) + rv(2)) / 9
    expect(t.results[3].sd).toBeCloseTo(Math.sqrt(P.sem ** 2 + rv(6) + baseVar))
    expect(t.results[3].mid).toBe(33)
  })
})

describe('held and missed checks', () => {
  it('says a check is held when the sound check failed, and held again the second time', () => {
    const t = evaluate([...base, at(3, null, { hearingLimited: true }), at(4, null, { hearingLimited: true })])
    expect(t.results[3].note).toMatch(/^Held: /)
    expect(t.results[4].note).toMatch(/^Held again/)
    expect(t.results[3].status).toBe('usual-range')
  })

  it('does not call a missed check held', () => {
    const t = evaluate([at(0, null), ...base.map((c, i) => ({ ...c, date: `d${i}` }))])
    expect(t.results[0].note).toMatch(/^Not scored/)
    const u = evaluate([...base, at(3, null), at(4, null, { hearingLimited: true })])
    expect(u.results[4].note).toMatch(/^Held: /)
  })

  it('never turns a missed check into a low one, and keeps the run of low checks', () => {
    const t = evaluate([...base, at(3, LOW), at(4, null), at(5, LOW)])
    expect(t.results[3].status).toBe('watch')
    expect(t.results[4].status).toBe('watch')
    expect(t.results[5].status).toBe('flag')
  })
})

describe('off days', () => {
  it('shows a low off day as lower once, never as a flag', () => {
    const t = evaluate([...base, at(3, LOW), at(4, LOW, { offDay: true })])
    expect(t.results[4].status).toBe('watch')
    expect(t.results[4].note).toMatch(/off day/)
  })

  it('leaves an ordinary off day in the usual range', () => {
    const t = evaluate([...base, at(3, 33, { offDay: true })])
    expect(t.results[3].status).toBe('usual-range')
    expect(t.results[3].note).toBe('Within the usual range for this person.')
  })

  it('does not break or extend a run of low checks', () => {
    const t = evaluate([...base, at(3, LOW), at(4, 33, { offDay: true }), at(5, LOW)])
    expect(t.results[5].status).toBe('flag')
  })
})

describe('reported change in everyday tasks', () => {
  it('goes to the physician during the baseline', () => {
    const t = evaluate([at(0, 33), at(1, 33, { functionChange: true })])
    expect(t.results[1].status).toBe('review')
    expect(t.results[0].status).toBe('building-baseline')
    expect(t.status).toBe('review')
    expect(t.results[1].note).toMatch(/whatever the scores say/)
  })

  it('goes to the physician when the score is in the usual range', () => {
    const t = evaluate([...base, at(3, 33, { functionChange: true })])
    expect(t.results[3].status).toBe('review')
    expect(t.results[3].note).toMatch(/whatever the scores say/)
  })

  it('does not hide a flag or an urgent fall', () => {
    expect(evaluate([...base, at(3, LOW), at(4, LOW, { functionChange: true })]).results[4].status).toBe('flag')
    expect(evaluate([...base, at(3, 33), at(4, 5, { functionChange: true })]).results[4].status).toBe('urgent')
  })

  it('keeps a slow fall on the trend route and adds the report to its note', () => {
    const slow = Array.from({ length: 14 }, (_, i) => at(i, i < 3 ? 33 : 33 - 1.4 * (i - 2)))
    const t = evaluate(slow)
    const k = t.results.findIndex((r) => r.status === 'trend')
    expect(k).toBeGreaterThan(0)
    const withReport = evaluate(slow.map((c, i) => (i === k ? { ...c, functionChange: true } : c)))
    expect(withReport.results[k].status).toBe('trend')
    expect(withReport.results[k].note).toMatch(/also reported/)
  })
})

describe('labels the physician and programme see', () => {
  it('names every status in plain words, each different', () => {
    const labels = Object.values(STATUS_LABEL)
    expect(labels).toHaveLength(7)
    expect(labels.every((l) => l.length > 5)).toBe(true)
    expect(new Set(labels).size).toBe(7)
  })

  it('sends packets for exactly flag, trend and reported change', () => {
    expect([...PACKET_STATUSES]).toEqual(['flag', 'trend', 'review'])
    expect(TREND_PACKET_NOTE).toMatch(/slow-decline route/)
  })

  it('states a source or assumption for every setting', () => {
    const keys = ['sem', 'practiceGain', 'practiceTau', 'flagZ', 'urgentZ', 'trendZ', 'trendMinChecks', 'trendRuns']
    for (const k of keys) expect(P.basis[k]?.length ?? 0).toBeGreaterThan(30)
  })
})

describe('when a session is too uncertain to score', () => {
  const rows = Array.from({ length: 12 }, (_, i) => [`w${'abcdefghijkl'[i]}x`])
  const said = (n: number) => rows.slice(0, n).map((r) => r[0]).join(' ')

  it('scores a range two wide whatever its size', () => {
    const s = scoreTask({ A: said(2), B: '' }, rows, 'en')
    expect([s.low, s.high, s.scored]).toEqual([0, 2, true])
  })

  it('uses the share of the high count above two', () => {
    const limit = (high: number) => Math.floor(MAX_RANGE_SHARE * high)
    // 9 heard, 3 by one listener only: 3 <= 0.34 * 9 = 3.06, scored.
    expect(scoreTask({ A: said(9), B: said(6) }, rows, 'en').scored).toBe(limit(9) >= 3)
    // 8 heard, 3 by one only: 3 > 2.72, not scored.
    expect(scoreTask({ A: said(8), B: said(5) }, rows, 'en').scored).toBe(false)
    expect(scoreTask({ A: said(9), B: said(6) }, rows, 'en').scored).toBe(true)
  })

  it('lists only items someone heard', () => {
    const s = scoreTask({ A: said(3), B: said(1) }, rows, 'en')
    expect(s.items.map((i) => i.row)).toEqual([0, 1, 2])
    expect(s.items.map((i) => i.heard)).toEqual(['both', 'one', 'one'])
  })
})
