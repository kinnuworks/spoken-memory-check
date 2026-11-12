// Digits-in-noise hearing test: three spoken digits in noise, the person taps what they heard.
// The noise stays at one level and the digits get quieter after a correct answer and louder
// after a wrong one, so the test settles near the level where half the triplets are right.
// That level, the speech reception threshold (SRT), is the result: lower is better.

export const DIN = {
  digits: [1, 2, 3, 4, 5, 6, 8, 9], // seven is left out: it has two syllables in English
  trials: 23,
  startSnr: 0,
  step: 2,
  minSnr: -24,
  maxSnr: 10,
  /** Fixed by the first trials being far from threshold: the SRT averages trials 4 onwards. */
  firstCounted: 3,
  /**
   * Refer when the SRT is above this. A provisional setting, not a validated cut-off: published
   * cut-offs depend on the recordings and the noise, and must be set on local listeners with
   * normal hearing before any use.
   */
  referAbove: -5.5,
}

export type Outcome = 'pass' | 'refer'

export interface DinTrial { digits: number[]; answer: number[]; snr: number; correct: boolean }

export interface DinResult { date: string; lang: 'en' | 'ar'; srt: number; outcome: Outcome; trials: DinTrial[] }

/** Three different digits. */
export function triplet(rand: () => number): number[] {
  const pool = [...DIN.digits]
  const out: number[] = []
  while (out.length < 3) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return out
}

/** A triplet counts only when all three digits are right, in order. */
export function isCorrect(digits: number[], answer: number[]): boolean {
  return digits.length === answer.length && digits.every((d, i) => d === answer[i])
}

export function nextSnr(snr: number, correct: boolean): number {
  return Math.min(DIN.maxSnr, Math.max(DIN.minSnr, snr + (correct ? -DIN.step : DIN.step)))
}

/** Mean SNR over the counted trials plus the level the next trial would have used. */
export function srt(trials: DinTrial[]): number {
  if (trials.length <= DIN.firstCounted) return NaN
  const levels = trials.slice(DIN.firstCounted).map((t) => t.snr)
  const last = trials[trials.length - 1]
  levels.push(nextSnr(last.snr, last.correct))
  return levels.reduce((a, b) => a + b, 0) / levels.length
}

export function classify(value: number): Outcome {
  return value > DIN.referAbove ? 'refer' : 'pass'
}

const KEY = 'din-results'
export function loadHearing(): DinResult[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as DinResult[] } catch { return [] }
}
export function saveHearing(r: DinResult): DinResult[] {
  const all = [...loadHearing(), r]
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* private mode: keep in memory only */ }
  return all
}
