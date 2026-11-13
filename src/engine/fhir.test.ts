import { describe, expect, it } from 'vitest'
import type { Check } from './change'
import { bundle, checkObservation, referralRequest, SPECIALTY, SYSTEM } from './fhir'

// Shapes the official HL7 validator needs (see docs/FHIR_VALIDATION.md). These tests keep them from slipping.
const scored: Check = { date: '2026-03-01', low: 29, high: 31 }
const missed: Check = { date: '2026-03-02', low: null, high: null }
const held: Check = { date: '2026-03-03', low: null, high: null, hearingLimited: true }
const offDay: Check = { date: '2026-03-04', low: 18, high: 19, offDay: true }

const UCUM_POINTS = { unit: 'points', system: 'http://unitsofmeasure.org', code: '1' }

// The builder's return type is a union (value or dataAbsentReason); widen it so both can be inspected.
type Coded = { coding: { system: string; code: string }[]; text?: string }
type AnyObservation = ReturnType<typeof checkObservation> & { valueRange?: { low: { value: number } }; dataAbsentReason?: Coded }
const obs = (c: Check, parts?: Record<string, [number, number]>) => checkObservation('Patient/p1', c, parts) as AnyObservation

describe('checkObservation', () => {
  it('codes the check with a system and gives a final range in UCUM units', () => {
    const o = obs(scored)
    expect(o.status).toBe('final')
    expect(o.code.coding[0]).toMatchObject({ system: SYSTEM, code: 'spoken-check-total' })
    expect(o.subject).toEqual({ reference: 'Patient/p1' })
    expect(o.valueRange).toEqual({ low: { value: 29, ...UCUM_POINTS }, high: { value: 31, ...UCUM_POINTS } })
    expect(o).not.toHaveProperty('dataAbsentReason')
  })

  it('uses dataAbsentReason and no value when the check was not scored', () => {
    const o = obs(missed)
    expect(o.status).toBe('cancelled')
    expect(o).not.toHaveProperty('valueRange')
    expect(o.dataAbsentReason?.coding[0]).toMatchObject({ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'not-performed' })
  })

  it('says a check held for hearing was held, not missed', () => {
    const o = obs(held)
    expect(o.dataAbsentReason?.text).toMatch(/sound check failed/)
    expect(o.text.div).toMatch(/sound check failed/)
  })

  it('keeps the off-day note and value', () => {
    const o = obs(offDay)
    expect(o.note).toEqual([{ text: 'Person reported sleeping badly or feeling unwell.' }])
    expect(o.valueRange?.low.value).toBe(18)
  })

  it('carries a generated XHTML narrative', () => {
    const o = obs(scored)
    expect(o.text.status).toBe('generated')
    expect(o.text.div).toMatch(/^<div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">/)
    expect(o.text.div).toContain('29 to 31 points')
  })

  it('gives part scores coded components with UCUM ranges, only when scored', () => {
    const o = checkObservation('Patient/p1', scored, { recall: [5, 6] })
    expect(o.component).toEqual([
      {
        code: { coding: [{ system: SYSTEM, code: 'spoken-check-recall', display: 'Spoken memory check: words recalled later' }] },
        valueRange: { low: { value: 5, ...UCUM_POINTS }, high: { value: 6, ...UCUM_POINTS } },
      },
    ])
    expect(checkObservation('Patient/p1', missed, { recall: [5, 6] })).not.toHaveProperty('component')
  })
})

describe('referralRequest', () => {
  it('fills the required ServiceRequest fields and keeps the call signature', () => {
    const r = referralRequest('Patient/p1', 'Practitioner/ordering', '2026-08-01', '2026-08-22', 'geriatrics')
    expect(r).toMatchObject({
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: 'routine',
      subject: { reference: 'Patient/p1' },
      requester: { reference: 'Practitioner/ordering' },
      authoredOn: '2026-08-01',
      occurrencePeriod: { end: '2026-08-22' },
    })
    expect(r.performerType.coding).toEqual([SPECIALTY.geriatrics])
    expect(r.text.div).toContain('Geriatric medicine')
  })

  it('keeps the SNOMED CT specialty codes', () => {
    expect(SPECIALTY.neurology.code).toBe('394591006')
    expect(SPECIALTY.geriatrics.code).toBe('394811001')
    expect(SPECIALTY.ent.code).toBe('418960008')
    const ent = referralRequest('Patient/p1', 'Practitioner/ordering', '2026-08-01', '2026-08-22', 'ent', 'urgent')
    expect(ent.priority).toBe('urgent')
    expect(ent.code.text).toBe('Hearing assessment')
  })
})

describe('bundle', () => {
  it('gives every collection entry a unique urn:uuid fullUrl and a timestamp', () => {
    const b = bundle([obs(scored), referralRequest('Patient/p1', 'Practitioner/ordering', '2026-08-01', '2026-08-22')])
    expect(b.type).toBe('collection')
    expect(Number.isNaN(Date.parse(b.timestamp))).toBe(false)
    const urls = b.entry.map((e) => e.fullUrl)
    for (const u of urls) expect(u).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('accepts an id source so output can be made repeatable', () => {
    let n = 0
    const b = bundle([{ resourceType: 'Observation' }], () => `00000000-0000-4000-8000-00000000000${n++}`)
    expect(b.entry[0].fullUrl).toBe('urn:uuid:00000000-0000-4000-8000-000000000000')
  })
})
