import { matchWithRest } from './match'
import type { Lang } from './lexicon'

export type Heard = 'both' | 'one' | 'none'

export interface ItemResult { row: number; label: string; heard: Heard; by: string[] }

export interface RangeScore {
  /** Count confirmed: heard by every recogniser when there are two, by at least two when there are more. */
  low: number
  /** Count at least one recogniser heard. */
  high: number
  items: ItemResult[]
  /** False when the recognisers disagree on too many items to use the session. */
  scored: boolean
  recognisers: string[]
  /** Words a recogniser heard that are not in the accepted list. Never scored; kept for review of the list. */
  unmatched: string[]
}

/** A session is not scored when the range is wider than this share of the high count (and more than two items). */
export const MAX_RANGE_SHARE = 0.34

/**
 * Scores one task from each recogniser's transcript of the same clip. Every item is marked
 * heard by both, by one or by neither, so the score is a range and never a single guess.
 * With one recogniser the range has zero width and the caller must say only one listened.
 */
export function scoreTask(transcripts: Record<string, string>, rows: string[][], lang: Lang): RangeScore {
  const names = Object.keys(transcripts)
  const matches = names.map((n) => matchWithRest(transcripts[n], rows, lang))
  const sets = matches.map((m) => m.found)
  const unmatched = [...new Set(matches.flatMap((m) => m.unmatched))]
  const items: ItemResult[] = []
  rows.forEach((row, i) => {
    const by = names.filter((_, k) => sets[k].has(i))
    // 'both' means confirmed: by two listeners or more. With a single listener the range has no width.
    if (by.length) items.push({ row: i, label: row[0], heard: names.length === 1 || by.length >= 2 ? 'both' : 'one', by })
  })
  const high = items.length
  const low = items.filter((it) => it.heard === 'both').length
  const width = high - low
  const scored = width <= 2 || width <= MAX_RANGE_SHARE * high
  return { low, high, items, scored, recognisers: names, unmatched }
}
