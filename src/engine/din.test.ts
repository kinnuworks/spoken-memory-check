import { describe, expect, it } from 'vitest'
import { DIN, classify, isCorrect, nextSnr, srt, triplet, type DinTrial } from './din'
import { rng } from './simulate'

const trial = (snr: number, correct: boolean): DinTrial => ({ digits: [1, 2, 3], answer: correct ? [1, 2, 3] : [1, 2, 4], snr, correct })

describe('digits-in-noise', () => {
  it('draws three different digits and never seven', () => {
    const r = rng(1)
    for (let i = 0; i < 200; i++) {
      const t = triplet(r)
      expect(new Set(t).size).toBe(3)
      expect(t).not.toContain(7)
    }
  })

  it('counts a triplet only when every digit is right and in order', () => {
    expect(isCorrect([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(isCorrect([1, 2, 3], [3, 2, 1])).toBe(false)
    expect(isCorrect([1, 2, 3], [1, 2])).toBe(false)
  })

  it('makes the digits quieter after a right answer and louder after a wrong one, within limits', () => {
    expect(nextSnr(0, true)).toBe(-DIN.step)
    expect(nextSnr(0, false)).toBe(DIN.step)
    expect(nextSnr(DIN.minSnr, true)).toBe(DIN.minSnr)
    expect(nextSnr(DIN.maxSnr, false)).toBe(DIN.maxSnr)
  })

  it('averages the counted trials and the next level', () => {
    // Alternating right and wrong around -8 dB settles the threshold near -8 dB.
    const trials: DinTrial[] = [trial(0, true), trial(-2, true), trial(-4, true)]
    let snr = -6
    for (let i = 0; i < 20; i++) { const ok = i % 2 === 0; trials.push(trial(snr, ok)); snr = nextSnr(snr, ok) }
    expect(srt(trials)).toBeCloseTo(-7, 0)
  })

  it('has no result before enough trials', () => {
    expect(Number.isNaN(srt([trial(0, true)]))).toBe(true)
  })

  it('refers only above the provisional cut-off', () => {
    expect(classify(DIN.referAbove + 0.5)).toBe('refer')
    expect(classify(DIN.referAbove - 0.5)).toBe('pass')
  })

  it('a simulated listener with a worse threshold gets a worse result', () => {
    const run = (threshold: number, seed: number) => {
      const r = rng(seed)
      const trials: DinTrial[] = []
      let snr = DIN.startSnr
      for (let i = 0; i < DIN.trials; i++) {
        const p = 1 / (1 + Math.exp(-(snr - threshold) / 1.2))
        const ok = r() < p
        trials.push(trial(snr, ok))
        snr = nextSnr(snr, ok)
      }
      return srt(trials)
    }
    const good = [1, 2, 3, 4, 5].map((s) => run(-10, s))
    const poor = [1, 2, 3, 4, 5].map((s) => run(-2, s))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(good)).toBeLessThan(mean(poor) - 5)
    expect(classify(mean(good))).toBe('pass')
    expect(classify(mean(poor))).toBe('refer')
  })
})
