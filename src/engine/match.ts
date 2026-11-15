import type { Lang } from './lexicon'

// Arabic: drop diacritics and tatweel, fold alef and ya variants, drop a leading "al-".
function normArabic(w: string): string {
  let s = w.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  if (s.length > 4 && s.startsWith('ال')) s = s.slice(2)
  if (s.length > 3 && s.endsWith('ة')) s = s.slice(0, -1) + 'ه'
  return s
}

function normEnglish(w: string): string {
  let s = w.toLowerCase().replace(/[^a-z]/g, '')
  if (s.length > 3 && s.endsWith('ies')) s = s.slice(0, -3) + 'y'
  else if (s.length > 4 && /(ches|shes|sses|xes)$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss') && !s.endsWith('us')) s = s.slice(0, -1)
  return s
}

export function tokens(text: string, lang: Lang): string[] {
  const norm = lang === 'ar' ? normArabic : normEnglish
  return text.split(/[\s,.;:!?،؛؟-]+/).map(norm).filter(Boolean)
}

// ---- Arabic near misses ----
// On real recordings the speech model often wrote a word one letter off: سفر for صفر, سمانيا for
// ثمانية, حمسة for خمسة. These rules accept such near misses, and only inside a closed set.

/** Letters the model swaps: emphatic and plain pairs, and the interdentals. */
const AR_FOLD: Record<string, string> = { 'ص': 'س', 'ث': 'س', 'ط': 'ت', 'ظ': 'ز', 'ذ': 'ز', 'ض': 'د' }

/** A normalised Arabic token with confusable letters folded and a final ة, ه or ا written as ه. */
export function foldArabic(tok: string): string {
  const s = [...tok].map((c) => AR_FOLD[c] ?? c).join('')
  return s.length > 2 ? s.replace(/[ةها]$/, 'ه') : s
}

/** True when a and b differ by at most one inserted, deleted or changed letter. */
function withinOne(a: string, b: string): boolean {
  const x = [...a], y = [...b]
  if (Math.abs(x.length - y.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (x.length > y.length) i++
    else if (y.length > x.length) j++
    else { i++; j++ }
  }
  return edits + (x.length - i) + (y.length - j) <= 1
}

/** One-letter tolerance applies only to sets this small (the word lists), where a near miss has few neighbours. */
export const NEAR_MAX_ROWS = 12
/** ...and only to accepted forms at least this long after folding. */
export const NEAR_MIN_LETTERS = 4

/**
 * The single row an unmatched Arabic token is a near miss of, or -1. Folded spellings count in
 * any closed set. One changed, added or dropped letter counts only in small sets, only for forms
 * of four letters or more, and only when the first letter agrees. The accusative ending and a dropped
 * feminine ending count in any set. A token close to two rows matches neither.
 */
function nearRow(tok: string, forms: { key: string; row: number }[], small: boolean): number {
  const t = foldArabic(tok)
  const tl = [...t].length
  const rows = new Set<number>()
  // Regular word forms, in any closed set: the accusative ending (جسرا for جسر); a dropped
  // feminine ending, as Gulf speech often says it (زراف for زرافة); the Gulf feminine ending
  // said as -i (قطي for قطة); and "my" on the end of a word (نهري for نهر).
  const n = [...tok].length
  const caseEnding = n >= 4 && tok.endsWith('ا') ? foldArabic(tok.slice(0, -1)) : null
  const noFeminine = n >= 3 ? foldArabic(`${tok}ه`) : null
  // Not after a long vowel: شاي (tea) is not شاة (ewe).
  const iEnding = n >= 3 && /[^اوي]ي$/.test(tok) ? tok.slice(0, -1) : null
  const iFeminine = iEnding ? foldArabic(`${iEnding}ه`) : null
  const mine = iEnding ? foldArabic(iEnding) : null
  for (const f of forms) {
    const k = foldArabic(f.key)
    const feminine = /[هة]$/.test(f.key)
    if (k === t) { rows.add(f.row); continue }
    if (k === caseEnding || k === mine || (feminine && (k === noFeminine || k === iFeminine))) { rows.add(f.row); continue }
    if (!small || [...k].length < NEAR_MIN_LETTERS || tl < NEAR_MIN_LETTERS - 1 || k[0] !== t[0]) continue
    if (withinOne(t, k)) rows.add(f.row)
  }
  return rows.size === 1 ? [...rows][0] : -1
}

/**
 * Finds which rows of a closed set appear in a transcript. Each row is a list of accepted
 * forms; a row counts once however many times or in however many forms it is said.
 * Longest forms are tried first so "polar bear" is not also counted as "bear".
 */
export function matchClosedSet(text: string, rows: string[][], lang: Lang): Set<number> {
  return matchWithRest(text, rows, lang).found
}

/** As matchClosedSet, plus the words that matched nothing, so the accepted list can be reviewed and extended. */
export function matchWithRest(text: string, rows: string[][], lang: Lang): { found: Set<number>; unmatched: string[] } {
  const toks = tokens(text, lang)
  const forms: { key: string[]; row: number }[] = []
  rows.forEach((row, i) => row.forEach((f) => forms.push({ key: tokens(f, lang), row: i })))
  forms.sort((a, b) => b.key.length - a.key.length)
  const used = new Array(toks.length).fill(false)
  const found = new Set<number>()
  for (const { key, row } of forms) {
    if (!key.length) continue
    for (let i = 0; i + key.length <= toks.length; i++) {
      if (used.slice(i, i + key.length).some(Boolean)) continue
      if (key.every((k, j) => toks[i + j] === k)) {
        for (let j = 0; j < key.length; j++) used[i + j] = true
        found.add(row)
      }
    }
  }
  if (lang === 'ar') {
    // Exact matches first; only words left over are tried as near misses, against single-word forms.
    const exact = new Set(forms.flatMap((f) => f.key))
    const single = forms.filter((f) => f.key.length === 1).map((f) => ({ key: f.key[0], row: f.row }))
    const small = rows.length <= NEAR_MAX_ROWS
    toks.forEach((t, i) => {
      if (used[i] || exact.has(t)) return
      const row = nearRow(t, single, small)
      if (row >= 0) { used[i] = true; found.add(row) }
    })
  }
  return { found, unmatched: [...new Set(toks.filter((_, i) => !used[i]))] }
}
