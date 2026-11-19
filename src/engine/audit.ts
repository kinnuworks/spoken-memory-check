import { version } from '../../package.json'

// A local record of every decision a physician makes on a packet, so a dismissal and its reason
// are kept, not only shown. In a pilot this goes to the facility's own record system.
export const APP_VERSION = version

export interface AuditEntry { at: string; case: string; action: 'approved' | 'dismissed' | 'result given in person' | 'specialist seen'; detail?: string; appVersion: string }

const KEY = 'smc.audit.v1'

export function loadAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AuditEntry[] } catch { return [] }
}

export function appendAudit(e: Omit<AuditEntry, 'at' | 'appVersion'>, now = new Date()): AuditEntry[] {
  const all = [...loadAudit(), { ...e, at: now.toISOString(), appVersion: APP_VERSION }]
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* shown but not kept */ }
  return all
}

/** The fixed invitation the person receives once their physician approves a packet. */
export const INVITE = 'Your screening clinic would like to see you to talk about your memory checks. This is a routine follow-up visit. Please book an appointment with your physician.'

/** The invitation this case's person received, if a physician approved: the edited wording when there was one. */
export function invitationFor(caseId: string, log: AuditEntry[] = loadAudit()): string | null {
  const a = [...log].reverse().find((e) => e.case === caseId && (e.action === 'approved' || e.action === 'dismissed'))
  if (!a || a.action !== 'approved') return null
  return a.detail?.startsWith('invitation edited: ') ? a.detail.slice('invitation edited: '.length) : INVITE
}
