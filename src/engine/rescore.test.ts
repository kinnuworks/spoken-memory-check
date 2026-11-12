import { describe, expect, it } from 'vitest'
import { compareRows, pickForReview, tally, type Review } from './rescore'

describe('blind re-scoring', () => {
  it('picks about one check in ten, and the same one every time', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `check-${i}`)
    const picked = ids.filter((id) => pickForReview(id)).length
    expect(picked).toBeGreaterThan(400)
    expect(picked).toBeLessThan(600)
    expect(pickForReview('check-42')).toBe(pickForReview('check-42'))
  })

  it('splits items into heard by both, by the person only and by the machine only', () => {
    const c = compareRows([1, 2, 3, 4], [2, 3, 4, 5])
    expect(c.both).toEqual([2, 3, 4])
    expect(c.humanOnly).toEqual([1])
    expect(c.machineOnly).toEqual([5])
    expect(c.agreement).toBeCloseTo(3 / 5)
  })

  it('counts two empty sides as full agreement', () => {
    expect(compareRows([], []).agreement).toBe(1)
  })

  it('keeps a running figure for each language', () => {
    const r = (lang: 'en' | 'ar', agreement: number, human: number, machine: number): Review => ({ date: '2026-11-13', lang, clip: 'x', human, machine, agreement })
    const t = tally([r('en', 1, 20, 19), r('en', 0.8, 20, 18), r('ar', 0.5, 20, 12)])
    expect(t[0]).toMatchObject({ lang: 'en', n: 2 })
    expect(t[0].agreement).toBeCloseTo(0.9)
    expect(t[0].countGap).toBeCloseTo(-1.5)
    expect(t[1]).toMatchObject({ lang: 'ar', n: 1, agreement: 0.5 })
  })
})
