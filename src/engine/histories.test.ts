import { describe, expect, it } from 'vitest'
import { evaluate } from './change'
import { PERSONAS } from './histories'
import { riskFactors, workingDaysBetween } from './packet'

describe('seeded histories', () => {
  const statuses = (id: string) => evaluate(PERSONAS.find((p) => p.id === id)!.checks).results.map((r) => r.status)
  it('never flags the stable person', () => { expect(statuses('stable')).not.toContain('flag'); expect(statuses('stable')).not.toContain('trend') })
  it('never flags the person who only gains from practice', () => { expect(statuses('practice')).not.toContain('flag'); expect(statuses('practice')).not.toContain('trend') })
  it('sends the slowly declining person on through the slow-decline route, and not on the first low check', () => {
    const s = statuses('decline')
    expect(s).toContain('trend')
    expect(s.indexOf('watch')).toBeLessThan(s.indexOf('trend'))
  })
})

describe('every route has a seeded case', () => {
  const last = (id: string) => evaluate(PERSONAS.find((p) => p.id === id)!.checks)
  it('holds checks when the sound check fails, without scoring them as low', () => {
    const t = last('hearing')
    expect(t.results.filter((r) => !r.scored).length).toBe(2)
    expect(t.results.map((r) => r.status)).not.toContain('flag')
  })
  it('sends a reported change in everyday tasks to review whatever the score', () => {
    const t = last('function')
    const r = t.results[t.results.length - 1]
    expect(r.status).toBe('review')
    expect((r.z as number) > -1.645).toBe(true)
  })
  it('takes the urgent route on a very large fall', () => expect(last('urgent').status).toBe('urgent'))
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

import { improvable } from './prevention'
import { NO_CONSENT } from './consent'

describe('person view', () => {
  it('lists only what the screening record shows and never schooling', () => {
    const steps = improvable(PERSONAS[2].record).map((s) => s.topic)
    expect(steps).toContain('Hearing')
    expect(steps).toContain('Mood')
    expect(steps.join(' ')).not.toMatch(/school|education/i)
  })
  it('gives nothing to someone with a clean record', () => {
    expect(improvable({ ...PERSONAS[0].record, activeMinutesWeek: 200 }).length).toBe(0)
  })
  it('starts with every consent off', () => {
    expect(Object.values(NO_CONSENT).filter((v) => v === true).length).toBe(0)
  })
})

import { addWorkingDays } from './packet'
describe('seeded stories match their data', () => {
  const t = (id: string) => evaluate(PERSONAS.find((p) => p.id === id)!.checks)
  it("A's off-day check really is low, and still not counted", () => {
    const r = t('stable').results[6]
    expect(r.z as number).toBeLessThan(-1.645)
    expect(t('stable').results.map((x) => x.status)).not.toContain('flag')
  })
  it("B's scores really rise", () => {
    const c = PERSONAS.find((p) => p.id === 'practice')!.checks
    const late = c.slice(-3).reduce((s, x) => s + (x.high as number), 0) / 3
    const early = c.slice(0, 3).reduce((s, x) => s + (x.high as number), 0) / 3
    expect(late).toBeGreaterThan(early + 1.5)
  })
  it('working days skip weekends', () => {
    expect(addWorkingDays('2026-11-13', 1)).toBe('2026-11-16')
    expect(new Date(addWorkingDays('2026-08-26', 3) + 'T00:00:00Z').getUTCDay()).not.toBe(0)
  })
})
