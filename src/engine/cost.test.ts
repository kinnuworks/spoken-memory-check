import { describe, expect, it } from 'vitest'
import { COST_DEFAULTS, yearlyCost } from './cost'

// The worked figures in docs/COMMERCIAL.md, reproduced from the same inputs.
describe('yearly cost for one screening provider', () => {
  it('matches the 40% uptake arithmetic in the commercial case', () => {
    const r = yearlyCost()
    expect(r.users).toBe(4000)
    expect(r.checks).toBe(16000)
    expect(r.packets).toBe(320)
    expect(r.physicianHours).toBeCloseTo(53.33, 1)
    expect(r.lines[0].aed).toBeCloseTo(4897, -1)
    expect(r.lines[1].aed).toBeCloseTo(21474, -1)
    expect(r.lines[2].aed).toBeCloseTo(24000, 0)
    expect(r.totalAed).toBeCloseTo(260371, -1)
    expect(r.perEligibleAed).toBeCloseTo(26.04, 1)
    expect(r.perCheckAed).toBeCloseTo(16.27, 1)
  })

  it('matches the 20% and 60% rows', () => {
    expect(yearlyCost({ ...COST_DEFAULTS, uptake: 0.2 }).totalAed).toBeCloseTo(245922, -1)
    expect(yearlyCost({ ...COST_DEFAULTS, uptake: 0.6 }).totalAed).toBeCloseTo(274819, -1)
  })

  it('costs nothing for cloud speech when only the on-device listener is used', () => {
    expect(yearlyCost({ ...COST_DEFAULTS, cloudMinutesPerCheck: 0 }).lines[0].aed).toBe(0)
  })

  it('has no per-user cost when nobody takes part', () => {
    const r = yearlyCost({ ...COST_DEFAULTS, uptake: 0 })
    expect([r.users, r.perUserAed, r.perCheckAed]).toEqual([0, 0, 0])
  })
})
