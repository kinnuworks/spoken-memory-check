import { describe, expect, it } from 'vitest'
import { ANIMALS, WORD_LISTS } from './lexicon'
import { foldArabic, matchClosedSet, matchWithRest, tokens } from './match'

const rowsOf = (words: string[]) => words.map((w) => [w])
const labels = (found: Set<number>, rows: string[][]) => [...found].map((i) => rows[i][0]).sort()
// The bench's closed set: Arabic digit words zero to nine.
const DIGITS: string[][] = [['صفر'], ['واحد', 'واحدة'], ['اثنان', 'اثنين'], ['ثلاثة', 'ثلاث'], ['أربعة', 'أربع'], ['خمسة', 'خمس'], ['ستة', 'ست'], ['سبعة', 'سبع'], ['ثمانية', 'ثماني', 'ثمان'], ['تسعة', 'تسع']]
const LIST1 = rowsOf(WORD_LISTS.ar[0]), LIST2 = rowsOf(WORD_LISTS.ar[1])

describe('Arabic near misses', () => {
  it('folds letters the speech model swaps, and feminine endings', () => {
    expect(foldArabic('صفر')).toBe(foldArabic('سفر'))
    expect(foldArabic(tokens('ثمانية', 'ar')[0])).toBe(foldArabic('سمانيا'))
  })
  it('accepts near misses seen on real recordings', () => {
    // Each of these is a transcript the on-device model produced for the digit in the comment.
    expect(labels(matchClosedSet('سفر', DIGITS, 'ar'), DIGITS)).toEqual(['صفر']) // zero
    expect(labels(matchClosedSet('سمانيا', DIGITS, 'ar'), DIGITS)).toEqual(['ثمانية']) // eight
    expect(labels(matchClosedSet('خمتة', DIGITS, 'ar'), DIGITS)).toEqual(['خمسة']) // five, one letter off
    expect(labels(matchClosedSet('سبا', DIGITS, 'ar'), DIGITS)).toEqual(['سبعة']) // seven: سبع is four letters folded, so a three-letter slip may match it
    expect(labels(matchClosedSet('سلاتة', DIGITS, 'ar'), DIGITS)).toEqual(['ثلاثة']) // three
    expect(labels(matchClosedSet('تسعى', DIGITS, 'ar'), DIGITS)).toEqual(['تسعة']) // nine
  })
  it('accepts a one-letter slip on a word-list word', () => {
    expect(labels(matchClosedSet('شمعه حديقه طبيت', LIST1, 'ar'), LIST1)).toEqual(['حديقة', 'شمعة', 'طبيب'])
  })
  it('keeps exact matching unchanged', () => {
    expect(labels(matchClosedSet('نهر قلم جسر', LIST1, 'ar'), LIST1)).toEqual(['جسر', 'قلم', 'نهر'])
    expect(matchWithRest('نهر بيت', LIST1, 'ar').unmatched).toEqual(['بيت'])
  })
  it('leaves English unchanged', () => {
    const list = rowsOf(WORD_LISTS.en[0])
    expect(matchClosedSet('rivers candel doctr', list, 'en').size).toBe(1)
  })
})

describe('Arabic near-miss false-accept guards', () => {
  it('never stretches short words: three letters or fewer need an exact or folded match', () => {
    // نام for نعم, نمر for نهر, جزر for جسر: one letter off, but too short to trust.
    expect(matchClosedSet('نمر جزر سلم نار', LIST1, 'ar').size).toBe(0)
    expect(matchClosedSet('نام', [['نعم'], ['لا']], 'ar').size).toBe(0)
  })
  it('needs the first letter to agree', () => {
    expect(matchClosedSet('حمسة', DIGITS, 'ar').size).toBe(0)
    // أبدا is one letter from زبدة once the ending is folded.
    expect(matchClosedSet('أبدا', LIST1, 'ar').size).toBe(0)
  })
  it('matches nothing when a word is near two rows', () => {
    const rows = [['كتاب'], ['كتاف']]
    expect(matchClosedSet('كتان', rows, 'ar').size).toBe(0)
  })
  it('uses only folding, not one-letter slips, on the large animal set', () => {
    // These are everyday words one letter from an animal: coffee/cat, belt/dove, bicycle/hen.
    expect(matchClosedSet('قهوة حزام دراجة غسالة طائرة', ANIMALS.ar, 'ar').size).toBe(0)
  })
  it('does not match common nouns to list words', () => {
    const others = 'بيت كتاب سيارة شجرة مدرسة باب كرسي شارع كوب حذاء طاولة ماء صباح شمس قمر جبل مطر رمل ورقة وردة خبز حليب شاي قهوة ساعة هاتف صحن ملعقة سكين حقيبة مسجد سوق مطعم قطار'
    expect(matchClosedSet(others, LIST1, 'ar').size).toBe(0)
    expect(matchClosedSet(others, LIST2, 'ar').size).toBe(0)
  })
  it('does not match words of one list to the other list', () => {
    expect(matchClosedSet(WORD_LISTS.ar[0].join(' '), LIST2, 'ar').size).toBe(0)
    expect(matchClosedSet(WORD_LISTS.ar[1].join(' '), LIST1, 'ar').size).toBe(0)
  })
  it('does not match list words to animals or animals to list words', () => {
    for (const list of WORD_LISTS.ar) expect(matchClosedSet(list.join(' '), ANIMALS.ar, 'ar').size).toBe(0)
    // Single-word animal forms only: فرس النهر contains نهر and matches it exactly, as before.
    const animalWords = ANIMALS.ar.flat().filter((f) => !f.includes(' ')).join(' ')
    expect(matchClosedSet(animalWords, LIST1, 'ar').size).toBe(0)
    expect(matchClosedSet(animalWords, LIST2, 'ar').size).toBe(0)
  })
})

describe('Arabic word forms', () => {
  const list = WORD_LISTS.ar[0].map((w) => [w])
  const animals = ANIMALS.ar
  const row = (w: string) => animals.findIndex((r) => r.includes(w))

  it('accepts the accusative ending on a list word, even a three-letter one', () => {
    const i = list.findIndex((r) => r[0] === 'جسر')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(matchClosedSet('نهر جسرا', list, 'ar').has(i)).toBe(true)
  })

  it('accepts a dropped feminine ending, in the large animal set too', () => {
    expect(matchClosedSet('زراف', animals, 'ar').has(row('زرافة'))).toBe(true)
    expect(matchClosedSet('ناق', animals, 'ar').has(row('ناقة'))).toBe(true)
  })

  it('does not stretch either rule to other changes', () => {
    // A letter dropped from the middle, or an ending added to a word not on the list, still fails in the animal set.
    expect(matchWithRest('زافة', animals, 'ar').found.size).toBe(0)
    expect(matchWithRest('كرسيا', list, 'ar').found.size).toBe(0)
    expect(matchWithRest('في', animals, 'ar').found.size).toBe(0)
  })
})
