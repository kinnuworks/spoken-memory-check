import { describe, expect, it } from 'vitest'
import { refMessage } from './hl7'
import { referralRequest } from './fhir'

const base = { messageId: 'm1', sentAt: '2026-09-03T10:15:00', patientId: 'synthetic-decline', referralId: 'r1', referredOn: '2026-09-03', orderingFacility: 'FACILITY1', reason: 'Sustained fall from personal baseline' }

describe('Malaffi referral message', () => {
  it('is a REF^I12 with a SNOMED-coded specialty and priority', () => {
    const m = refMessage({ ...base, specialty: 'neurology', priority: 'routine' }).split('\r')
    expect(m[0]).toContain('REF^I12^REF_I12')
    expect(m[1]).toContain('394591006^Neurology^SCT')
    expect(m[1]).toContain('R^Routine')
  })

  it('codes a hearing referral to ENT and an urgent one as stat', () => {
    const m = refMessage({ ...base, specialty: 'ent', priority: 'urgent' })
    expect(m).toContain('418960008^Otolaryngology^SCT')
    expect(m).toContain('S^Stat')
  })

  it('escapes separators inside free text', () => {
    expect(refMessage({ ...base, specialty: 'neurology', priority: 'routine', reason: 'a|b^c' })).toContain('a\\F\\b\\S\\c')
  })

  it('carries the same specialty in the FHIR referral', () => {
    const r = referralRequest('Patient/x', 'Practitioner/y', '2026-09-03', '2026-09-24', 'geriatrics')
    expect(r.performerType.coding[0].code).toBe('394811001')
    expect(r.priority).toBe('routine')
  })
})
