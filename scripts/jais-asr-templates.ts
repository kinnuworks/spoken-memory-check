// "Jais-ASR OR own-voice templates" on the clips the human-speech bench used (digits and yes/no).
// Re-runs the per-clip template step of scripts/template-bench.ts (unionWithWhisper, "own" closed sets,
// strict thresholds) with the same seeds and clip order, so every clip gets the same template draw as the
// published run. The helpers below are copied from scripts/template-bench.ts. As a check, the Whisper
// figures must reproduce src/data/template-bench.json exactly; the script stops if they do not.
// Usage: npx tsx scripts/jais-asr-templates.ts   (after scripts/jais-asr-score.ts; adds `withTemplates`
// to src/data/jais-asr-bench.json)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_FEATURES, classify, features, type Features, type Templates, type Thresholds } from '../src/engine/templates'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'src/data/jais-asr-bench.json')
const AR_DIR = join(ROOT, 'external/speech-commands-ar/x/abdulkaderghandoura-arabic-speech-commands-dataset-72f3438/dataset')
const EN_DIR = join(ROOT, 'external/speech-commands-en/x')
const SEED = 20261114 // template-bench.ts SEED
const SR = 16000
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const EN_CORE = ['yes', 'no', 'up', 'down', 'left', 'right', 'on', 'off', 'stop', 'go']
const YN = ['yes', 'no']

// ---- Copied from scripts/template-bench.ts ----
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
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1]
  const z = 1.959964, p = k / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
const r3 = (x: number) => Math.round(x * 1000) / 1000
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
interface Clip { path: string; speaker: string; word: string }
const featCache = new Map<string, Features>()
function feat(path: string): Features {
  let f = featCache.get(path)
  if (!f) { f = features(readWav(path), DEFAULT_FEATURES); featCache.set(path, f) }
  return f
}
function arabicClips(): Map<string, Map<string, Clip[]>> {
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
  const out = new Map<string, Map<string, Clip[]>>()
  const add = (c: Clip) => {
    const m = out.get(c.speaker) ?? new Map<string, Clip[]>()
    m.set(c.word, [...(m.get(c.word) ?? []), c]); out.set(c.speaker, m)
  }
  for (const w of EN_CORE) for (const f of readdirSync(join(EN_DIR, w)).filter((x) => x.endsWith('.wav')).sort()) add({ path: join(EN_DIR, w, f), speaker: f.split('_')[0], word: w })
  for (const f of readdirSync(join(EN_DIR, '_unknown_')).sort()) { const [w, s] = f.split('_'); add({ path: join(EN_DIR, '_unknown_', f), speaker: s, word: w }) }
  return out
}
// ---- End of copied helpers ----

type Outcome = 'correct' | 'wrong' | 'nothing'
interface BenchClip { file: string; word: string; text: string; outcome: Outcome }
interface Row { file: string; speaker: string; word: string; whisper: boolean; jais: boolean | null; jaisWrongWord: boolean | null; tplCorrect: boolean; tplWrong: boolean }

/** Same loop as unionRows() in template-bench.ts with the "own" closed set; the rng is consumed identically. */
function rows(clips: BenchClip[], jais: Map<string, Outcome>, data: Map<string, Map<string, Clip[]>>, speakerOf: (f: string) => string, th: Thresholds, seed: number) {
  const r = rng(seed), out: Row[] = []
  let skipped = 0
  for (const c of clips) {
    const speaker = speakerOf(c.file), by = data.get(speaker), path = join(ROOT, c.file)
    const others = (w: string) => (by?.get(w) ?? []).filter((x) => x.path !== path)
    if (!others(c.word).length) { skipped++; continue }
    const templates: Templates = {}
    for (const w of DIGITS.includes(c.word) ? DIGITS : YN) { const o = others(w); if (o.length) templates[w] = [feat(o[Math.floor(r() * o.length)].path)] }
    const k = classify(templates, feat(path), th)
    const j = jais.get(c.file)
    out.push({ file: c.file, speaker, word: c.word, whisper: c.outcome === 'correct', jais: j == null ? null : j === 'correct', jaisWrongWord: j == null ? null : j === 'wrong', tplCorrect: k.accepted && k.word === c.word, tplWrong: k.accepted && k.word !== c.word })
  }
  return { rows: out, skipped }
}
function summary(rs: Row[], seed: number) {
  const withJ = rs.filter((x) => x.jais != null)
  const m = (xs: Row[], f: (x: Row) => boolean, k: number) => rate(xs.map((x) => ({ speaker: x.speaker, ok: f(x) })), seed + k)
  return {
    clips: rs.length, clipsWithJais: withJ.length,
    whisperAlone: m(rs, (x) => x.whisper, 1),
    templatesAlone: m(rs, (x) => x.tplCorrect, 2),
    whisperOrTemplates: m(rs, (x) => x.whisper || x.tplCorrect, 3),
    templateFalseCredit: m(rs, (x) => x.tplWrong, 4),
    jaisAlone: m(withJ, (x) => !!x.jais, 11),
    jaisOrTemplates: m(withJ, (x) => !!x.jais || x.tplCorrect, 12),
    jaisOrWhisper: m(withJ, (x) => !!x.jais || x.whisper, 13),
    jaisOrWhisperOrTemplates: m(withJ, (x) => !!x.jais || x.whisper || x.tplCorrect, 14),
    templateFalseCreditWhenJaisWrongWord: m(withJ, (x) => !!x.jaisWrongWord && x.tplWrong, 15),
  }
}

const bench = JSON.parse(readFileSync(join(ROOT, 'src/data/human-speech-bench.json'), 'utf8'))
const tplBench = JSON.parse(readFileSync(join(ROOT, 'src/data/template-bench.json'), 'utf8'))
const jaisBench = JSON.parse(readFileSync(OUT, 'utf8'))
const th: Thresholds = tplBench.unionWithWhisper.thresholds
const withTemplates: Record<string, unknown> = {
  description: 'Per clip, the template step of scripts/template-bench.ts (unionWithWhisper, own closed set: digits 0-9 for digit clips, yes/no for yes/no clips; one other repeat by the same speaker per word; strict thresholds) with the same seeds, so the template draws match the published run. X or templates = X correct, or the templates accept the right word. Template false credit = the templates accept a wrong word. Same-session read repeats; in the real check the templates would come from the registration trial.',
  thresholds: th,
}
const langs: [('ar' | 'en'), () => Map<string, Map<string, Clip[]>>, (f: string) => string, number][] = [
  ['ar', arabicClips, (f) => f.split('/').pop()!.slice(0, 8), SEED + 600],
  ['en', englishClips, (f) => { const b = f.split('/'); const name = b.pop()!; return b.pop() === '_unknown_' ? name.split('_')[1] : name.split('_')[0] }, SEED + 700],
]
for (const [lang, load, speakerOf, seed] of langs) {
  const clips: BenchClip[] = bench[lang].clipsUsed.filter((c: BenchClip) => DIGITS.includes(c.word) || YN.includes(c.word))
  const jais = new Map<string, Outcome>((jaisBench[lang]?.clipsUsed ?? []).map((c: { file: string; outcome: Outcome }) => [c.file, c.outcome]))
  const { rows: rs, skipped } = rows(clips, jais, load(), speakerOf, th, seed)
  const blk: Record<string, unknown> = { skippedNoOtherRepeat: skipped, overall: summary(rs, seed + 10) }
  for (const t of ['digits', 'yes/no']) blk[t] = summary(rs.filter((x) => (DIGITS.includes(x.word) ? 'digits' : 'yes/no') === t), seed + 20)
  // Check: the Whisper and template figures must match the published template-bench run.
  const pub = tplBench.unionWithWhisper[lang === 'ar' ? 'arabic' : 'english'].own.overall
  const mine = blk.overall as ReturnType<typeof summary>
  if (pub.whisperAlone.k !== mine.whisperAlone.k || pub.templatesAlone.k !== mine.templatesAlone.k || pub.union.k !== mine.whisperOrTemplates.k || pub.templateFalseCredit.k !== mine.templateFalseCredit.k) {
    throw new Error(`${lang}: does not reproduce template-bench.json (published whisper ${pub.whisperAlone.k}, templates ${pub.templatesAlone.k}, union ${pub.union.k}; here ${mine.whisperAlone.k}, ${mine.templatesAlone.k}, ${mine.whisperOrTemplates.k})`)
  }
  blk.reproducesTemplateBench = true
  // Clips the templates cover but Jais misses, and the reverse.
  const wj = rs.filter((x) => x.jais != null)
  blk.paired = { jaisOnly: wj.filter((x) => x.jais && !x.tplCorrect).length, templatesOnly: wj.filter((x) => !x.jais && x.tplCorrect).length, both: wj.filter((x) => x.jais && x.tplCorrect).length, neither: wj.filter((x) => !x.jais && !x.tplCorrect).length }
  withTemplates[lang] = blk
  const f = (x: Rate) => `${(100 * x.rate).toFixed(1)}% (${x.k}/${x.n}; Wilson ${(100 * x.wilson[0]).toFixed(1)}-${(100 * x.wilson[1]).toFixed(1)}; speaker bootstrap ${(100 * x.speakerBootstrap[0]).toFixed(1)}-${(100 * x.speakerBootstrap[1]).toFixed(1)})`
  for (const part of ['overall', 'digits', 'yes/no']) {
    const x = blk[part] as ReturnType<typeof summary>
    console.log(`\n${lang} ${part}: clips ${x.clips}, with Jais ${x.clipsWithJais}${part === 'overall' ? `, skipped ${skipped}` : ''}`)
    for (const k of ['whisperAlone', 'templatesAlone', 'whisperOrTemplates', 'jaisAlone', 'jaisOrTemplates', 'jaisOrWhisper', 'jaisOrWhisperOrTemplates', 'templateFalseCredit', 'templateFalseCreditWhenJaisWrongWord'] as const) console.log(`  ${k.padEnd(26)} ${f(x[k])}`)
  }
  console.log(lang, 'paired Jais vs templates', blk.paired)
}
jaisBench.withTemplates = withTemplates
writeFileSync(OUT, JSON.stringify(jaisBench, null, 1) + '\n')
