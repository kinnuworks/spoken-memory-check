import { describe, expect, it } from 'vitest'
import { evaluate } from './change'
import { PERSONAS, type ScreeningRecord } from './histories'
import { riskContext, treatableContributors } from './packet'
import { improvable } from './prevention'

const person = (id: string) => PERSONAS.find((p) => p.id === id)!
const decline = person('decline')
const rec = (patch: Partial<ScreeningRecord>): ScreeningRecord => ({ ...decline.record, ...patch })
const none = { familyHistory: false, genome: false }

describe('risk context in the eight areas Statement 8 names', () => {
  it('always returns the eight areas, in the statement order', () => {
    for (const p of PERSONAS) {
      expect(riskContext(p.record, p.shared, p.checks).map((a) => a.area)).toEqual(['Physical', 'Metabolic', 'Sleep', 'Mental wellbeing', 'Functional', 'Lifestyle', 'Family history', 'Genomic'])
    }
  })

  it('keeps family history and genome out unless each was shared', () => {
    const rows = riskContext(decline.record, none, decline.checks)
    const fam = rows.find((a) => a.area === 'Family history')!, gen = rows.find((a) => a.area === 'Genomic')!
    expect([fam.access, gen.access]).toEqual(['Not shared', 'Not shared'])
    expect([fam.concern, gen.concern]).toEqual([false, false])
    expect(fam.finding + gen.finding).not.toMatch(/mother|APOE/)
    const shared = riskContext(decline.record, { familyHistory: true, genome: true }, decline.checks)
    expect(shared.find((a) => a.area === 'Family history')!.finding).toMatch(/Mother/)
    expect(shared.find((a) => a.area === 'Genomic')!.finding).toMatch(/APOE e4: one copy/)
    expect(shared.filter((a) => a.access === 'Its own consent: shared')).toHaveLength(2)
  })

  it('reads sleep from the first home check and marks snoring or short sleep', () => {
    const area = (r: ScreeningRecord) => riskContext(r, none, [])[2]
    expect(area(rec({ sleep: { hoursPerNight: 7, snoringOrPauses: false } })).concern).toBe(false)
    expect(area(rec({ sleep: { hoursPerNight: 5, snoringOrPauses: false } })).concern).toBe(true)
    expect(area(rec({ sleep: { hoursPerNight: 8, snoringOrPauses: true } })).finding).toMatch(/snoring or pauses in breathing reported/)
    const notAsked = area(rec({ sleep: undefined }))
    expect([notAsked.finding, notAsked.concern]).toEqual(['Not asked', false])
  })

  it('carries the everyday-tasks answers from the checks into the functional area', () => {
    const fn = person('function')
    const area = riskContext(fn.record, fn.shared, fn.checks).find((a) => a.area === 'Functional')!
    const yes = fn.checks.filter((c) => c.functionChange).map((c) => c.date)
    expect(yes.length).toBeGreaterThan(0)
    expect(area.concern).toBe(true)
    expect(area.finding).toContain(yes[0])
    const stable = person('stable')
    expect(riskContext(stable.record, stable.shared, stable.checks).find((a) => a.area === 'Functional')!.concern).toBe(false)
  })

  it('never changes what the rule decides', () => {
    for (const p of PERSONAS) {
      const before = evaluate(p.checks).results.map((r) => r.status)
      riskContext(p.record, { familyHistory: true, genome: true }, p.checks)
      expect(evaluate(p.checks).results.map((r) => r.status)).toEqual(before)
    }
  })
})

describe('sleep in the packet and the person view', () => {
  it('puts sleep apnoea on the check-first list when snoring is reported, even with normal BMI and blood pressure', () => {
    const r = rec({ bmi: 24, systolic: 120, sleep: { hoursPerNight: 7, snoringOrPauses: true } })
    const c = treatableContributors(r).find((x) => x.name === 'Sleep apnoea')
    expect(c?.why).toMatch(/^Loud snoring/)
    expect(treatableContributors(rec({ bmi: 24, systolic: 120, sleep: { hoursPerNight: 7, snoringOrPauses: false } })).some((x) => x.name === 'Sleep apnoea')).toBe(false)
  })

  it('gives the person a sleep step for snoring or short sleep, and none otherwise', () => {
    expect(improvable(rec({ sleep: { hoursPerNight: 7, snoringOrPauses: true } })).find((s) => s.topic === 'Sleep')?.found).toMatch(/snore/)
    expect(improvable(rec({ sleep: { hoursPerNight: 5, snoringOrPauses: false } })).find((s) => s.topic === 'Sleep')?.found).toMatch(/5 hours/)
    expect(improvable(rec({ sleep: { hoursPerNight: 7, snoringOrPauses: false } })).some((s) => s.topic === 'Sleep')).toBe(false)
  })

  it('orders the person\'s steps: hearing first, then by LIBRA weight', () => {
    const r = rec({ hearing: 'reduced', phq9: 12, systolic: 150, bmi: 31, smoker: true, ldl: 3.6, hba1c: 7, activeMinutesWeek: 20, vision: 'reduced', sleep: { hoursPerNight: 5, snoringOrPauses: false } })
    expect(improvable(r).map((s) => s.topic)).toEqual(['Hearing', 'Mood', 'Blood pressure', 'Weight', 'Smoking', 'Cholesterol', 'Blood sugar', 'Movement', 'Sleep', 'Eyesight'])
  })
})
