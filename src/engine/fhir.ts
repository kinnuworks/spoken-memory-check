import type { Check } from './change'
import type { ScreeningRecord } from './histories'

// FHIR R4 resources for handing a check and a referral to another system.
// Local codes are used where no standard code fits; the system URI marks them as ours.
// Checked with the official HL7 validator: see docs/FHIR_VALIDATION.md and scripts/fhir-validate.ts.
export const SYSTEM = 'urn:spoken-memory-check:codes'

// Scores are counts of points: dimensionless, so the UCUM unity code "1". The validator warns
// against annotations such as {score}, as they are ignored when units are compared.
const POINTS = { unit: 'points', system: 'http://unitsofmeasure.org', code: '1' } as const
const points = (value: number) => ({ value, ...POINTS })

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Human-readable summary (dom-6) so a receiving system can show the resource without parsing it.
const narrative = (text: string) => ({ status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${esc(text)}</p></div>` })

const PART_NAMES: Record<string, string> = { repeat: 'words said back', recall: 'words recalled later', animals: 'animals named' }

export function checkObservation(patientRef: string, c: Check, parts?: Record<string, [number, number]>) {
  const scored = c.low !== null && c.high !== null
  const absentText = c.hearingLimited ? 'Held, not scored: the sound check failed, so a spoken check cannot be read' : 'Not scored: missed, or the recognisers disagreed too much'
  const summary = scored ? `Spoken memory check on ${c.date}: ${c.low} to ${c.high} points.` : `Spoken memory check on ${c.date}. ${absentText}.`
  return {
    resourceType: 'Observation',
    text: narrative(summary + (c.offDay ? ' Person reported sleeping badly or feeling unwell.' : '')),
    status: scored ? 'final' : 'cancelled',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
    code: { coding: [{ system: SYSTEM, code: 'spoken-check-total', display: 'Spoken memory check total' }], text: 'Spoken memory check total (words said back, words recalled later, animals named)' },
    subject: { reference: patientRef },
    effectiveDateTime: c.date,
    ...(scored
      ? { valueRange: { low: points(c.low!), high: points(c.high!) } }
      : { dataAbsentReason: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'not-performed', display: 'Not Performed' }], text: absentText } }),
    ...(c.offDay ? { note: [{ text: 'Person reported sleeping badly or feeling unwell.' }] } : {}),
    ...(parts && scored
      ? {
          component: Object.entries(parts).map(([k, v]) => ({
            code: { coding: [{ system: SYSTEM, code: `spoken-check-${k}`, ...(PART_NAMES[k] ? { display: `Spoken memory check: ${PART_NAMES[k]}` } : {}) }] },
            valueRange: { low: points(v[0]), high: points(v[1]) },
          })),
        }
      : {}),
  }
}

const RELATIVE = {
  mother: { code: 'MTH', display: 'mother' },
  father: { code: 'FTH', display: 'father' },
  sibling: { code: 'SIB', display: 'sibling' },
} as const

/** Dementia in a parent or sibling, only when the person agreed to share family history. Null when there is none to send. */
export function familyHistory(patientRef: string, r: ScreeningRecord) {
  const f = r.familyDementia
  if (f.relative === 'none' || f.relative === 'unknown') return null
  const rel = RELATIVE[f.relative]
  return {
    resourceType: 'FamilyMemberHistory',
    text: narrative(`${rel.display[0].toUpperCase()}${rel.display.slice(1)} diagnosed with dementia${f.ageAtDiagnosis ? ` at ${f.ageAtDiagnosis}` : ''}.`),
    status: 'completed',
    patient: { reference: patientRef },
    relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', ...rel }] },
    condition: [{
      code: { coding: [{ system: 'http://snomed.info/sct', code: '52448006', display: 'Dementia' }], text: 'Dementia' },
      ...(f.ageAtDiagnosis ? { onsetAge: { value: f.ageAtDiagnosis, unit: 'years', system: 'http://unitsofmeasure.org', code: 'a' } } : {}),
    }],
  }
}

/** APOE e4 copies from a genome programme result, only when the person agreed to share it. Null when there is no result. */
export function apoeObservation(patientRef: string, r: ScreeningRecord) {
  if (r.apoeE4Copies === null) return null
  return {
    resourceType: 'Observation',
    text: narrative(`APOE e4 copies: ${r.apoeE4Copies}, from the Emirati Genome Programme result. Context only; not used by the check's rule.`),
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
    code: { coding: [{ system: SYSTEM, code: 'apoe-e4-copies', display: 'APOE e4 allele copies' }], text: 'APOE e4 allele copies (genome programme result)' },
    subject: { reference: patientRef },
    valueInteger: r.apoeE4Copies,
  }
}

// SNOMED CT specialty codes for the referral, as Malaffi asks for a coded specialty (Circular 2026/144).
export const SPECIALTY = {
  neurology: { system: 'http://snomed.info/sct', code: '394591006', display: 'Neurology' },
  geriatrics: { system: 'http://snomed.info/sct', code: '394811001', display: 'Geriatric medicine' },
  ent: { system: 'http://snomed.info/sct', code: '418960008', display: 'Otolaryngology' },
} as const
export type Specialty = keyof typeof SPECIALTY

export function referralRequest(patientRef: string, practitionerRef: string, authoredOn: string, dueBy: string, specialty: Specialty = 'neurology', priority: 'routine' | 'urgent' = 'routine') {
  const what = specialty === 'ent' ? 'Hearing assessment' : 'Assessment of memory change by a neurologist or geriatrician'
  return {
    resourceType: 'ServiceRequest',
    text: narrative(`${priority === 'urgent' ? 'Urgent' : 'Routine'} referral to ${SPECIALTY[specialty].display}: ${what}. Ordered ${authoredOn}, due by ${dueBy}.`),
    status: 'active',
    intent: 'order',
    priority,
    performerType: { coding: [SPECIALTY[specialty]] },
    code: { text: what },
    subject: { reference: patientRef },
    requester: { reference: practitionerRef },
    authoredOn,
    occurrencePeriod: { end: dueBy },
    reasonCode: [{ text: 'Sustained fall from personal baseline on a spoken memory check, approved by the ordering physician' }],
  }
}

// A collection Bundle needs a fullUrl on every entry (bdl-7 and the R4 Bundle rules). These
// resources have no server identity yet, so each gets a fresh urn:uuid, as the spec allows.
export function bundle(resources: object[], newId: () => string = () => crypto.randomUUID()) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources.map((resource) => ({ fullUrl: `urn:uuid:${newId()}`, resource })),
  }
}
