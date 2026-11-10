import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './change'
import { BASE_WORLD, firstFlag, rng, simulatePerson } from './simulate'
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
    const loose = share(4000, (r) => firstFlag('ours', simulatePerson(BASE_WORLD, r), { ...DEFAULT_PARAMS, flagZ: -1 }) >= 0)
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
