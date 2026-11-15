// Consent is asked for in separate parts, each off until the person turns it on, and each
// can be withdrawn at any time. The receipt records what was agreed and when.
export interface Consent { takeChecks: boolean; sharePhysician: boolean; keepClips: boolean; cloudListener: boolean; shareFamilyHistory: boolean; shareGenome: boolean; updated: string | null }

export const NO_CONSENT: Consent = { takeChecks: false, sharePhysician: false, keepClips: false, cloudListener: false, shareFamilyHistory: false, shareGenome: false, updated: null }
const KEY = 'smc.consent.v1'

export function loadConsent(): Consent {
  try { return { ...NO_CONSENT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return NO_CONSENT }
}

export function saveConsent(c: Consent): Consent {
  // Clips, family history and genome results go only to the physician, so they need that switch on too.
  const p = c.sharePhysician
  const next = { ...c, keepClips: c.keepClips && p, shareFamilyHistory: c.shareFamilyHistory && p, shareGenome: c.shareGenome && p, updated: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* shown but not kept */ }
  return next
}
