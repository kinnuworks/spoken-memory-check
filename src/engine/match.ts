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
  return text.split(/[\s,.;:!?،؛-]+/).map(norm).filter(Boolean)
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
  return { found, unmatched: [...new Set(toks.filter((_, i) => !used[i]))] }
}
