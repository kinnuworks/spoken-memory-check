import { tokens } from './match'
import type { Lang } from './lexicon'

// Reads a spoken yes or no. Anything unclear stays unknown: it is never read as "no".
const YES: Record<Lang, string[]> = { en: ['yes', 'yeah', 'yep', 'yup', 'harder', 'sometimes'], ar: ['نعم', 'ايوه', 'ايوا', 'اي', 'ايه', 'اكيد', 'صح', 'احيانا', 'أحيانا'] }
const NO: Record<Lang, string[]> = { en: ['no', 'nope', 'nah'], ar: ['لا', 'لأ', 'كلا', 'ابدا', 'أبدا'] }

export function readYesNo(text: string, lang: Lang): boolean | undefined {
  const t = new Set(tokens(text, lang))
  const y = YES[lang].some((w) => t.has(tokens(w, lang)[0]))
  const n = NO[lang].some((w) => t.has(tokens(w, lang)[0]))
  if (y && !n) return true
  if (n && !y) return false
  return undefined
}
