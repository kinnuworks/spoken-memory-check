import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './change'
import { BASE_WORLD, byLanguage, firstFlag, rng, simulatePerson, suddenDrops } from './simulate'
import { bundle, checkObservation, referralRequest } from './fhir'

const share = (n: number, f: (r: () => number) => boolean) => { const r = rng(7); let k = 0; for (let i = 0; i < n; i++) if (f(r)) k++; return k / n }

describe('flag on simulated people', () => {
  it('is reproducible from its seed', () => {
    expect(JSON.stringify(simulatePerson(BASE_WORLD, rng(1)))).toBe(JSON.stringify(simulatePerson(BASE_WORLD, rng(1))))
  })
  it('raises fewer false alarms than a single-low-check rule', () => {
    const ours = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r)) >= 0)
    const single = share(4000, (r) => firstFlag('single-low', simulatePerson(BASE_WORLD, r)) >= 0)
    expect(ours).toBeLessThan(0.06)
    expect(single).toBeGreaterThan(ours * 3)
  })
  it('keeps false alarms with both routes at or under about 5% a year', () => {
    expect(share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r)) >= 0)).toBeLessThan(0.06)
  })
  it('catches more slow decline than the two-in-a-row rule alone', () => {
    const w = { ...BASE_WORLD, slope: 1 }
    const both = share(4000, (r) => firstFlag('ours', simulatePerson(w, r)) >= w.declineFrom)
    const before = share(4000, (r) => firstFlag('two-in-a-row', simulatePerson(w, r)) >= w.declineFrom)
    expect(both).toBeGreaterThan(before + 0.08)
  })
  it('catches more slow decline than the previous rule, at a similar false-alarm rate', () => {
    const w = { ...BASE_WORLD, slope: 1 }
    const now = share(4000, (r) => firstFlag('ours', simulatePerson(w, r)) >= w.declineFrom)
    const prev = share(4000, (r) => firstFlag('previous', simulatePerson(w, r)) >= w.declineFrom)
    expect(now).toBeGreaterThan(prev + 0.03)
    const faNow = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r)) >= 0)
    const faPrev = share(4000, (r) => firstFlag('previous', simulatePerson(BASE_WORLD, r)) >= 0)
    expect(faNow).toBeLessThan(faPrev + 0.01)
  })
  it('does not catch a sudden lasting drop later than the previous rule', () => {
    const [now, prev] = suddenDrops(3000, 11, ['ours', 'previous'])
    for (const step of ['6', '8', '10']) {
      expect(now.detected[step]).toBeGreaterThanOrEqual(prev.detected[step] - 0.01)
      expect(now.medianChecksToFlag[step] as number).toBeLessThanOrEqual(prev.medianChecksToFlag[step] as number)
    }
  }, 60000)
  it('would notice if the trend cut-off were loosened', () => {
    const loose = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r), { ...DEFAULT_PARAMS, trendZ: -1 }) >= 0)
    expect(loose).toBeGreaterThan(0.1)
  })
  it('catches most people losing three points a check', () => {
    const w = { ...BASE_WORLD, slope: 3 }
    expect(share(4000, (r) => firstFlag('ours', simulatePerson(w, r)) >= w.declineFrom)).toBeGreaterThan(0.95)
  })
  it('does not turn recogniser misses into alarms', () => {
    const clean = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r)) >= 0)
    const noisy = share(4000, (r) => firstFlag('ours', simulatePerson({ ...BASE_WORLD, miss: 0.15 }, r)) >= 0)
    expect(noisy).toBeLessThanOrEqual(clean + 0.01)
  })
  // Each change below is a way the rule could be broken by mistake. The benchmark must notice.
  it('would notice if the rule stopped requiring two checks in a row', () => {
    const broken = share(4000, (r) => firstFlag('single-low', simulatePerson(BASE_WORLD, r), DEFAULT_PARAMS) >= 0)
    expect(broken).toBeGreaterThan(0.15)
  })
  it('would notice if the threshold were loosened', () => {
    const loose = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r), { ...DEFAULT_PARAMS, pairZ: -1.5 }) >= 0)
    expect(loose).toBeGreaterThan(0.1)
  })
  it('would notice if the practice adjustment were far too large', () => {
    const over = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r), { ...DEFAULT_PARAMS, practiceGain: 8 }) >= 0)
    expect(over).toBeGreaterThan(0.15)
  })
})

describe('FHIR output', () => {
  it('writes a scored check as a range and an unscored one with a reason', () => {
    const a = checkObservation('Patient/1', { date: '2026-11-10', low: 28, high: 30 }) as Record<string, any>
    expect(a.valueRange.low.value).toBe(28)
    const b = checkObservation('Patient/1', { date: '2026-11-10', low: null, high: null }) as Record<string, any>
    expect(b.status).toBe('cancelled')
    expect(b.valueRange).toBeUndefined()
    expect(b.dataAbsentReason).toBeDefined()
  })
  it('bundles a referral with its due date', () => {
    const b = bundle([referralRequest('Patient/1', 'Practitioner/9', '2026-08-31', '2026-09-21')]) as Record<string, any>
    expect(b.entry[0].resource.occurrencePeriod.end).toBe('2026-09-21')
  })
})

describe('the flag by language, from measured listening', () => {
  it('sets each listener\'s miss rate so that either one hears the measured share, and loses sensitivity as listening gets worse', () => {
    const rows = byLanguage(400, [
      { lang: 'perfect', heard: 1, heardLow: 1, words: 1, speakers: 1 },
      { lang: 'poor', heard: 0.75, heardLow: 0.64, words: 1, speakers: 1 },
    ])
    expect(rows[0].central.miss).toBe(0)
    expect(rows[1].central.miss).toBe(0.5)
    expect(rows[1].pessimistic.miss).toBe(0.6)
    expect(rows[1].central.detected['2']).toBeLessThan(rows[0].central.detected['2'])
    expect(rows[1].pessimistic.detected['2']).toBeLessThanOrEqual(rows[1].central.detected['2'])
    expect(rows[0].lang).toBe('perfect')
  })
})
