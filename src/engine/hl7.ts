import { SPECIALTY, type Specialty } from './fhir'

// The referral as an HL7 v2 REF^I12 message, the form Malaffi asks every referral to arrive in
// (Circular 2026/144: priority and a SNOMED-coded specialty). Malaffi's own REF profile is not
// public, so this is a draft mapping for the partner facility's record system to send.
export interface RefInput {
  messageId: string
  sentAt: string // ISO date-time
  patientId: string
  referralId: string
  referredOn: string // ISO date
  specialty: Specialty
  priority: 'routine' | 'urgent'
  reason: string
  orderingFacility: string
}

const ts = (iso: string) => iso.replace(/[-:T]/g, '').slice(0, 14)
const esc = (s: string) => s.replace(/\\/g, '\\E\\').replace(/\|/g, '\\F\\').replace(/\^/g, '\\S\\').replace(/&/g, '\\T\\').replace(/~/g, '\\R\\')

export function refMessage(r: RefInput): string {
  const sp = SPECIALTY[r.specialty]
  const pr = r.priority === 'urgent' ? 'S^Stat' : 'R^Routine'
  return [
    `MSH|^~\\&|SPOKEN-CHECK|${esc(r.orderingFacility)}|MALAFFI|ADHIE|${ts(r.sentAt)}||REF^I12^REF_I12|${esc(r.messageId)}|P|2.5`,
    `RF1|P^Pending|${pr}|${sp.code}^${sp.display}^SCT||O^Outpatient|${esc(r.referralId)}|${ts(r.referredOn)}`,
    `PID|1||${esc(r.patientId)}^^^${esc(r.orderingFacility)}^MR`,
    `NTE|1||${esc(r.reason)}`,
  ].join('\r')
}
