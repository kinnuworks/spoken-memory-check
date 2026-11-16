import { afterEach, describe, expect, it, vi } from 'vitest'
import { cell, simulateProgramme, SMALL_CELL } from './programme'
import { HEARING_SETTINGS, hearingPathway, lostSignals, SIGNALS } from './signals'
import { appendAudit, APP_VERSION, loadAudit } from './audit'
import { clearChecks, loadChecks, saveCheck, type StoredCheck } from './store'
import { falseAlarmsByStart, firstFlag, programmeYear, runBenchmark, wilson, BASE_WORLD, rng, simulatePerson } from './simulate'

describe('programme view (simulated year)', () => {
  const rows = simulateProgramme()

  it('accounts for every packet exactly once', () => {
    for (const r of rows) {
      expect(r.approved + r.dismissed).toBe(r.packets)
      expect(r.seenInTarget + r.seenLate + r.open + r.lost).toBe(r.approved)
      expect(r.baselineDone).toBeLessThanOrEqual(r.enrolled)
      expect(r.packets + r.urgent).toBeLessThanOrEqual(r.enrolled)
      expect(r.held).toBeLessThanOrEqual(r.enrolled)
    }
  })

  it('enrols the stated facility sizes and is reproducible', () => {
    expect(rows.map((r) => r.enrolled)).toEqual([620, 410, 280, 95])
    expect(JSON.stringify(simulateProgramme())).toBe(JSON.stringify(rows))
    expect(JSON.stringify(simulateProgramme(8))).not.toBe(JSON.stringify(rows))
  })

  it('hides counts small enough to identify someone, but not zero', () => {
    expect(cell(0)).toBe('0')
    for (let n = 1; n < SMALL_CELL; n++) expect(cell(n)).toBe(`<${SMALL_CELL}`)
    expect(cell(SMALL_CELL)).toBe(String(SMALL_CELL))
    expect(cell(1234)).toBe((1234).toLocaleString())
  })
})

describe('lost-signals audit (simulated year)', () => {
  const a = lostSignals()

  it('splits every abnormal result into in time, late or no action', () => {
    expect(a.rows).toHaveLength(SIGNALS.length)
    for (const r of a.rows) {
      expect(r.inTime + r.late + r.noAction).toBe(r.flagged)
      expect(r.noActionPer1000).toBe(Math.round((r.noAction / a.members) * 1000))
    }
  })

  it('counts a person with several unacted results once', () => {
    const totalNoAction = a.rows.reduce((s, r) => s + r.noAction, 0)
    expect(a.peopleWithAny).toBeLessThanOrEqual(totalNoAction)
    expect(a.peopleWithAny).toBeGreaterThan(0)
    expect(a.peopleWithAnyPer1000).toBe(Math.round((a.peopleWithAny / a.members) * 1000))
  })

  it('lands near the stated settings on a large run', () => {
    const big = lostSignals(200000, 3)
    SIGNALS.forEach((s, k) => {
      expect(big.rows[k].flagged / big.members).toBeCloseTo(s.setting.abnormal, 2)
      expect(big.rows[k].inTime / big.rows[k].flagged).toBeCloseTo(s.setting.inTime, 1)
    })
  })
})

describe('hearing pathway (simulated year)', () => {
  it('only ever narrows from one step to the next', () => {
    const steps = hearingPathway()
    for (let i = 1; i < steps.length; i++) expect(steps[i].count).toBeLessThanOrEqual(steps[i - 1].count)
  })

  it('lands near the stated settings on a large run', () => {
    const [checked, refer, seen, fitted, wearing] = hearingPathway(200000, 5).map((s) => s.count)
    const s = HEARING_SETTINGS
    expect(checked / 200000).toBeCloseTo(s.checked, 2)
    expect(refer / checked).toBeCloseTo(s.refer, 2)
    expect(seen / refer).toBeCloseTo(s.seen, 1)
    expect(fitted / seen).toBeCloseTo(s.fitted, 1)
    expect(wearing / fitted).toBeCloseTo(s.wearing, 1)
  })
})

describe('local records', () => {
  const mem = new Map<string, string>()
  const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
  afterEach(() => { mem.clear(); vi.unstubAllGlobals() })

  it('keeps every physician decision with its time and app version', () => {
    vi.stubGlobal('localStorage', fake)
    appendAudit({ case: 'decline', action: 'dismissed', detail: 'recent illness' }, new Date('2026-11-15T08:00:00Z'))
    const all = appendAudit({ case: 'decline', action: 'approved' }, new Date('2026-11-16T08:00:00Z'))
    expect(all).toHaveLength(2)
    expect(loadAudit()).toEqual(all)
    expect(all[0]).toMatchObject({ action: 'dismissed', detail: 'recent illness', at: '2026-11-15T08:00:00.000Z', appVersion: APP_VERSION })
  })

  it('still shows a decision when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(loadAudit()).toEqual([])
    expect(appendAudit({ case: 'x', action: 'approved' })).toHaveLength(1)
  })

  it('keeps checks on the device and clears them on request', () => {
    vi.stubGlobal('localStorage', fake)
    const c: StoredCheck = { date: '2026-11-15', low: 20, high: 22, lang: 'ar', list: 1, parts: { immediate: [5, 6], delayed: [4, 4], animals: [11, 12] }, recognisers: ['on-device'] }
    saveCheck(c)
    saveCheck({ ...c, date: '2026-12-15' })
    expect(loadChecks().map((x) => x.date)).toEqual(['2026-11-15', '2026-12-15'])
    clearChecks()
    expect(loadChecks()).toEqual([])
  })

  it('treats a damaged record as empty rather than failing', () => {
    vi.stubGlobal('localStorage', fake)
    mem.set('smc.checks.v1', '{not json')
    mem.set('smc.audit.v1', '{not json')
    expect(loadChecks()).toEqual([])
    expect(loadAudit()).toEqual([])
  })
})

describe('benchmark helpers', () => {
  it('gives the textbook Wilson interval', () => {
    const [lo, hi] = wilson(45, 100)
    expect(lo).toBeCloseTo(0.3561, 3)
    expect(hi).toBeCloseTo(0.5476, 3)
    expect(wilson(0, 0)).toEqual([0, 1])
    expect(wilson(0, 50)[0]).toBe(0)
    expect(wilson(50, 50)[1]).toBe(1)
  })

  it('a fixed cut-off for everyone flags people who are only low to begin with', () => {
    const r = rng(9)
    let lowStarters = 0, flagged = 0
    for (let i = 0; i < 3000; i++) {
      const c = simulatePerson(BASE_WORLD, r)
      if (((c[0].low as number) + (c[0].high as number)) / 2 < 25) { lowStarters++; if (firstFlag('fixed-cutoff', c) >= 0) flagged++ }
    }
    expect(lowStarters).toBeGreaterThan(50)
    expect(flagged / lowStarters).toBeGreaterThan(0.3)
  })

  it('reports every world and rule, with detection rising with the size of the decline', () => {
    const b = runBenchmark(300, 5)
    expect(b.rows).toHaveLength(7 * 5)
    for (const row of b.rows.filter((x) => x.rule === 'ours')) {
      expect(row.detected['3']).toBeGreaterThanOrEqual(row.detected['1'])
      expect(row.falseAlarmYear).toBeLessThan(0.12)
    }
  }, 60000)

  it('counts a programme year so that every member is in exactly one cell', () => {
    const y = programmeYear(5000, 0.04, 21)
    expect(y.tp + y.fn + y.fp + y.tn).toBe(5000)
    expect(y.packetsPer1000).toBeCloseTo(((y.tp + y.fp) / 5000) * 1000, 6)
    expect(y.sensitivity).toBeGreaterThan(0.8)
    expect(y.specificity).toBeGreaterThan(0.93)
    const before = programmeYear(5000, 0.04, 21, 2, 'two-in-a-row')
    expect(before.tp + before.fn + before.fp + before.tn).toBe(5000)
  })
})

describe('false alarms by starting level', () => {
  it('splits stable people at the lowest fifth of baselines, and one cut-off flags the low starters far more', () => {
    const r = falseAlarmsByStart(2000, 7)
    expect(r.lowStart.people + r.others.people).toBe(2000)
    expect(r.lowStart.people).toBeGreaterThan(300)
    expect(r.lowStart.fixedCutoff).toBeGreaterThan(r.lowStart.ours + 0.3)
    expect(r.lowStart.ours).toBeLessThan(0.1)
    expect(r.others.ours).toBeLessThan(0.12)
  }, 60000)
})
