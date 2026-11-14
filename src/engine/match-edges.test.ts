import { describe, expect, it } from 'vitest'
import { NEAR_MAX_ROWS, foldArabic, matchWithRest, tokens } from './match'

// Boundaries of the word matcher, written so that a small change to a rule makes a test fail.
describe('English word forms', () => {
  it('reduces plurals only where the rule says, by length', () => {
    expect(tokens('flies ponies', 'en')).toEqual(['fly', 'pony'])
    expect(tokens('ies', 'en')).toEqual(['ies']) // three letters: never shortened
    expect(tokens('foxes boxes', 'en')).toEqual(['fox', 'box'])
    expect(tokens('axes', 'en')).toEqual(['axe']) // four letters: too short for the -xes rule
    expect(tokens('cats dogs', 'en')).toEqual(['cat', 'dog'])
    expect(tokens('cats', 'en')).toEqual(['cat'])
    expect(tokens('bus gas', 'en')).toEqual(['bus', 'gas']) // three letters: never shortened
    expect(tokens('glass', 'en')).toEqual(['glass'])
    expect(tokens('octopus', 'en')).toEqual(['octopus'])
  })

  it('drops case, digits and punctuation, and splits on every separator', () => {
    expect(tokens('Cat,DOG.horse;cow:goat!sheep?camel-lion', 'en')).toEqual(['cat', 'dog', 'horse', 'cow', 'goat', 'sheep', 'camel', 'lion'])
    expect(tokens('  ', 'en')).toEqual([])
  })
})

describe('Arabic word forms', () => {
  it('drops "al-" only from words longer than four letters', () => {
    expect(tokens('الباب', 'ar')).toEqual(['باب'])
    expect(tokens('الفل', 'ar')).toEqual(['الفل'])
  })

  it('writes a final taa marbuta as haa only on words longer than three letters', () => {
    expect(tokens('مدرسة', 'ar')).toEqual(['مدرسه'])
    expect(tokens('مرة', 'ar')).toEqual(['مرة'])
    expect(tokens('ةلمب', 'ar')).toEqual(['ةلمب'])
  })

  it('folds alef, ya, waw and hamza seats, and drops marks', () => {
    expect(tokens('أسد إبل آمن مستشفى سؤال بئر كَلْب', 'ar')).toEqual(['اسد', 'ابل', 'امن', 'مستشفي', 'سوال', 'بير', 'كلب'])
    expect(tokens('أرنب،قطة؛فيل؟', 'ar')).toEqual(['ارنب', 'قطة', 'فيل'])
  })

  it('folds swapped letters in both directions of a pair', () => {
    expect(foldArabic('صقر')).toBe(foldArabic('سقر'))
    expect(foldArabic('ثعلب')).toBe('سعلب')
    expect(foldArabic('ضب')).toBe('دب')
    expect(foldArabic('ذئب')).toBe('زئب')
    expect(foldArabic('ظبي')).toBe('زبي')
    expect(foldArabic('بطه')).toBe('بته')
  })

  it('evens out the last letter only on words longer than two letters', () => {
    expect(foldArabic('قطا')).toBe('قته')
    expect(foldArabic('ها')).toBe('ها')
  })
})

describe('closed-set matching', () => {
  it('counts a row once however often it is said', () => {
    const r = matchWithRest('cat cat cats', [['cat'], ['dog']], 'en')
    expect([...r.found]).toEqual([0])
    expect(r.unmatched).toEqual([])
  })

  it('does not let a long form and its part both count', () => {
    const r = matchWithRest('polar bear', [['bear'], ['polar bear']], 'en')
    expect([...r.found]).toEqual([1])
  })

  it('needs every word of a long form, in order', () => {
    expect([...matchWithRest('bear polar', [['polar bear']], 'en').found]).toEqual([])
    expect(matchWithRest('polar fox', [['polar bear']], 'en').unmatched).toEqual(['polar', 'fox'])
  })

  it('ignores an empty accepted form', () => {
    expect([...matchWithRest('cat', [[''], ['cat']], 'en').found]).toEqual([1])
  })

  it('reports words that matched nothing, each once', () => {
    expect(matchWithRest('cat tree tree', [['cat']], 'en').unmatched).toEqual(['tree'])
  })

  it('tries near misses only on words left over, and spends the word', () => {
    const rows = [['كتاب'], ['كرسي']]
    expect([...matchWithRest('كتاب كتاب', rows, 'ar').found]).toEqual([0])
    // "كتان" is one letter from "كتاب": accepted in a small set.
    expect([...matchWithRest('كتان', rows, 'ar').found]).toEqual([0])
    expect(matchWithRest('كتان', rows, 'ar').unmatched).toEqual([])
  })

  it('treats a set of exactly the limit as small, and one more as large', () => {
    const mk = (n: number) => [['كتاب'], ...Array.from({ length: n - 1 }, (_, i) => [`زز${'ابتثجحخدذرزسشصضطظعغفقكلم'[i]}زز`])]
    expect([...matchWithRest('كتان', mk(NEAR_MAX_ROWS), 'ar').found]).toEqual([0])
    expect([...matchWithRest('كتان', mk(NEAR_MAX_ROWS + 1), 'ar').found]).toEqual([])
  })

  it('accepts one letter added or dropped, at the end or in the middle, but not two', () => {
    const rows = [['مدرسة'], ['شجرة']]
    expect([...matchWithRest('مدرسهن', rows, 'ar').found]).toEqual([0]) // one added at the end
    expect([...matchWithRest('مدرس', rows, 'ar').found]).toEqual([0]) // one dropped at the end
    expect([...matchWithRest('مدسه', rows, 'ar').found]).toEqual([0]) // one dropped in the middle
    expect([...matchWithRest('مكرسه', rows, 'ar').found]).toEqual([0]) // one changed
    expect([...matchWithRest('مدرسات', rows, 'ar').found]).toEqual([]) // two changed
    expect([...matchWithRest('مدرسيات', rows, 'ar').found]).toEqual([])
  })
})
