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
