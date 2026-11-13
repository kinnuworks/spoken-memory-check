// Speaker-dependent word spotting: the person's own registration recordings are the answer key.
// MFCC features plus dynamic time warping, no speech-to-text model. Pure TypeScript, no dependencies,
// so the same code runs in the browser and in Node. All audio is mono float samples at 16 kHz.

export const SR = 16000
const FRAME = 400 // 25 ms
const HOP = 160 // 10 ms
const NFFT = 512
const N_MEL = 26
const N_CEP = 13
const PRE_EMPHASIS = 0.97
// Floor on mel energies so digital silence does not produce huge negative log values (about -80 dB re full scale).
const MEL_FLOOR = 1e-4

/** A clip's feature matrix: n frames of dim values, row-major. */
export interface Features { data: Float32Array; n: number; dim: number }

// ---------- Signal maths ----------

/** In-place radix-2 FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n & (n - 1)) throw new Error('fft length must be a power of two')
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr
      }
    }
  }
}

const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700)
const melToHz = (m: number) => 700 * (10 ** (m / 2595) - 1)

/** Triangular mel filters over the NFFT/2+1 power bins. */
export function melFilterbank(nFilters = N_MEL, nfft = NFFT, sr = SR, lo = 20, hi = sr / 2): Float64Array[] {
  const bins = nfft / 2 + 1
  const mLo = hzToMel(lo), mHi = hzToMel(hi)
  const pts = Array.from({ length: nFilters + 2 }, (_, i) => melToHz(mLo + (i * (mHi - mLo)) / (nFilters + 1)) * nfft / sr)
  return Array.from({ length: nFilters }, (_, f) => {
    const w = new Float64Array(bins), l = pts[f], c = pts[f + 1], r = pts[f + 2]
    for (let k = 0; k < bins; k++) {
      if (k > l && k <= c) w[k] = (k - l) / (c - l)
      else if (k > c && k < r) w[k] = (r - k) / (r - c)
    }
    return w
  })
}

const MEL = melFilterbank()
const HAMMING = Float64Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)))
// Orthonormal DCT-II rows 0..N_CEP-1 over the N_MEL log energies.
const DCT = Array.from({ length: N_CEP }, (_, k) => Float64Array.from({ length: N_MEL }, (_, m) =>
  Math.sqrt((k ? 2 : 1) / N_MEL) * Math.cos((Math.PI * k * (m + 0.5)) / N_MEL)))

export const frameCount = (len: number) => (len < FRAME ? 0 : 1 + Math.floor((len - FRAME) / HOP))

/** Mel filterbank power per 25 ms frame (10 ms hop): pre-emphasis, Hamming window, FFT power, 26 mel filters. */
export function melPower(audio: Float32Array): { data: Float64Array; n: number } {
  const n = frameCount(audio.length)
  const data = new Float64Array(n * N_MEL)
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT)
  for (let f = 0; f < n; f++) {
    const s = f * HOP
    re.fill(0); im.fill(0)
    for (let i = 0; i < FRAME; i++) re[i] = (audio[s + i] - (s + i > 0 ? PRE_EMPHASIS * audio[s + i - 1] : 0)) * HAMMING[i]
    fft(re, im)
    for (let k = 0; k <= NFFT / 2; k++) re[k] = re[k] * re[k] + im[k] * im[k]
    for (let m = 0; m < N_MEL; m++) {
      let e = 0
      const w = MEL[m]
      for (let k = 0; k <= NFFT / 2; k++) e += w[k] * re[k]
      data[f * N_MEL + m] = e
    }
  }
  return { data, n }
}

/** Background noise per mel band: the mean of the quietest 20% of frames. */
export function noiseProfile(audio: Float32Array): Float64Array {
  const { data, n } = melPower(audio)
  const out = new Float64Array(N_MEL)
  if (!n) return out
  const totals = Array.from({ length: n }, (_, f) => { let e = 0; for (let m = 0; m < N_MEL; m++) e += data[f * N_MEL + m]; return [e, f] })
  totals.sort((x, y) => x[0] - y[0])
  const k = Math.max(1, Math.floor(0.2 * n))
  for (let i = 0; i < k; i++) for (let m = 0; m < N_MEL; m++) out[m] += data[totals[i][1] * N_MEL + m] / k
  return out
}

export interface FrontEnd {
  /** Subtract this noise profile (from noiseProfile) from every frame's mel power. */
  noise?: Float64Array
  /** Floor every mel value this many dB below the clip's loudest frame, so quiet and noisy recordings share one floor. */
  rangeDb?: number
}

/** 13 MFCCs per frame: mel power, optional noise subtraction and relative floor, log, DCT. */
export function mfcc(audio: Float32Array, fe: FrontEnd = {}): Features {
  const { data: mel, n } = melPower(audio)
  const data = new Float32Array(n * N_CEP), logMel = new Float64Array(N_MEL)
  let floor = MEL_FLOOR
  if (fe.rangeDb !== undefined && n) {
    let peak = 0
    for (let f = 0; f < n; f++) { let e = 0; for (let m = 0; m < N_MEL; m++) e += mel[f * N_MEL + m]; peak = Math.max(peak, e / N_MEL) }
    floor = Math.max(MEL_FLOOR, peak * 10 ** (-fe.rangeDb / 10))
  }
  for (let f = 0; f < n; f++) {
    for (let m = 0; m < N_MEL; m++) {
      const e = mel[f * N_MEL + m] - (fe.noise ? fe.noise[m] : 0)
      logMel[m] = Math.log(Math.max(e, 0) + floor)
    }
    for (let k = 0; k < N_CEP; k++) {
      let c = 0
      for (let m = 0; m < N_MEL; m++) c += DCT[k][m] * logMel[m]
      data[f * N_CEP + k] = c
    }
  }
  return { data, n, dim: N_CEP }
}

/** Regression deltas over +-N frames, appended to each frame (dim doubles). */
export function withDeltas(x: Features, N = 2): Features {
  const { n, dim } = x, out = new Float32Array(n * dim * 2)
  const denom = 2 * Array.from({ length: N }, (_, i) => (i + 1) ** 2).reduce((a, b) => a + b, 0)
  for (let t = 0; t < n; t++) {
    for (let d = 0; d < dim; d++) {
      out[t * 2 * dim + d] = x.data[t * dim + d]
      let acc = 0
      for (let k = 1; k <= N; k++) {
        const a = Math.min(n - 1, t + k), b = Math.max(0, t - k)
        acc += k * (x.data[a * dim + d] - x.data[b * dim + d])
      }
      out[t * 2 * dim + dim + d] = acc / denom
    }
  }
  return { data: out, n, dim: dim * 2 }
}

/** Cepstral mean normalisation: subtract each coefficient's mean over the clip. */
export function cmn(x: Features): Features {
  const { n, dim } = x, data = Float32Array.from(x.data)
  if (!n) return { data, n, dim }
  for (let d = 0; d < dim; d++) {
    let m = 0
    for (let t = 0; t < n; t++) m += data[t * dim + d]
    m /= n
    for (let t = 0; t < n; t++) data[t * dim + d] -= m
  }
  return { data, n, dim }
}

/** Per-frame log energy (dB) with the same framing as mfcc. */
export function frameEnergyDb(audio: Float32Array, frame = FRAME, hop = HOP): Float64Array {
  const n = audio.length < frame ? 0 : 1 + Math.floor((audio.length - frame) / hop)
  const out = new Float64Array(n)
  for (let f = 0; f < n; f++) {
    let e = 0
    for (let i = f * hop; i < f * hop + frame; i++) e += audio[i] * audio[i]
    out[f] = 10 * Math.log10(e / frame + 1e-12)
  }
  return out
}

function percentile(xs: Float64Array, p: number): number {
  const s = Float64Array.from(xs).sort()
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : -120
}

/** Speech threshold in dB: well above the quiet floor, and no more than `range` dB below the loudest frame. */
function speechThreshold(db: Float64Array, range: number): number {
  const floor = percentile(db, 0.1), peak = percentile(db, 0.99)
  return Math.max(floor + 8, peak - range, -60)
}

/** Cuts leading and trailing silence, keeping `padMs` either side of the speech. */
export function trimSilence(audio: Float32Array, padMs = 30): Float32Array {
  const db = frameEnergyDb(audio)
  if (!db.length) return audio
  const thr = speechThreshold(db, 30)
  let a = 0, b = db.length - 1
  while (a < db.length && db[a] < thr) a++
  while (b > a && db[b] < thr) b--
  if (a >= db.length) return audio
  const pad = Math.round((padMs / 1000) * SR)
  return audio.subarray(Math.max(0, a * HOP - pad), Math.min(audio.length, b * HOP + FRAME + pad))
}

export interface FeatureOptions {
  /** Cut leading and trailing silence first (default true). */
  trim?: boolean
  /** Estimate background noise from the whole clip and subtract it; or pass a profile measured elsewhere. */
  denoise?: boolean | Float64Array
  /** Relative floor in dB below the loudest frame (see FrontEnd.rangeDb). */
  rangeDb?: number
}

/** Default front end, chosen on development speakers only in scripts/template-bench.ts. */
export const DEFAULT_FEATURES: FeatureOptions = { trim: true, denoise: false, rangeDb: 30 }

/** Full front end for one word: trim silence, MFCC, mean normalisation, deltas (26 values per frame). */
export function features(audio: Float32Array, opts: FeatureOptions = DEFAULT_FEATURES): Features {
  const noise = opts.denoise instanceof Float64Array ? opts.denoise : opts.denoise ? noiseProfile(audio) : undefined
  const clip = opts.trim ?? true ? trimSilence(audio) : audio
  return withDeltas(cmn(mfcc(clip, { noise, rangeDb: opts.rangeDb })))
}

// ---------- Dynamic time warping ----------

export interface DtwOptions {
  /** Sakoe-Chiba band half-width as a fraction of the longer sequence, around the length-scaled diagonal. */
  band?: number
  /** Pairs whose lengths differ by more than this ratio are not compared (cost Infinity). */
  maxRatio?: number
}

/**
 * Length-normalised DTW cost between two feature sequences: the mean Euclidean frame distance along
 * the best path (diagonal steps weighted 2, so the weights always sum to n + m). Identical inputs cost 0.
 */
export function dtw(a: Features, b: Features, opts: DtwOptions = {}): number {
  const band = opts.band ?? 0.2, maxRatio = opts.maxRatio ?? 2.5
  const n = a.n, m = b.n, dim = a.dim
  if (!n || !m || dim !== b.dim) return Infinity
  if (Math.max(n, m) / Math.min(n, m) > maxRatio) return Infinity
  const r = Math.max(2, Math.ceil(band * Math.max(n, m)))
  let prev = new Float64Array(m + 1).fill(Infinity), cur = new Float64Array(m + 1).fill(Infinity)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity)
    const centre = (i * m) / n
    const lo = Math.max(1, Math.floor(centre - r)), hi = Math.min(m, Math.ceil(centre + r))
    const ai = (i - 1) * dim
    for (let j = lo; j <= hi; j++) {
      const bj = (j - 1) * dim
      let d = 0
      for (let k = 0; k < dim; k++) { const t = a.data[ai + k] - b.data[bj + k]; d += t * t }
      d = Math.sqrt(d)
      cur[j] = Math.min(prev[j - 1] + 2 * d, prev[j] + d, cur[j - 1] + d)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[m] / (n + m)
}

// ---------- Isolated words ----------

export type Templates = Record<string, Features[]>

export interface Thresholds {
  /** Accept only if the best DTW cost is at most this. */
  maxCost: number
  /** ...and the best word beats the runner-up by at least this relative margin, 1 - best/second. */
  minMargin: number
}

/** Calibrated on half the Arabic speakers in scripts/template-bench.ts; see docs/TEMPLATE_BENCH.md. */
export const DEFAULT_THRESHOLDS: Thresholds = { maxCost: 4.8, minMargin: 0.2 }

export interface Classification { word: string; cost: number; second: number; margin: number; accepted: boolean }

/** Best-matching list word for one isolated clip, with its cost, margin over the runner-up and accept flag. */
export function classify(templates: Templates, clip: Features, th: Thresholds = DEFAULT_THRESHOLDS, opts?: DtwOptions): Classification {
  let word = '', cost = Infinity, second = Infinity
  for (const [w, ts] of Object.entries(templates)) {
    let c = Infinity
    for (const t of ts) c = Math.min(c, dtw(t, clip, opts))
    if (c < cost) { if (w !== word) second = cost; cost = c; word = w }
    else if (c < second) second = c
  }
  const margin = Number.isFinite(second) && second > 0 ? 1 - cost / second : Number.isFinite(cost) ? 1 : 0
  return { word, cost, second, margin, accepted: cost <= th.maxCost && margin >= th.minMargin }
}

// ---------- Continuous recordings ----------

export interface SegmentOptions {
  /** A pause at least this long ends a segment. */
  minGapMs?: number
  /** Segments shorter than this are dropped as clicks or breaths. */
  minSpeechMs?: number
  /** Segments longer than this are split at their quietest point. */
  maxSpeechMs?: number
}

/** Splits a longer recording into speech segments on pauses, by frame energy. Returns sample ranges. */
export function segment(audio: Float32Array, opts: SegmentOptions = {}): [number, number][] {
  const minGap = Math.round((opts.minGapMs ?? 180) / 10), minSpeech = Math.round((opts.minSpeechMs ?? 120) / 10)
  const maxSpeech = Math.round((opts.maxSpeechMs ?? 1600) / 10)
  const db = frameEnergyDb(audio)
  if (!db.length) return []
  const thr = speechThreshold(db, 35)
  const raw: [number, number][] = []
  let start = -1, quiet = 0
  for (let f = 0; f < db.length; f++) {
    if (db[f] >= thr) { if (start < 0) start = f; quiet = 0 }
    else if (start >= 0 && ++quiet >= minGap) { raw.push([start, f - quiet + 1]); start = -1; quiet = 0 }
  }
  if (start >= 0) raw.push([start, db.length - quiet])
  const out: [number, number][] = []
  const split = (a: number, b: number) => {
    if (b - a < minSpeech) return
    if (b - a <= maxSpeech) { out.push([a, b]); return }
    // Quietest frame in the middle 60%, smoothed over 5 frames.
    let best = -1, bestE = Infinity
    for (let f = a + Math.floor(0.2 * (b - a)); f < a + Math.ceil(0.8 * (b - a)); f++) {
      let e = 0
      for (let k = -2; k <= 2; k++) e += db[Math.min(db.length - 1, Math.max(0, f + k))]
      if (e < bestE) { bestE = e; best = f }
    }
    split(a, best); split(best, b)
  }
  for (const [a, b] of raw) split(a, b)
  const pad = 3 * HOP
  return out.map(([a, b]) => [Math.max(0, a * HOP - pad), Math.min(audio.length, b * HOP + FRAME + pad)])
}

export interface Detection { word: string; start: number; end: number; cost: number; margin: number }

/**
 * Finds list words in a longer recording: split on pauses, then classify each segment against the
 * person's own templates. Segments that do not match a template closely enough are dropped.
 * A word said twice is reported once (its best match).
 */
export function spot(templates: Templates, audio: Float32Array, th: Thresholds = DEFAULT_THRESHOLDS, opts?: SegmentOptions, fe: FeatureOptions = DEFAULT_FEATURES): Detection[] {
  const best = new Map<string, Detection>()
  // Segments are already cut to the speech, so no second trim; noise is measured on the whole recording.
  const denoise = fe.denoise ? noiseProfile(audio) : false
  for (const [s, e] of segment(audio, opts)) {
    const c = classify(templates, features(audio.subarray(s, e), { ...fe, trim: false, denoise }), th)
    if (!c.accepted) continue
    const prev = best.get(c.word)
    if (!prev || c.cost < prev.cost) best.set(c.word, { word: c.word, start: s, end: e, cost: c.cost, margin: c.margin })
  }
  return [...best.values()].sort((a, b) => a.start - b.start)
}
