import { describe, expect, it } from 'vitest'
import { SR, addConfirmed, classify, dtw, features, fft, melFilterbank, mfcc, segment, spot, trimSilence, type Features } from './templates'

/** A synthetic "word": a sequence of harmonic tones (Hz, seconds) with a short fade on each. */
function word(parts: [number, number][], speed = 1, amp = 0.3): Float32Array {
  const total = parts.reduce((s, [, d]) => s + Math.round(d * speed * SR), 0)
  const out = new Float32Array(total)
  let o = 0, phase = 0
  for (const [hz, d] of parts) {
    const n = Math.round(d * speed * SR)
    for (let i = 0; i < n; i++) {
      phase += (2 * Math.PI * hz) / SR
      const env = Math.min(1, i / 200, (n - i) / 200)
      out[o + i] = amp * env * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase))
    }
    o += n
  }
  return out
}
const silence = (s: number) => new Float32Array(Math.round(s * SR))
function concat(...xs: Float32Array[]): Float32Array {
  const out = new Float32Array(xs.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of xs) { out.set(x, o); o += x.length }
  return out
}
function noisy(x: Float32Array, level: number, seed = 1): Float32Array {
  let s = seed
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5
  return x.map((v) => v + level * r())
}

const A: [number, number][] = [[220, 0.15], [440, 0.2], [330, 0.15]]
const B: [number, number][] = [[600, 0.2], [300, 0.15], [900, 0.15]]
const C: [number, number][] = [[150, 0.25], [1200, 0.25]]

describe('signal maths', () => {
  it('puts a pure tone in the right FFT bin', () => {
    const n = 512, re = new Float64Array(n), im = new Float64Array(n)
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 32 * i) / n)
    fft(re, im)
    const mag = Array.from(re, (v, i) => Math.hypot(v, im[i]))
    expect(mag.indexOf(Math.max(...mag.slice(0, n / 2)))).toBe(32)
    expect(mag[32]).toBeCloseTo(n / 2, 6)
  })

  it('builds 26 non-negative mel filters peaking at 1', () => {
    const fb = melFilterbank()
    expect(fb).toHaveLength(26)
    for (const w of fb) {
      expect(Math.min(...w)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...w)).toBeLessThanOrEqual(1)
      expect(Math.max(...w)).toBeGreaterThan(0.3)
    }
  })

  it('gives 13 coefficients every 10 ms', () => {
    const f = mfcc(word(A))
    expect(f.dim).toBe(13)
    expect(f.n).toBe(1 + Math.floor((0.5 * SR - 400) / 160))
    expect(f.data.every(Number.isFinite)).toBe(true)
  })

  it('trims leading and trailing silence', () => {
    const w = word(A)
    const t = trimSilence(concat(silence(0.4), noisy(w, 0.001), silence(0.6)))
    expect(Math.abs(t.length - w.length)).toBeLessThan(0.12 * SR)
  })

  it('gives mean-normalised features with deltas (26 per frame)', () => {
    const f = features(word(B))
    expect(f.dim).toBe(26)
    let mean = 0
    for (let t = 0; t < f.n; t++) mean += f.data[t * 26]
    expect(Math.abs(mean / f.n)).toBeLessThan(1e-4)
  })
})

describe('dynamic time warping', () => {
  const fa = features(word(A)), fb = features(word(B))

  it('costs zero for identical clips', () => {
    expect(dtw(fa, fa)).toBe(0)
  })

  it('matches a time-stretched copy better than a different word', () => {
    const slow = features(word(A, 1.25)), fast = features(word(A, 0.8))
    expect(dtw(fa, slow)).toBeLessThan(dtw(fa, fb))
    expect(dtw(fa, fast)).toBeLessThan(dtw(fa, fb))
    expect(dtw(fa, slow)).toBeLessThan(0.5 * dtw(fa, fb))
  })

  it('is symmetric', () => {
    const slow = features(word(A, 1.2))
    expect(dtw(fa, slow)).toBeCloseTo(dtw(slow, fa), 9)
  })

  it('refuses pairs with very different lengths', () => {
    const tiny: Features = { data: fa.data.slice(0, 26 * 5), n: 5, dim: 26 }
    expect(dtw(fa, tiny)).toBe(Infinity)
  })
})

describe('classify and spot', () => {
  // Templates come from recordings with silence either side, as a registration trial would.
  const said = (parts: [number, number][], speed = 1) => concat(silence(0.25), word(parts, speed), silence(0.25))
  const templates = { a: [features(said(A))], b: [features(said(B))], c: [features(said(C))] }

  it('names the right word for a noisy, stretched repeat', () => {
    for (const [name, parts] of [['a', A], ['b', B], ['c', C]] as const) {
      const r = classify(templates, features(noisy(word(parts, 1.15), 0.01)), { maxCost: Infinity, minMargin: 0 })
      expect(r.word).toBe(name)
      expect(r.margin).toBeGreaterThan(0.1)
    }
  })

  it('rejects a sound unlike any template when thresholds are set', () => {
    const other = features(word([[2500, 0.3], [700, 0.3]]))
    const self = classify(templates, features(noisy(word(A, 1.1), 0.01)), { maxCost: Infinity, minMargin: 0 })
    const r = classify(templates, other, { maxCost: self.cost * 2, minMargin: 0 })
    expect(r.accepted).toBe(false)
  })

  it('splits a recording on pauses', () => {
    const rec = concat(silence(0.3), word(A), silence(0.5), word(B), silence(0.4), word(C), silence(0.3))
    const segs = segment(noisy(rec, 0.002))
    expect(segs).toHaveLength(3)
    expect(segs[0][0]).toBeLessThan(0.35 * SR)
  })

  it('spots the list words said in a longer recording and ignores the others', () => {
    const rec = concat(silence(0.3), word(C, 0.9), silence(0.6), word([[2500, 0.3], [700, 0.3]]), silence(0.5), word(A, 1.1), silence(0.3))
    // Thresholds for these synthetic tones: repeats cost about 2-5, the unrelated sound about 17.
    const found = spot(templates, noisy(rec, 0.002), { maxCost: 8, minMargin: 0.3 })
    expect(found.map((d) => d.word)).toEqual(['c', 'a'])
  })

  it('adds a second recording only for words another listener confirmed, at most two per word', () => {
    const rec = noisy(concat(silence(0.3), word(C, 0.9), silence(0.6), word(A, 1.1), silence(0.3)), 0.002)
    const th = { maxCost: 8, minMargin: 0.3 }
    const out = addConfirmed(templates, rec, new Set(['a']), th)
    expect(out.a).toHaveLength(2)
    expect(out.c).toHaveLength(1)
    expect(templates.a).toHaveLength(1)
    expect(addConfirmed(out, rec, new Set(['a']), th).a).toHaveLength(2)
    expect(addConfirmed(templates, rec, new Set(), th).a).toHaveLength(1)
  })
})
