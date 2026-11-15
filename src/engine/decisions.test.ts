import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NO_CONSENT, loadConsent, saveConsent } from './consent'
import { riskFactors, treatableContributors } from './packet'
import type { ScreeningRecord } from './histories'
import { loadReviews, saveReview } from './rescore'
import { DIN, classify, isCorrect, loadHearing, nextSnr, saveHearing, srt, triplet, type DinTrial } from './din'

// A small in-memory stand-in for the browser's localStorage.
function stubStorage() {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage
  return m
}

const record: ScreeningRecord = {
  age: 62, sex: 'F', mocaAtVisit: 27, hba1c: 5.6, onMetformin: false, systolic: 128, ldl: 2.9, bmi: 26,
  smoker: false, hearing: 'normal', vision: 'normal', phq9: 3, activeMinutesWeek: 200, schoolingYears: 12,
  familyDementia: { relative: 'none' }, apoeE4Copies: null,
}

describe('consent', () => {
  let store: Map<string, string>
  beforeEach(() => { store = stubStorage() })
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage })

  it('starts with every part off', () => {
    expect(loadConsent()).toEqual(NO_CONSENT)
  })

  it('never keeps clips unless sharing with the physician is also on', () => {
    const c = saveConsent({ ...NO_CONSENT, takeChecks: true, keepClips: true, sharePhysician: false })
    expect(c.keepClips).toBe(false)
    const d = saveConsent({ ...NO_CONSENT, takeChecks: true, keepClips: true, sharePhysician: true })
    expect(d.keepClips).toBe(true)
  })

  it('stamps the time of every change and reads it back', () => {
    const c = saveConsent({ ...NO_CONSENT, takeChecks: true })
    expect(c.updated).not.toBeNull()
    expect(loadConsent()).toEqual(c)
  })

  it('withdrawing a part turns it off', () => {
    saveConsent({ ...NO_CONSENT, takeChecks: true, cloudListener: true })
    expect(saveConsent({ ...loadConsent(), cloudListener: false }).cloudListener).toBe(false)
    expect(loadConsent().cloudListener).toBe(false)
  })

  it('falls back to no consent when the stored value is unreadable', () => {
    store.set('smc.consent.v1', '{not json')
    expect(loadConsent()).toEqual(NO_CONSENT)
  })
})

describe('treatable contributors, checked before anyone concludes decline', () => {
  const names = (r: ScreeningRecord) => treatableContributors(r).map((c) => c.name)

  it('always lists B12, thyroid and medicines', () => {
    expect(names(record)).toEqual(['Vitamin B12', 'Thyroid', 'Medicines'])
  })

  it('points to metformin when B12 is listed for someone taking it', () => {
    const b12 = treatableContributors({ ...record, onMetformin: true })[0]
    expect(b12.why).toMatch(/metformin/)
    expect(b12.action).toMatch(/serum B12/)
  })

  it('adds low mood from PHQ-9 of 10 and above, not 9', () => {
    expect(names({ ...record, phq9: 9 })).not.toContain('Low mood')
    expect(names({ ...record, phq9: 10 })).toContain('Low mood')
  })

  it('adds hearing when audiometry was reduced', () => {
    expect(names({ ...record, hearing: 'reduced' })).toContain('Hearing')
  })

  it('adds sleep apnoea from BMI 30 or systolic 140, and not just below', () => {
    expect(names({ ...record, bmi: 29.9, systolic: 139 })).not.toContain('Sleep apnoea')
    expect(names({ ...record, bmi: 30 })).toContain('Sleep apnoea')
    expect(names({ ...record, systolic: 140 })).toContain('Sleep apnoea')
  })

  it('marks which ones the screening visit already measured', () => {
    const c = treatableContributors({ ...record, phq9: 12, hearing: 'reduced' })
    expect(c.filter((x) => x.inScreening).map((x) => x.name)).toEqual(['Low mood', 'Hearing'])
  })
})

describe('risk factors from the screening record', () => {
  const present = (r: ScreeningRecord) => riskFactors(r).filter((f) => f.present).map((f) => f.name)

  it('finds none in a record with every value in range', () => {
    expect(present(record)).toEqual([])
  })

  it('uses the stated cut-offs, each at its boundary', () => {
    expect(present({ ...record, schoolingYears: 8 })).toContain('Less education')
    expect(present({ ...record, schoolingYears: 9 })).not.toContain('Less education')
    expect(present({ ...record, ldl: 3.4, hba1c: 6.5, systolic: 140, bmi: 30, phq9: 10, activeMinutesWeek: 149 })).toEqual(
      ['High LDL cholesterol', 'Depression', 'Physical inactivity', 'Diabetes', 'Hypertension', 'Obesity'],
    )
    expect(present({ ...record, smoker: true, hearing: 'reduced', vision: 'reduced' })).toEqual(['Hearing loss', 'Smoking', 'Vision loss'])
  })

  it('lists all fourteen, with four the record cannot fill', () => {
    const f = riskFactors(record)
    expect(f).toHaveLength(14)
    expect(f.filter((x) => x.field === null)).toHaveLength(4)
  })
})

describe('hearing check', () => {
  beforeEach(() => { stubStorage() })
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage })

  it('draws three different digits from the allowed set', () => {
    let s = 1
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) {
      const t = triplet(rand)
      expect(new Set(t).size).toBe(3)
      t.forEach((d) => expect(DIN.digits).toContain(d))
    }
  })

  it('counts a triplet right only when all three are in order', () => {
    expect(isCorrect([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(isCorrect([1, 2, 3], [3, 2, 1])).toBe(false)
    expect(isCorrect([1, 2, 3], [1, 2])).toBe(false)
  })

  it('steps down after a right answer and up after a wrong one, within limits', () => {
    expect(nextSnr(0, true)).toBe(-DIN.step)
    expect(nextSnr(0, false)).toBe(DIN.step)
    expect(nextSnr(DIN.minSnr, true)).toBe(DIN.minSnr)
    expect(nextSnr(DIN.maxSnr, false)).toBe(DIN.maxSnr)
  })

  it('has no threshold before the counted trials begin', () => {
    const t: DinTrial[] = Array.from({ length: DIN.firstCounted }, () => ({ digits: [1, 2, 3], answer: [1, 2, 3], snr: 0, correct: true }))
    expect(srt(t)).toBeNaN()
  })

  it('averages the counted trials and the next level', () => {
    const levels = [0, -2, -4, -6, -4, -6, -8]
    const t: DinTrial[] = levels.map((snr, i) => ({ digits: [1, 2, 3], answer: [1, 2, 3], snr, correct: i !== 3 }))
    // counted: -6, -4, -6, -8, plus the next level after a right answer at -8: -10
    expect(srt(t)).toBeCloseTo((-6 - 4 - 6 - 8 - 10) / 5)
  })

  it('refers only above the provisional cut-off', () => {
    expect(classify(DIN.referAbove)).toBe('pass')
    expect(classify(DIN.referAbove + 0.1)).toBe('refer')
  })

  it('keeps every result on the device in order', () => {
    const r = { date: '2026-11-15', lang: 'en' as const, srt: -8, outcome: 'pass' as const, trials: [] }
    saveHearing(r)
    expect(saveHearing({ ...r, date: '2026-11-16' }).map((x) => x.date)).toEqual(['2026-11-15', '2026-11-16'])
    expect(loadHearing()).toHaveLength(2)
  })
})

describe('blind re-scoring store', () => {
  beforeEach(() => { stubStorage() })
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage })

  it('adds each review to the ones before', () => {
    const r = { date: '2026-11-15', lang: 'ar' as const, clip: 'x', human: 8, machine: 7, agreement: 0.8 }
    expect(loadReviews()).toEqual([])
    saveReview(r)
    expect(saveReview({ ...r, clip: 'y' })).toHaveLength(2)
    expect(loadReviews().map((x) => x.clip)).toEqual(['x', 'y'])
  })
})
