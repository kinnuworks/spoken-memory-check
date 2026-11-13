// Consent is asked for in separate parts, each off until the person turns it on, and each
// can be withdrawn at any time. The receipt records what was agreed and when.
export interface Consent { takeChecks: boolean; sharePhysician: boolean; keepClips: boolean; cloudListener: boolean; updated: string | null }

export const NO_CONSENT: Consent = { takeChecks: false, sharePhysician: false, keepClips: false, cloudListener: false, updated: null }
const KEY = 'smc.consent.v1'

export function loadConsent(): Consent {
  try { return { ...NO_CONSENT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return NO_CONSENT }
}

export function saveConsent(c: Consent): Consent {
  // Keeping clips for the physician makes no sense without sharing with the physician.
  const next = { ...c, keepClips: c.keepClips && c.sharePhysician, updated: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* shown but not kept */ }
  return next
}
