import { describe, expect, it } from 'vitest'
import { evaluate } from './change'
import { PERSONAS } from './histories'
import { riskFactors, workingDaysBetween } from './packet'

describe('seeded histories', () => {
  const statuses = (id: string) => evaluate(PERSONAS.find((p) => p.id === id)!.checks).results.map((r) => r.status)
  it('never flags the stable person', () => expect(statuses('stable')).not.toContain('flag'))
  it('never flags the person who only gains from practice', () => expect(statuses('practice')).not.toContain('flag'))
  it('flags the declining person, and not on the first low check', () => {
    const s = statuses('decline')
    expect(s).toContain('flag')
    expect(s.indexOf('watch')).toBeLessThan(s.indexOf('flag'))
  })
})

describe('packet', () => {
  it('maps ten of fourteen risk factors to a screening field', () => {
    const f = riskFactors(PERSONAS[0].record)
    expect(f.length).toBe(14)
    expect(f.filter((x) => x.field).length).toBe(10)
  })
  it('counts working days Monday to Friday', () => {
    expect(workingDaysBetween('2026-11-09', '2026-11-16')).toBe(5)
    expect(workingDaysBetween('2026-11-13', '2026-11-16')).toBe(1)
  })
})
