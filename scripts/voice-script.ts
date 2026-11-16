// What every synthetic recording on the site says, and where it goes. Shared by
// scripts/make-voice-audio.ts (Azure voices) and scripts/make-open-voice-audio.ts (open voices),
// so both make exactly the same set. The recorded check page scores the listeners against these lists.
import { ANIMALS, WORD_LISTS, type Lang } from '../src/engine/lexicon'
import { matchClosedSet } from '../src/engine/match'

export const LANGS: Lang[] = ['en', 'ar']

export const SCRIPT: Record<Lang, { recall1: string[]; animals: string[]; recall2: string[]; answer: string; twenty: string[]; digits: string[] }> = {
  en: {
    recall1: ['river', 'candle', 'window', 'garden', 'carpet', 'bridge', 'mirror', 'jacket'],
    animals: ['dog', 'cat', 'horse', 'cow', 'lion', 'tiger', 'elephant', 'giraffe', 'camel', 'monkey', 'rabbit', 'eagle', 'shark', 'sheep'],
    recall2: ['river', 'window', 'garden', 'mirror', 'candle', 'butter'],
    answer: 'No.',
    twenty: ['dog', 'cat', 'horse', 'cow', 'sheep', 'goat', 'camel', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'bear', 'wolf', 'fox', 'rabbit', 'eagle', 'shark', 'snake'],
    digits: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  },
  ar: {
    recall1: ['نهر', 'شمعة', 'نافذة', 'حديقة', 'كرسي', 'جسر', 'مرآة', 'معطف'],
    animals: ['جمل', 'حصان', 'قطة', 'كلب', 'أسد', 'نمر', 'فيل', 'زرافة', 'غزال', 'صقر', 'سمكة', 'بقرة', 'خروف', 'ثعلب'],
    recall2: ['نهر', 'نافذة', 'حديقة', 'مرآة', 'شمعة', 'زبدة'],
    answer: 'لا.',
    twenty: ['جمل', 'حصان', 'كلب', 'قطة', 'بقرة', 'خروف', 'ماعز', 'حمار', 'أسد', 'نمر', 'فيل', 'زرافة', 'قرد', 'دب', 'ذئب', 'ثعلب', 'غزال', 'أرنب', 'صقر', 'سمكة'],
    digits: ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'],
  },
}
/**
 * Vowelled spellings for voices that read Arabic through espeak-ng, which guesses badly without vowel
 * marks. Standard Modern Standard Arabic vowelling of common nouns; the page still scores against the
 * plain words above.
 */
export const SPOKEN_AR: Record<string, string> = {
  'نهر': 'نَهْر', 'شمعة': 'شَمْعَة', 'طبيب': 'طَبِيب', 'نافذة': 'نَافِذَة', 'حديقة': 'حَدِيقَة', 'قلم': 'قَلَم', 'جسر': 'جِسْر',
  'زبدة': 'زُبْدَة', 'معطف': 'مِعْطَف', 'مرآة': 'مِرْآة', 'كرسي': 'كُرْسِيّ',
  'جمل': 'جَمَل', 'حصان': 'حِصَان', 'قطة': 'قِطَّة', 'كلب': 'كَلْب', 'أسد': 'أَسَد', 'نمر': 'نَمِر', 'فيل': 'فِيل', 'زرافة': 'زَرَافَة',
  'غزال': 'غَزَال', 'صقر': 'صَقْر', 'سمكة': 'سَمَكَة', 'بقرة': 'بَقَرَة', 'خروف': 'خَرُوف', 'ثعلب': 'ثَعْلَب', 'ماعز': 'مَاعِز',
  'حمار': 'حِمَار', 'قرد': 'قِرْد', 'دب': 'دُبّ', 'ذئب': 'ذِئْب', 'أرنب': 'أَرْنَب',
  'صفر': 'صِفْر', 'واحد': 'وَاحِد', 'اثنان': 'اِثْنَان', 'ثلاثة': 'ثَلَاثَة', 'أربعة': 'أَرْبَعَة', 'خمسة': 'خَمْسَة', 'ستة': 'سِتَّة',
  'سبعة': 'سَبْعَة', 'ثمانية': 'ثَمَانِيَة', 'تسعة': 'تِسْعَة', 'لا.': 'لَا.',
}

export const DIN_DIGITS = [1, 2, 3, 4, 5, 6, 8, 9]
/** Pauses between words, in milliseconds, as a person recalling them would leave. */
export const GAPS = [900, 1300, 700, 1600, 1000, 800, 1400, 1100, 1200, 900, 1500, 800, 1000, 1300]
/** Speaking-rate changes, in percent, for the ten words said back, so the answer key is not ten identical takes. */
export const RATE_STEPS = [-5, 4, -10, 8, 0, -7, 6, 2, -3, 10]

export interface Job {
  out: string
  lang: Lang
  /** Said in order, with GAPS between them when there is more than one. */
  words: string[]
  ratePct: number
  sampleRate: 16000 | 22050
  /** Trim silence at both ends (single words). */
  trim: boolean
}

export function jobs(): Job[] {
  const out: Job[] = []
  for (const lang of LANGS) {
    const s = SCRIPT[lang], dir = `public/samples/full/${lang}`
    WORD_LISTS[lang][0].forEach((w, i) => out.push({ out: `${dir}/reg-${String(i + 1).padStart(2, '0')}.wav`, lang, words: [w], ratePct: RATE_STEPS[i], sampleRate: 16000, trim: true }))
    out.push({ out: `${dir}/recall-1.wav`, lang, words: s.recall1, ratePct: -3, sampleRate: 16000, trim: false })
    out.push({ out: `${dir}/animals.wav`, lang, words: s.animals, ratePct: 0, sampleRate: 16000, trim: false })
    out.push({ out: `${dir}/recall-2.wav`, lang, words: s.recall2, ratePct: -6, sampleRate: 16000, trim: false })
    out.push({ out: `${dir}/answer.wav`, lang, words: [s.answer], ratePct: 0, sampleRate: 16000, trim: false })
    out.push({ out: `public/samples/synthetic-voice-animals-${lang}.wav`, lang, words: s.twenty, ratePct: 0, sampleRate: 16000, trim: false })
    for (const d of DIN_DIGITS) out.push({ out: `public/din/${lang}/${d}.wav`, lang, words: [s.digits[d]], ratePct: 0, sampleRate: 22050, trim: true })
  }
  return out
}

/** Every word said for the animal tasks must be an accepted animal, each a different one; recall words come from list 1. */
export function checkScripts() {
  for (const lang of LANGS) {
    for (const [name, words] of [['animals', SCRIPT[lang].animals], ['twenty', SCRIPT[lang].twenty]] as const) {
      const rows = matchClosedSet(words.join(' '), ANIMALS[lang], lang)
      if (rows.size !== words.length) throw new Error(`${lang} ${name}: ${words.length} animals said but ${rows.size} distinct accepted animals`)
    }
    const list = WORD_LISTS[lang][0]
    for (const w of [...SCRIPT[lang].recall1, ...SCRIPT[lang].recall2]) if (!list.includes(w) && w !== SCRIPT[lang].recall1[4]) throw new Error(`${lang}: ${w} is not on list 1`)
  }
}
