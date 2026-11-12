// Blind re-scoring: one recorded check in ten is picked at random and a second person
// scores it without seeing the machine's result. The programme then sees how often the
// person and the machine agree, by language, and spots drift early.

export const REVIEW_RATE = 10

/** Picks about one check in REVIEW_RATE, the same way every time for the same check id. */
export function pickForReview(checkId: string, rate = REVIEW_RATE): boolean {
  let h = 0x811c9dc5
  for (let i = 0; i < checkId.length; i++) { h ^= checkId.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h % rate === 0
}

export interface Comparison { both: number[]; humanOnly: number[]; machineOnly: number[]; agreement: number }

/** Compares the item rows each side heard. Agreement is items both heard over items either heard. */
export function compareRows(human: number[], machine: number[]): Comparison {
  const h = new Set(human), m = new Set(machine)
  const both = [...h].filter((x) => m.has(x))
  const humanOnly = [...h].filter((x) => !m.has(x))
  const machineOnly = [...m].filter((x) => !h.has(x))
  const union = both.length + humanOnly.length + machineOnly.length
  return { both, humanOnly, machineOnly, agreement: union ? both.length / union : 1 }
}

export interface Review { date: string; lang: 'en' | 'ar'; clip: string; human: number; machine: number; agreement: number }

const KEY = 'blind-reviews'
export function loadReviews(): Review[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Review[] } catch { return [] }
}
export function saveReview(r: Review): Review[] {
  const all = [...loadReviews(), r]
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* keep in memory */ }
  return all
}

/** Running agreement by language over the reviews so far. */
export function tally(reviews: Review[]) {
  return (['en', 'ar'] as const).map((lang) => {
    const rs = reviews.filter((r) => r.lang === lang)
    const mean = (f: (r: Review) => number) => (rs.length ? rs.reduce((a, r) => a + f(r), 0) / rs.length : null)
    return { lang, n: rs.length, agreement: mean((r) => r.agreement), countGap: mean((r) => r.machine - r.human) }
  })
}
