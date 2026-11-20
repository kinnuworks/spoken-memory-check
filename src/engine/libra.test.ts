import { describe, expect, it } from 'vitest'
import { evaluate } from './change'
import { PERSONAS, type ScreeningRecord } from './histories'
import { LIBRA_RANGE, libra } from './libra'

const base = PERSONAS.find((p) => p.id === 'decline')!.record
const rec = (patch: Partial<ScreeningRecord>): ScreeningRecord => ({ ...base, ...patch })
const healthy = rec({ phq9: 2, systolic: 120, bmi: 24, smoker: false, ldl: 2.5, hba1c: 5.4, activeMinutesWeek: 200 })

describe('LIBRA index from the screening record', () => {
  it('has twelve factors whose weights span the published range of -5.9 to +12.7', () => {
    const f = libra(base).factors
    expect(f).toHaveLength(12)
    const pos = f.filter((x) => x.weight > 0).reduce((s, x) => s + x.weight, 0)
    const neg = f.filter((x) => x.weight < 0).reduce((s, x) => s + x.weight, 0)
    expect(Math.round(pos * 10) / 10).toBe(LIBRA_RANGE.max)
    expect(Math.round(neg * 10) / 10).toBe(LIBRA_RANGE.min)
  })

  it('scores 0 from the record when no known factor is present, with the unknowns as a range', () => {
    const l = libra(healthy)
    expect(l.known).toBe(0)
    expect(l.knownCount).toBe(7)
    expect([l.low, l.high]).toEqual([-5.9, 2.1])
    expect(l.ranked).toEqual([])
  })

  it('adds each present factor once, and ranks them heaviest first', () => {
    // Case C: depression, hypertension, obesity, cholesterol, diabetes, inactivity.
    const l = libra(base)
    expect(l.known).toBe(9.1)
    expect(l.ranked.map((f) => f.name)).toEqual(['Depression', 'Hypertension', 'Obesity', 'High cholesterol', 'Diabetes', 'Physical inactivity'])
    expect([l.low, l.high]).toEqual([3.2, 11.2])
  })

  it('uses the thresholds at their edges', () => {
    expect(libra(rec({ ...healthy, systolic: 140 })).known).toBe(1.6)
    expect(libra(rec({ ...healthy, systolic: 139 })).known).toBe(0)
    expect(libra(rec({ ...healthy, phq9: 10 })).known).toBe(2.1)
    expect(libra(rec({ ...healthy, activeMinutesWeek: 150 })).known).toBe(0)
    expect(libra(rec({ ...healthy, hba1c: 6.5 })).known).toBe(1.3)
  })

  it('never changes what the change rule decides', () => {
    for (const p of PERSONAS) {
      const before = evaluate(p.checks).results.map((r) => r.status)
      libra(p.record)
      expect(evaluate(p.checks).results.map((r) => r.status)).toEqual(before)
    }
  })
})

describe('LIBRA as a FHIR RiskAssessment', () => {
  it('states the score, the range and the factors, and no probability', async () => {
    const { libraAssessment } = await import('./fhir')
    const ra = libraAssessment('Patient/x', base, '2026-11-20')
    expect(ra.resourceType).toBe('RiskAssessment')
    expect(ra.prediction[0].qualitativeRisk.text).toContain('LIBRA 9.1 from 7 of 12 factors')
    expect(ra.prediction[0].qualitativeRisk.text).toContain('between 3.2 and 11.2')
    expect(ra.prediction[0].rationale).toMatch(/^Modifiable factors present: depression, hypertension/)
    expect(JSON.stringify(ra)).not.toMatch(/probability/)
    const none = libraAssessment('Patient/x', healthy, '2026-11-20')
    expect(none.prediction[0].rationale).toBe('No modifiable factor in the screening record is present.')
    expect(none.text.div).toContain('Present, heaviest first: none')
  })
})
