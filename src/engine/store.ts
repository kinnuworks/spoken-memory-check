import type { Check } from './change'
import type { Lang } from './lexicon'

// The person's own checks stay on this device, in the browser's storage.
export interface StoredCheck extends Check {
  lang: Lang
  list: number
  parts: { immediate: [number, number]; delayed: [number, number]; animals: [number, number] }
  recognisers: string[]
}

const KEY = 'smc.checks.v1'

export function loadChecks(): StoredCheck[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveCheck(c: StoredCheck): void {
  try { localStorage.setItem(KEY, JSON.stringify([...loadChecks(), c])) } catch { /* storage unavailable: the check is shown but not kept */ }
}

export function clearChecks(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}
