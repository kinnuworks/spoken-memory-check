// "Your own voice as the answer key": speaker-dependent word spotting with MFCC + DTW (src/engine/templates.ts),
// measured on real recordings. One repeat of each list word is the template (the registration trial);
// the speaker's other repeats are the test. No speech-to-text model is involved.
// Datasets: Arabic Speech Commands v1.0 (Ghandoura et al. 2021) and Google Speech Commands v0.02 test set,
// both CC BY 4.0, extracted under external/ (see docs/HUMAN_SPEECH_BENCH.md).
// Usage: npx tsx scripts/template-bench.ts   (writes src/data/template-bench.json and prints a summary)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_FEATURES, DEFAULT_THRESHOLDS, classify, features, segment, spot, trimSilence,
  type FeatureOptions, type Features, type Templates, type Thresholds,
} from '../src/engine/templates'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'src/data/template-bench.json')
const AR_ROOT = join(ROOT, 'external/speech-commands-ar/x/abdulkaderghandoura-arabic-speech-commands-dataset-72f3438')
const AR_DIR = join(AR_ROOT, 'dataset')
const EN_DIR = join(ROOT, 'external/speech-commands-en/x')
const SEED = 20261114
const SR = 16000
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const EN_CORE = ['yes', 'no', 'up', 'down', 'left', 'right', 'on', 'off', 'stop', 'go']
/** Dev-set rule for the shipped threshold: the most correct accepts with at most this false-accept rate. */
const TARGET_FA = 0.05
/** Front end under test. TEMPLATE_FE='{"denoise":true,"rangeDb":30}' tries another; DEV=1 runs development speakers only and writes nothing. */
const FE: FeatureOptions = process.env.TEMPLATE_FE ? JSON.parse(process.env.TEMPLATE_FE) : DEFAULT_FEATURES
const DEV_ONLY = process.env.DEV === '1'

// ---- Helpers (same as scripts/human-speech-bench.ts, copied so this script does not load the Whisper stack) ----

function readWav(path: string): Float32Array {
  const b = readFileSync(path)
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a wav: ' + path)
  let o = 12, fmt: { ch: number; rate: number; bits: number; tag: number } | null = null
  while (o + 8 <= b.length) {
    const idc = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4), body = o + 8
    if (idc === 'fmt ') fmt = { tag: b.readUInt16LE(body), ch: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) }
    if (idc === 'data') {
      if (!fmt || fmt.tag !== 1 || fmt.ch !== 1 || fmt.bits !== 16 || fmt.rate !== SR) throw new Error('unsupported wav format: ' + path)
      const n = Math.floor(Math.min(size, b.length - body) / 2)
      const a = new Float32Array(n)
      for (let i = 0; i < n; i++) a[i] = b.readInt16LE(body + 2 * i) / 32768
      return a
    }
    o = body + size + (size & 1)
  }
  throw new Error('no data chunk: ' + path)
}
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1]
  const z = 1.959964, p = k / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const r3 = (x: number) => Math.round(x * 1000) / 1000

/** Rate with a Wilson interval (clips treated as independent) and a speaker-bootstrap interval (speakers resampled). */
interface Rate { k: number; n: number; rate: number; wilson: [number, number]; speakerBootstrap: [number, number]; speakers: number }
function rate(rows: { speaker: string; ok: boolean }[], seed: number): Rate {
  const k = rows.filter((x) => x.ok).length, n = rows.length
  const by = new Map<string, [number, number]>()
  for (const x of rows) { const v = by.get(x.speaker) ?? [0, 0]; v[0] += x.ok ? 1 : 0; v[1]++; by.set(x.speaker, v) }
  const sp = [...by.values()], r = rng(seed), boots: number[] = []
  for (let b = 0; b < 2000 && sp.length; b++) {
    let kk = 0, nn = 0
    for (let i = 0; i < sp.length; i++) { const s = sp[Math.floor(r() * sp.length)]; kk += s[0]; nn += s[1] }
    boots.push(nn ? kk / nn : 0)
  }
  boots.sort((a, b) => a - b)
  const q = (p: number) => boots[Math.min(boots.length - 1, Math.floor(p * boots.length))] ?? 0
  return { k, n, rate: n ? r3(k / n) : 0, wilson: wilson(k, n).map(r3) as [number, number], speakerBootstrap: [r3(q(0.025)), r3(q(0.975))], speakers: by.size }
}
const pct = (x: number) => (100 * x).toFixed(1) + '%'
const fmtRate = (x: Rate) => `${pct(x.rate)} (${x.k}/${x.n}; Wilson ${pct(x.wilson[0])}-${pct(x.wilson[1])}; speaker bootstrap ${pct(x.speakerBootstrap[0])}-${pct(x.speakerBootstrap[1])})`

// ---- Clips and features ----

interface Clip { path: string; speaker: string; word: string }
const featCache = new Map<string, Features>()
const audioCache = new Map<string, Float32Array>()
let featMs = 0, featCount = 0, classifyMs = 0, classifyCount = 0
function audio(path: string) {
  let a = audioCache.get(path)
  if (!a) { a = readWav(path); audioCache.set(path, a) }
  return a
}
function feat(path: string): Features {
  let f = featCache.get(path)
  if (!f) {
    const a = audio(path), t = performance.now()
    f = features(a, FE)
    featMs += performance.now() - t; featCount++
    featCache.set(path, f)
  }
  return f
}
function timedClassify(t: Templates, f: Features, th: Thresholds) {
  const t0 = performance.now()
  const c = classify(t, f, th)
  classifyMs += performance.now() - t0; classifyCount++
  return c
}

function arabicClips(): Map<string, Map<string, Clip[]>> {
  // speaker -> word -> clips. File names are SPEAKERID_NO_round.wav (dataset README).
  const out = new Map<string, Map<string, Clip[]>>()
  for (const w of readdirSync(AR_DIR).sort()) {
    for (const f of readdirSync(join(AR_DIR, w)).filter((x) => x.endsWith('.wav')).sort()) {
      const speaker = f.slice(0, 8)
      const m = out.get(speaker) ?? new Map<string, Clip[]>()
      m.set(w, [...(m.get(w) ?? []), { path: join(AR_DIR, w, f), speaker, word: w }])
      out.set(speaker, m)
    }
  }
  return out
}
function englishClips(): Map<string, Map<string, Clip[]>> {
  // Core words have their own folders, named speaker_nohash_n.wav; other words sit in _unknown_ as word_speaker_nohash_n.wav.wav.
  const out = new Map<string, Map<string, Clip[]>>()
  const add = (c: Clip) => {
    const m = out.get(c.speaker) ?? new Map<string, Clip[]>()
    m.set(c.word, [...(m.get(c.word) ?? []), c]); out.set(c.speaker, m)
  }
  for (const w of EN_CORE) for (const f of readdirSync(join(EN_DIR, w)).filter((x) => x.endsWith('.wav')).sort()) add({ path: join(EN_DIR, w, f), speaker: f.split('_')[0], word: w })
  for (const f of readdirSync(join(EN_DIR, '_unknown_')).sort()) { const [w, s] = f.split('_'); add({ path: join(EN_DIR, '_unknown_', f), speaker: s, word: w }) }
  return out
}

// ---- Isolated-word trials ----

interface Trial { speaker: string; truth: string; isList: boolean; word: string; cost: number; margin: number }

/** Template = `nTemplates` random repeats per list word; tests = the remaining repeats of list words, and all repeats of non-list words. */
function isolatedTrials(by: Map<string, Clip[]>, speaker: string, list: string[], nonList: string[], r: () => number, nTemplates = 1): Trial[] {
  const templates: Templates = {}, tests: Clip[] = []
  for (const w of list) {
    const clips = shuffle(by.get(w)!, r)
    templates[w] = clips.slice(0, nTemplates).map((c) => feat(c.path))
    tests.push(...clips.slice(nTemplates))
  }
  for (const w of nonList) tests.push(...(by.get(w) ?? []))
  return tests.map((c) => {
    const k = timedClassify(templates, feat(c.path), { maxCost: Infinity, minMargin: 0 })
    return { speaker, truth: c.word, isList: list.includes(c.word), word: k.word, cost: k.cost, margin: k.margin }
  })
}
const accepted = (t: Trial, th: Thresholds) => t.cost <= th.maxCost && t.margin >= th.minMargin

interface OpenSet { listClips: number; nonListClips: number; argmaxAccuracy: Rate; correctAccept: Rate; wrongAccept: Rate; falseAccept: Rate }
function openSet(trials: Trial[], th: Thresholds, seed: number): OpenSet {
  const L = trials.filter((t) => t.isList), N = trials.filter((t) => !t.isList)
  return {
    listClips: L.length, nonListClips: N.length,
    argmaxAccuracy: rate(L.map((t) => ({ speaker: t.speaker, ok: t.word === t.truth })), seed),
    correctAccept: rate(L.map((t) => ({ speaker: t.speaker, ok: accepted(t, th) && t.word === t.truth })), seed + 1),
    wrongAccept: rate(L.map((t) => ({ speaker: t.speaker, ok: accepted(t, th) && t.word !== t.truth })), seed + 2),
    falseAccept: rate(N.map((t) => ({ speaker: t.speaker, ok: accepted(t, th) })), seed + 3),
  }
}
function perSpeaker(trials: Trial[]) {
  const sp = [...new Set(trials.map((t) => t.speaker))]
  return sp.map((s) => {
    const L = trials.filter((t) => t.speaker === s && t.isList)
    return { speaker: s, clips: L.length, argmaxAccuracy: r3(L.filter((t) => t.word === t.truth).length / L.length) }
  }).sort((a, b) => a.argmaxAccuracy - b.argmaxAccuracy)
}
function spread(ps: { argmaxAccuracy: number }[]) {
  const xs = ps.map((p) => p.argmaxAccuracy).sort((a, b) => a - b)
  return { min: xs[0], median: xs[Math.floor(xs.length / 2)], max: xs[xs.length - 1] }
}
/** Trade-off curve: for each cost cut-off (with the margin rule fixed), correct accepts vs false accepts. */
function curve(trials: Trial[], minMargin: number, costs: number[]) {
  const L = trials.filter((t) => t.isList), N = trials.filter((t) => !t.isList)
  return costs.map((maxCost) => {
    const th = { maxCost, minMargin }
    return {
      maxCost, minMargin,
      correctAccept: r3(L.filter((t) => accepted(t, th) && t.word === t.truth).length / L.length),
      wrongAccept: r3(L.filter((t) => accepted(t, th) && t.word !== t.truth).length / L.length),
      falseAccept: r3(N.filter((t) => accepted(t, th)).length / N.length),
    }
  })
}
/** Picks thresholds on dev trials: most correct accepts with false accepts at or below TARGET_FA. */
function calibrate(trials: Trial[]): Thresholds & { devCorrectAccept: number; devFalseAccept: number } {
  const L = trials.filter((t) => t.isList), N = trials.filter((t) => !t.isList)
  const costs = [...new Set(trials.map((t) => Math.round(t.cost * 20) / 20))].sort((a, b) => a - b)
  let best = { maxCost: 0, minMargin: 0, devCorrectAccept: -1, devFalseAccept: 0 }
  for (const minMargin of [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2]) {
    for (const maxCost of costs) {
      const th = { maxCost, minMargin }
      const fa = N.filter((t) => accepted(t, th)).length / N.length
      if (fa > TARGET_FA) continue
      const ca = L.filter((t) => accepted(t, th) && t.word === t.truth).length / L.length
      if (ca > best.devCorrectAccept) best = { maxCost, minMargin, devCorrectAccept: r3(ca), devFalseAccept: r3(fa) }
    }
  }
  return best
}

// ---- Continuous recall simulation ----

let noiseBank: Float32Array[] | null = null
function noise(): Float32Array[] {
  noiseBank ??= readdirSync(join(AR_ROOT, 'background_noise')).filter((f) => f.endsWith('.wav')).sort().map((f) => readWav(join(AR_ROOT, 'background_noise', f)))
  return noiseBank
}
const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length))

/** Adds a random stretch of `nz` at `snrDb` below the RMS of `speech` (the parts of x that are not digital silence). */
function addNoise(x: Float32Array, nz: Float32Array, snrDb: number, r: () => number): Float32Array {
  let e = 0, n = 0
  for (const v of x) if (v !== 0) { e += v * v; n++ }
  const speech = Math.sqrt(e / Math.max(1, n))
  const start = Math.floor(r() * Math.max(1, nz.length - x.length))
  const seg = nz.subarray(start, start + x.length)
  const gain = (speech / Math.max(1e-9, rms(seg))) * 10 ** (-snrDb / 20)
  const out = Float32Array.from(x)
  for (let i = 0; i < out.length && i < seg.length; i++) out[i] += gain * seg[i]
  return out
}

/** Concatenates trimmed clips with 0.3-0.8 s gaps (digital silence) after a 0.5 s lead-in. */
function buildRecording(clips: Clip[], r: () => number): Float32Array {
  const parts: Float32Array[] = [new Float32Array(Math.round(0.5 * SR))]
  for (const c of clips) {
    parts.push(trimSilence(audio(c.path), 50))
    parts.push(new Float32Array(Math.round((0.3 + 0.5 * r()) * SR)))
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/** Noise condition: none (the datasets' own room sound only), or one real noise file per speaker ("their room") at snrDb, added to the recall recording and optionally to the templates too. */
interface NoiseCond { snrDb: number | null; onTemplates: boolean; templates?: number }

interface RecallRow { speaker: string; said: string[]; nonList: string[]; detected: string[]; spoken: number; segments: number; hits: number; misses: number; falseList: number; seconds: number }
interface Continuous { recordings: number; segmentsPerWordSpoken: number; listWordsSaid: number; hitRate: Rate; falseDetectionsPerRecording: number; recordingsWithAnyFalse: Rate; exactRecordings: Rate; countErrorMean: number; countErrorAbsMean: number; countErrorHistogram: Record<string, number>; precision: number; msPerAudioSecond: number }

function continuous(speakers: string[], data: Map<string, Map<string, Clip[]>>, listOf: (s: string, r: () => number) => { list: string[]; nonList: string[] }, perSpeaker: number, th: Thresholds, cond: NoiseCond, seed: number): { summary: Continuous; rows: RecallRow[] } {
  const r = rng(seed), rows: RecallRow[] = []
  let ms = 0, secs = 0
  for (const s of speakers) {
    const by = data.get(s)!
    const { list, nonList } = listOf(s, r)
    // Template: one random repeat per list word. Recall clips come only from the other repeats.
    const templates: Templates = {}, pool = new Map<string, Clip[]>()
    const room = noise()[Math.floor(r() * noise().length)]
    for (const w of list) {
      const cs = shuffle(by.get(w)!, r)
      const nT = cond.templates ?? 1
      templates[w] = cs.slice(0, nT).map((c) => cond.snrDb !== null && cond.onTemplates ? features(addNoise(audio(c.path), room, cond.snrDb!, r), FE) : feat(c.path))
      pool.set(w, cs.slice(nT))
    }
    for (let k = 0; k < perSpeaker; k++) {
      const said = shuffle(list, r).slice(0, Math.min(list.length, int(r, 4, 7)))
      const extra = shuffle(nonList.filter((w) => by.get(w)?.length), r).slice(0, int(r, 1, 2))
      const clips = shuffle([
        ...said.map((w) => pool.get(w)![Math.floor(r() * pool.get(w)!.length)]),
        ...extra.map((w) => by.get(w)![Math.floor(r() * by.get(w)!.length)]),
      ], r)
      const clean = buildRecording(clips, r)
      const rec = cond.snrDb === null ? clean : addNoise(clean, room, cond.snrDb, r)
      const t0 = performance.now()
      const detected = spot(templates, rec, th, undefined, FE).map((d) => d.word)
      ms += performance.now() - t0; secs += rec.length / SR
      const hits = said.filter((w) => detected.includes(w)).length
      const wrong = detected.filter((w) => !said.includes(w))
      rows.push({ speaker: s, said, nonList: extra, detected, spoken: clips.length, segments: segment(rec).length, hits, misses: said.length - hits, falseList: wrong.length, seconds: r3(rec.length / SR) })
    }
  }
  const hitRows = rows.flatMap((x) => [...Array(x.hits).fill(true), ...Array(x.misses).fill(false)].map((ok) => ({ speaker: x.speaker, ok })))
  const errs = rows.map((x) => x.detected.length - x.said.length)
  const hist: Record<string, number> = {}
  for (const e of errs) hist[String(e)] = (hist[String(e)] ?? 0) + 1
  const totalDetected = rows.reduce((a, x) => a + x.detected.length, 0)
  return {
    rows,
    summary: {
      recordings: rows.length,
      segmentsPerWordSpoken: r3(rows.reduce((a, x) => a + x.segments, 0) / rows.reduce((a, x) => a + x.spoken, 0)),
      listWordsSaid: hitRows.length,
      hitRate: rate(hitRows, seed + 10),
      falseDetectionsPerRecording: r3(rows.reduce((a, x) => a + x.falseList, 0) / rows.length),
      recordingsWithAnyFalse: rate(rows.map((x) => ({ speaker: x.speaker, ok: x.falseList > 0 })), seed + 11),
      exactRecordings: rate(rows.map((x) => ({ speaker: x.speaker, ok: x.falseList === 0 && x.misses === 0 })), seed + 12),
      countErrorMean: r3(errs.reduce((a, b) => a + b, 0) / errs.length),
      countErrorAbsMean: r3(errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length),
      countErrorHistogram: hist,
      precision: r3(rows.reduce((a, x) => a + x.hits, 0) / Math.max(1, totalDetected)),
      msPerAudioSecond: r3(ms / secs),
    },
  }
}

// ---- Main ----

// ---- Whisper + templates on the exact clips the Whisper bench scored ----

interface WhisperClip { file: string; word: string; text: string; outcome: 'correct' | 'wrong' | 'nothing' }
interface UnionRow { speaker: string; word: string; whisper: boolean; whisperWrongWord: boolean; candidates: number; tplWord: string; tplAccepted: boolean; tplCorrect: boolean; tplWrong: boolean }

/**
 * For each Whisper-scored clip: templates are a different repeat (same speaker) of every word in the closed set,
 * at the strict thresholds. Candidate words the speaker never recorded twice (for the target) or at all (others) are left out.
 */
function unionRows(clips: WhisperClip[], data: Map<string, Map<string, Clip[]>>, speakerOf: (file: string) => string, setFor: (word: string) => string[], th: Thresholds, seed: number): { rows: UnionRow[]; skipped: number } {
  const r = rng(seed), rows: UnionRow[] = []
  let skipped = 0
  for (const c of clips) {
    const speaker = speakerOf(c.file), by = data.get(speaker), path = join(ROOT, c.file)
    const others = (w: string) => (by?.get(w) ?? []).filter((x) => x.path !== path)
    if (!others(c.word).length) { skipped++; continue }
    const templates: Templates = {}
    for (const w of setFor(c.word)) { const o = others(w); if (o.length) templates[w] = [feat(o[Math.floor(r() * o.length)].path)] }
    const k = classify(templates, feat(path), th)
    rows.push({
      speaker, word: c.word, whisper: c.outcome === 'correct', whisperWrongWord: c.outcome === 'wrong', candidates: Object.keys(templates).length,
      tplWord: k.word, tplAccepted: k.accepted, tplCorrect: k.accepted && k.word === c.word, tplWrong: k.accepted && k.word !== c.word,
    })
  }
  return { rows, skipped }
}
function unionSummary(rows: UnionRow[], seed: number) {
  const m = (f: (x: UnionRow) => boolean, k: number) => rate(rows.map((x) => ({ speaker: x.speaker, ok: f(x) })), seed + k)
  const cands = rows.map((x) => x.candidates)
  return {
    clips: rows.length,
    speakers: new Set(rows.map((x) => x.speaker)).size,
    candidateWords: { min: Math.min(...cands), mean: r3(cands.reduce((a, b) => a + b, 0) / Math.max(1, cands.length)), max: Math.max(...cands) },
    whisperAlone: m((x) => x.whisper, 1),
    templatesAlone: m((x) => x.tplCorrect, 2),
    union: m((x) => x.whisper || x.tplCorrect, 3),
    templateFalseCredit: m((x) => x.tplWrong, 4),
    templateFalseCreditWhenWhisperWrongWord: m((x) => x.whisperWrongWord && x.tplWrong, 5),
    templateFalseCreditAmongWhisperWrongWordClips: rate(rows.filter((x) => x.whisperWrongWord).map((x) => ({ speaker: x.speaker, ok: x.tplWrong })), seed + 6),
    whisperWrongWordClips: rows.filter((x) => x.whisperWrongWord).length,
  }
}
function unionBench(ar: Map<string, Map<string, Clip[]>>, en: Map<string, Map<string, Clip[]>>, th: Thresholds, testSpeakers: string[]) {
  const bench = JSON.parse(readFileSync(join(ROOT, 'src/data/human-speech-bench.json'), 'utf8'))
  const YN = ['yes', 'no']
  const task = (w: string) => (DIGITS.includes(w) ? 'digits' : 'yes/no')
  const sets = {
    own: (w: string) => (DIGITS.includes(w) ? DIGITS : YN),
    ynWithDigits: (w: string) => (DIGITS.includes(w) ? DIGITS : [...YN, ...DIGITS]),
  }
  const report = (lang: 'ar' | 'en', data: Map<string, Map<string, Clip[]>>, speakerOf: (f: string) => string, seed: number) => {
    const clips: WhisperClip[] = bench[lang].clipsUsed.filter((c: WhisperClip) => DIGITS.includes(c.word) || YN.includes(c.word))
    const out: Record<string, unknown> = { whisperClipsConsidered: clips.length }
    for (const [name, setFor] of Object.entries(sets)) {
      const { rows, skipped } = unionRows(clips, data, speakerOf, setFor, th, seed)
      const blk: Record<string, unknown> = { skippedNoOtherRepeat: skipped, overall: unionSummary(rows, seed + 10) }
      for (const t of ['digits', 'yes/no']) blk[t] = unionSummary(rows.filter((x) => task(x.word) === t), seed + 20)
      if (lang === 'ar') blk.testSpeakersOnly = unionSummary(rows.filter((x) => testSpeakers.includes(x.speaker)), seed + 30)
      out[name] = blk
    }
    return out
  }
  return {
    description: 'Whisper bench clips (digits and yes/no). Per clip, templates are a different repeat by the same speaker of each word in the closed set (digits 0-9 for digit clips; yes/no for yes/no clips, or yes/no plus the 10 digits as distractors in ynWithDigits). Strict thresholds. Union = Whisper correct OR template accepts the right word. Template false credit = template accepts a wrong word. Whisper\'s own wrong-word credits are not counted here. Same-session read repeats; in the real check, templates would come from the registration trial.',
    thresholds: th,
    arabic: { ...report('ar', ar, (f) => f.split('/').pop()!.slice(0, 8), SEED + 600), note: 'Thresholds were tuned on 15 of these 30 speakers; testSpeakersOnly excludes them.' },
    english: { ...report('en', en, (f) => { const b = f.split('/'); const name = b.pop()!; return b.pop() === '_unknown_' ? name.split('_')[1] : name.split('_')[0] }, SEED + 700), note: 'The English test set has few repeats per speaker outside yes/no, so digit clips often have only a few candidate words (see candidateWords); with fewer candidates, rejection is easier and the margin rule behaves differently.' },
  }
}

function main() {
  const tStart = Date.now()
  const out: Record<string, unknown> = { generated: new Date().toISOString().slice(0, 10), seed: SEED, method: 'MFCC (13 + deltas, CMN) + DTW (Sakoe-Chiba band 0.2, length-normalised), src/engine/templates.ts' }

  // ---------- Arabic ----------
  const ar = arabicClips()
  const arSpeakers = [...ar.keys()].sort()
  const allWords = [...ar.get(arSpeakers[0])!.keys()].sort()
  for (const s of arSpeakers) for (const w of allWords) if ((ar.get(s)!.get(w)?.length ?? 0) < 2) throw new Error(`missing ${s} ${w}`)
  const rSplit = rng(SEED)
  const shuffled = shuffle(arSpeakers, rSplit)
  const dev = shuffled.slice(0, 15).sort(), test = shuffled.slice(15).sort()
  const nonDigits = allWords.filter((w) => !DIGITS.includes(w))
  const lists = {
    random10: (s: string, r: () => number) => { const ws = shuffle(allWords, r); void s; return { list: ws.slice(0, 10), nonList: ws.slice(10, 20) } },
    digits: (s: string, r: () => number) => { void s; return { list: DIGITS, nonList: shuffle(nonDigits, r).slice(0, 10) } },
  }
  const arTrials = (cond: keyof typeof lists, speakers: string[], seed: number, nT = 1) => {
    const r = rng(seed)
    return speakers.flatMap((s) => { const { list, nonList } = lists[cond](s, r); return isolatedTrials(ar.get(s)!, s, list, nonList, r, nT) })
  }
  const devTrials = arTrials('random10', dev, SEED + 1)
  const th = calibrate(devTrials)
  const thresholds: Thresholds = { maxCost: th.maxCost, minMargin: th.minMargin }
  console.log('front end', FE, 'calibrated on dev speakers:', th, 'DEFAULT_THRESHOLDS in templates.ts:', DEFAULT_THRESHOLDS)
  if (DEV_ONLY) {
    for (const [k, c] of [['noNoise', { snrDb: null, onTemplates: false }], ['sameRoom20', { snrDb: 20, onTemplates: true }], ['sameRoom10', { snrDb: 10, onTemplates: true }], ['quietTplNoisy20', { snrDb: 20, onTemplates: false }]] as [string, NoiseCond][]) {
      const x = continuous(dev, ar, lists.random10, 10, thresholds, c, SEED + 500).summary
      console.log(`dev ${k}: hit ${pct(x.hitRate.rate)} false/rec ${x.falseDetectionsPerRecording} precision ${x.precision} seg/word ${x.segmentsPerWordSpoken}`)
    }
    return
  }

  const testR10 = arTrials('random10', test, SEED + 2)
  const allDigits = arTrials('digits', arSpeakers, SEED + 3)
  const testDigits = allDigits.filter((t) => test.includes(t.speaker))
  const testR10two = arTrials('random10', test, SEED + 2, 2)
  const costGrid = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, Infinity]
  const digitPerWord = DIGITS.map((w) => {
    const ts = allDigits.filter((t) => t.truth === w)
    return { word: w, clips: ts.length, argmaxAccuracy: r3(ts.filter((t) => t.word === w).length / ts.length) }
  })
  const whisperPath = join(ROOT, 'src/data/human-speech-bench.json')
  const whisper = existsSync(whisperPath) ? JSON.parse(readFileSync(whisperPath, 'utf8')).ar : null
  const whisperDigits = whisper ? {
    model: whisper.model,
    perWord: whisper.byWord.filter((x: { group: string }) => DIGITS.includes(x.group)).map((x: { group: string; n: number; correct: number }) => ({ word: x.group, clips: x.n, correct: r3(x.correct / x.n) })),
    task: whisper.byTask.find((x: { group: string }) => x.group === 'digits'),
  } : null

  out.arabic = {
    dataset: 'Arabic Speech Commands v1.0, 30 speakers x 40 words x 10 repeats, 1 s clips at 16 kHz',
    split: { devSpeakers: dev, testSpeakers: test, note: 'Thresholds chosen on dev speakers (random-10 lists) only; all figures below are test speakers unless marked.' },
    thresholds: { ...th, rule: `most correct accepts on dev with false accepts <= ${TARGET_FA}` },
    random10: { description: 'Per speaker: 10 random list words of 40, 10 other random words as non-list. 1 template per list word, 9 test repeats each; 10 repeats of each non-list word.', ...openSet(testR10, thresholds, SEED + 100), perSpeakerSpread: spread(perSpeaker(testR10)), perSpeaker: perSpeaker(testR10), curve: curve(testR10, th.minMargin, costGrid) },
    random10TwoTemplates: { description: 'Same lists and seed, but 2 templates per list word (8 test repeats each).', ...openSet(testR10two, thresholds, SEED + 110) },
    digits: { description: 'List = digits zero to nine; non-list = 10 random other words. Test speakers.', ...openSet(testDigits, thresholds, SEED + 120), perSpeakerSpread: spread(perSpeaker(testDigits)), curve: curve(testDigits, th.minMargin, costGrid) },
    digitsAllSpeakersArgmax: { description: 'Closed-set (no rejection) digit accuracy over all 30 speakers; no threshold involved, so dev speakers are fair to include.', overall: rate(allDigits.filter((t) => t.isList).map((t) => ({ speaker: t.speaker, ok: t.word === t.truth })), SEED + 130), perWord: digitPerWord },
    devCurve: curve(devTrials, th.minMargin, costGrid),
  }
  out.whisperComparison = {
    note: 'Different conditions. Whisper is speaker-independent open-vocabulary transcription (any text can come out; chance is near zero); templates are speaker-dependent, closed-set over 10 list words with the speaker\'s own registration repeat (chance 10%). Not a like-for-like contest.',
    whisper: whisperDigits,
  }

  // ---------- English ----------
  const en = englishClips()
  const enSpeakers = [...en.keys()].filter((s) => EN_CORE.every((w) => (en.get(s)!.get(w)?.length ?? 0) >= 2)).sort()
  const rEn = rng(SEED + 4)
  const enClosed: Trial[] = []
  const enLoo: Trial[] = []
  for (const s of enSpeakers) {
    const by = en.get(s)!
    const tpl = new Map<string, Clip[]>()
    for (const w of EN_CORE) tpl.set(w, shuffle(by.get(w)!, rEn))
    const templatesAll: Templates = Object.fromEntries(EN_CORE.map((w) => [w, [feat(tpl.get(w)![0].path)]]))
    for (const w of EN_CORE) for (const c of tpl.get(w)!.slice(1)) {
      const k = timedClassify(templatesAll, feat(c.path), { maxCost: Infinity, minMargin: 0 })
      enClosed.push({ speaker: s, truth: w, isList: true, word: k.word, cost: k.cost, margin: k.margin })
    }
    // Open set, leave one word out: that word's clips are tested against the other 9 templates.
    for (const left of EN_CORE) {
      const t9 = Object.fromEntries(Object.entries(templatesAll).filter(([w]) => w !== left))
      for (const c of tpl.get(left)!) {
        const k = timedClassify(t9, feat(c.path), { maxCost: Infinity, minMargin: 0 })
        enLoo.push({ speaker: s, truth: left, isList: false, word: k.word, cost: k.cost, margin: k.margin })
      }
    }
    // Same speaker's non-core words from _unknown_, when there are any.
    for (const [w, cs] of by) if (!EN_CORE.includes(w)) for (const c of cs) {
      const k = timedClassify(templatesAll, feat(c.path), { maxCost: Infinity, minMargin: 0 })
      enLoo.push({ speaker: s, truth: w, isList: false, word: k.word, cost: k.cost, margin: k.margin })
    }
  }
  const enAll = [...enClosed, ...enLoo]
  out.english = {
    dataset: 'Google Speech Commands v0.02 test set; speakers with at least 2 repeats of each of the 10 core words',
    speakers: enSpeakers.length,
    description: 'List = the 10 core words (yes no up down left right on off stop go). 1 random template per word, every other repeat tested. Non-list: each core word in turn left out of the list (9 templates), plus the speaker\'s other words from _unknown_. Thresholds are the Arabic dev ones, not retuned.',
    ...openSet(enAll, thresholds, SEED + 200),
    perSpeakerSpread: spread(perSpeaker(enAll)),
    curve: curve(enAll, th.minMargin, costGrid),
  }

  // ---------- Continuous ----------
  const enCont = (s: string, r: () => number) => { void s; const ws = shuffle(EN_CORE, r); return { list: ws.slice(0, 8), nonList: ws.slice(8) } }
  const conds: Record<string, NoiseCond> = {
    noNoiseAdded: { snrDb: null, onTemplates: false },
    sameRoom20dB: { snrDb: 20, onTemplates: true },
    sameRoom10dB: { snrDb: 10, onTemplates: true },
    quietTemplatesNoisyRecall20dB: { snrDb: 20, onTemplates: false },
    sameRoom20dBTwoTemplates: { snrDb: 20, onTemplates: true, templates: 2 },
  }
  const contAr = Object.fromEntries(Object.entries(conds).map(([k, c]) => [k, continuous(test, ar, lists.random10, 10, thresholds, c, SEED + 300)]))
  // Two templates plus a recall repeat needs 3 repeats of every word, so that condition uses fewer English speakers.
  const enSpeakers3 = enSpeakers.filter((s) => EN_CORE.every((w) => en.get(s)!.get(w)!.length >= 3))
  const contEn = Object.fromEntries(Object.entries(conds).map(([k, c]) => [k, continuous((c.templates ?? 1) > 1 ? enSpeakers3 : enSpeakers, en, enCont, 4, thresholds, c, SEED + 400)]))
  // Looser thresholds on the same recordings: more hits, more false detections.
  const contCurve = [[4.8, 0.2], [5.5, 0.15], [6, 0.1], [7, 0.05], [Infinity, 0]].map(([maxCost, minMargin]) => {
    const th2 = { maxCost, minMargin }
    const a = continuous(test, ar, lists.random10, 10, th2, conds.sameRoom20dB, SEED + 300).summary
    const e = continuous(enSpeakers, en, enCont, 4, th2, conds.sameRoom20dB, SEED + 400).summary
    return { maxCost, minMargin, arabicHitRate: a.hitRate.rate, arabicFalsePerRecording: a.falseDetectionsPerRecording, arabicPrecision: a.precision, englishHitRate: e.hitRate.rate, englishFalsePerRecording: e.falseDetectionsPerRecording, englishPrecision: e.precision }
  })
  console.log('continuous sameRoom20dB threshold curve', contCurve)
  out.continuous = {
    sameRoom20dBThresholdCurve: contCurve,
    description: 'Synthetic recall recordings: 4-7 of the speaker\'s list words (repeats other than the template) plus 1-2 non-list words, trimmed, shuffled, joined with 0.3-0.8 s gaps, 0.5 s lead-in. Noise: one real background recording per speaker (Arabic dataset background_noise folder: street, kitchen, boiler and so on) as "their room", mixed at the given SNR into the recall recording and, in the sameRoom conditions, into the template clips too (registration and recall happen minutes apart in the same place). Detection by spot(): energy segmentation then DTW per segment. Each list word is credited once.',
    conditions: conds,
    arabic: Object.fromEntries(Object.entries(contAr).map(([k, v]) => [k, v.summary])),
    english: { note: 'English list is 8 of the 10 core words; non-list words are the other 2.', ...Object.fromEntries(Object.entries(contEn).map(([k, v]) => [k, v.summary])) },
    examples: { arabic: contAr.sameRoom20dB.rows.slice(0, 6), english: contEn.sameRoom20dB.rows.slice(0, 6) },
  }
  out.unionWithWhisper = unionBench(ar, en, thresholds, test)
  const U = out.unionWithWhisper as Record<string, Record<string, unknown>>
  for (const lang of ['arabic', 'english']) for (const setName of ['own', 'ynWithDigits']) {
    const blk = U[lang][setName] as Record<string, ReturnType<typeof unionSummary> | number>
    console.log(`\nUnion ${lang} ${setName}: considered ${U[lang].whisperClipsConsidered}, skipped ${blk.skippedNoOtherRepeat}`)
    for (const part of ['digits', 'yes/no', 'overall', 'testSpeakersOnly']) {
      const x = blk[part] as ReturnType<typeof unionSummary> | undefined
      if (!x) continue
      console.log(`  ${part}: n=${x.clips} spk=${x.speakers} cands ${JSON.stringify(x.candidateWords)}`)
      console.log(`    whisper   ${fmtRate(x.whisperAlone)}\n    templates ${fmtRate(x.templatesAlone)}\n    union     ${fmtRate(x.union)}\n    falseCred ${fmtRate(x.templateFalseCredit)}\n    falseCred&whisperWrongWord ${fmtRate(x.templateFalseCreditWhenWhisperWrongWord)}; among the ${x.whisperWrongWordClips} whisper wrong-word clips ${fmtRate(x.templateFalseCreditAmongWhisperWrongWordClips)}`)
    }
  }
  out.runtime = {
    node: process.version,
    featureMsPerClip: r3(featMs / featCount),
    classifyMsPerClipAgainst10Templates: r3(classifyMs / classifyCount),
    clipsFeaturised: featCount,
    totalSeconds: Math.round((Date.now() - tStart) / 1000),
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')

  // ---------- Print ----------
  const A = out.arabic as Record<string, OpenSet & { perSpeakerSpread?: unknown }>
  const E = out.english as unknown as OpenSet & { perSpeakerSpread: unknown }
  const show = (name: string, o: OpenSet) => {
    console.log(`\n${name}: list clips ${o.listClips}, non-list clips ${o.nonListClips}`)
    console.log('  argmax accuracy  ', fmtRate(o.argmaxAccuracy))
    console.log('  correct accept   ', fmtRate(o.correctAccept))
    console.log('  wrong-word accept', fmtRate(o.wrongAccept))
    console.log('  false accept     ', fmtRate(o.falseAccept))
  }
  show('Arabic random-10 (test speakers)', A.random10)
  console.log('  per speaker', A.random10.perSpeakerSpread)
  show('Arabic random-10, 2 templates', A.random10TwoTemplates)
  show('Arabic digits (test speakers)', A.digits)
  show('English 10 core words', E)
  console.log('  per speaker', E.perSpeakerSpread)
  console.log('\nArabic digits, all speakers, argmax:', fmtRate((A.digitsAllSpeakersArgmax as unknown as { overall: Rate }).overall))
  for (const [lang, cs] of [['arabic', contAr], ['english', contEn]] as const) for (const [k, v] of Object.entries(cs)) {
    const x = v.summary
    console.log(`\nContinuous ${lang} ${k}: ${x.recordings} recordings, hit rate ${fmtRate(x.hitRate)}, false/rec ${x.falseDetectionsPerRecording}, any false ${pct(x.recordingsWithAnyFalse.rate)}, exact ${pct(x.exactRecordings.rate)}, count error mean ${x.countErrorMean} abs ${x.countErrorAbsMean}, precision ${x.precision}, ${x.msPerAudioSecond} ms per audio second`)
  }
  console.log('\nruntime', out.runtime)
}

main()
