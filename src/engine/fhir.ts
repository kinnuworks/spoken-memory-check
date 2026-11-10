import type { Check } from './change'

// FHIR R4 resources for handing a check and a referral to another system.
// Local codes are used where no standard code fits; the system URI marks them as ours.
const SYSTEM = 'urn:spoken-memory-check:codes'

export function checkObservation(patientRef: string, c: Check, parts?: Record<string, [number, number]>) {
  const scored = c.low !== null && c.high !== null
  return {
    resourceType: 'Observation',
    status: scored ? 'final' : 'cancelled',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
    code: { coding: [{ system: SYSTEM, code: 'spoken-check-total', display: 'Spoken memory check total' }], text: 'Spoken memory check total (words said back, words recalled later, animals named)' },
    subject: { reference: patientRef },
    effectiveDateTime: c.date,
    ...(scored
      ? { valueRange: { low: { value: c.low, unit: 'points' }, high: { value: c.high, unit: 'points' } } }
      : { dataAbsentReason: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'not-performed' }], text: 'Not scored: missed, or the recognisers disagreed too much' } }),
    ...(c.offDay ? { note: [{ text: 'Person reported sleeping badly or feeling unwell.' }] } : {}),
    ...(parts && scored
      ? { component: Object.entries(parts).map(([k, v]) => ({ code: { coding: [{ system: SYSTEM, code: `spoken-check-${k}` }] }, valueRange: { low: { value: v[0] }, high: { value: v[1] } } })) }
      : {}),
  }
}

export function referralRequest(patientRef: string, practitionerRef: string, authoredOn: string, dueBy: string) {
  return {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    code: { text: 'Assessment of memory change by a neurologist or geriatrician' },
    subject: { reference: patientRef },
    requester: { reference: practitionerRef },
    authoredOn,
    occurrencePeriod: { end: dueBy },
    reasonCode: [{ text: 'Sustained fall from personal baseline on a spoken memory check, approved by the ordering physician' }],
  }
}

export function bundle(resources: object[]) {
  return { resourceType: 'Bundle', type: 'collection', entry: resources.map((resource) => ({ resource })) }
}
