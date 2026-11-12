// Measures the second listener on real human recordings of single words.
// Same Whisper models, prompt, speech gate and decoding as src/speech/whisper.worker.ts,
// then the app's own matchers. Datasets: Google Speech Commands v0.02 test set (English) and
// Arabic Speech Commands v1.0 (Ghandoura et al. 2021), both CC BY 4.0, extracted under external/.
// Usage: npx tsx scripts/human-speech-bench.ts en|ar   (each run merges its language into the JSON)
//        npx tsx scripts/human-speech-bench.ts md      (prints the markdown tables from the JSON)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration } from '@huggingface/transformers'
import { ANIMALS, type Lang } from '../src/engine/lexicon'
import { matchClosedSet, tokens } from '../src/engine/match'
import { readYesNo } from '../src/engine/yesno'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'src/data/human-speech-bench.json')
const SEED = 20261112
const PER_WORD = 60
const SR = 16000

// ---- Copied from src/speech/whisper.worker.ts (that file cannot be imported outside a worker). ----
const MODEL: Record<Lang, string> = { en: 'onnx-community/whisper-base', ar: 'onnx-community/whisper-small' }
const STYLE: Record<Lang, string> = {
  en: 'house, book, car, tree, school, door, chair, street, cup, shoe',
  ar: 'بيت، كتاب، سيارة، شجرة، مدرسة، باب، كرسي، شارع، كوب، حذاء',
}

function segments(audio: Float32Array): [number, number][] {
  const frame = 480, hang = 10, pad = 2400
  const levels: number[] = []
  for (let i = 0; i + frame <= audio.length; i += frame) {
    let e = 0
    for (let j = i; j < i + frame; j++) e += audio[j] * audio[j]
    levels.push(Math.sqrt(e / frame))
  }
  const sorted = [...levels].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0
  const thr = Math.max(0.008, floor * 3)
  const segs: [number, number][] = []
  let start = -1, quiet = 0
  levels.forEach((lv, k) => {
    const i = k * frame
    if (lv > thr) { if (start < 0) start = i; quiet = 0 }
    else if (start >= 0 && ++quiet > hang) { segs.push([Math.max(0, start - pad), Math.min(audio.length, i - (hang - 1) * frame + pad)]); start = -1; quiet = 0 }
  })
  if (start >= 0) segs.push([Math.max(0, start - pad), audio.length])
  return segs
}

function compact(audio: Float32Array, segs: [number, number][]): Float32Array[] {
  const gap = Math.round(0.4 * SR), max = 28 * SR
  const windows: Float32Array[] = []
  let parts: Float32Array[] = [], len = 0
  const flush = () => {
    if (!parts.length) return
    const out = new Float32Array(len + gap)
    let o = gap
    for (const p of parts) { out.set(p, o); o += p.length + gap }
    windows.push(out.subarray(0, Math.max(o, SR)))
    parts = []; len = 0
  }
  for (const [a, b] of segs) {
    const p = audio.subarray(a, b)
    if (len + p.length + gap > max) flush()
    parts.push(p); len += p.length + gap
  }
  flush()
  return windows
}

function looped(text: string): boolean {
  const w = text.split(/[\s,،]+/).filter(Boolean)
  return w.length >= 8 && new Set(w).size <= Math.max(2, w.length / 4)
}
// ---- End of copy. ----

/** Fails loudly if the worker's model ids, prompt or gate constants no longer match the copy above. */
function checkWorkerUnchanged() {
  const src = readFileSync(join(ROOT, 'src/speech/whisper.worker.ts'), 'utf8')
  const needles = [
    `{ en: '${MODEL.en}', ar: '${MODEL.ar}' }`, `en: '${STYLE.en}'`, `ar: '${STYLE.ar}'`,
    'const frame = 480, hang = 10, pad = 2400', 'Math.max(0.008, floor * 3)', "dtype: 'q8'",
    'const gap = Math.round(0.4 * SR), max = 28 * SR', 'max_new_tokens: 120', '.slice(-223)',
  ]
  const missing = needles.filter((n) => !src.includes(n))
  if (missing.length) throw new Error('whisper.worker.ts changed; update the copy in this script: ' + missing.join(' | '))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: { processor: any; tokenizer: any; model: any; device: string } | null = null

async function load(lang: Lang) {
  const id = MODEL[lang]
  const [processor, tokenizer] = await Promise.all([AutoProcessor.from_pretrained(id), AutoTokenizer.from_pretrained(id)])
  // The browser uses the wasm backend; Node runs the same q8 ONNX weights on onnxruntime's CPU backend.
  let model, device = 'wasm'
  try { model = await WhisperForConditionalGeneration.from_pretrained(id, { dtype: 'q8', device: 'wasm' }) }
  catch { device = 'cpu'; model = await WhisperForConditionalGeneration.from_pretrained(id, { dtype: 'q8', device: 'cpu' }) }
  loaded = { processor, tokenizer, model, device }
}

async function transcribe(audio: Float32Array, lang: Lang): Promise<string> {
  const { processor, tokenizer, model } = loaded!
  const segs = segments(audio)
  if (!segs.length) return ''
  const id = (t: string) => tokenizer.encode(t, { add_special_tokens: false })[0]
  const init = [id('<|startoftranscript|>'), id(`<|${lang}|>`), id('<|transcribe|>'), id('<|notimestamps|>')]
  const prompt = tokenizer.encode(' ' + STYLE[lang], { add_special_tokens: false }).slice(-223)
  const decoder_input_ids = [id('<|startofprev|>'), ...prompt, ...init]
  const texts: string[] = []
  for (const w of compact(audio, segs)) {
    const { input_features } = await processor(w)
    const out = await model.generate({ inputs: input_features, decoder_input_ids, max_new_tokens: 120 })
    const toks = out[0].tolist().map(Number).slice(decoder_input_ids.length)
    const text = tokenizer.decode(toks, { skip_special_tokens: true }).trim()
    if (!looped(text)) texts.push(text)
  }
  return texts.join(' ')
}

/** 16-bit PCM mono WAV to float samples. Anything else is rejected, not guessed. */
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

// ---- Number matcher (written here: the app has no number matcher yet). ----
// Accepts the digit (0-9 or Eastern Arabic ٠-٩) and the spoken word in either language.
const NUMBER_WORDS: string[][] = [
  ['zero', 'صفر'],
  ['one', 'واحد', 'واحدة'],
  ['two', 'اثنان', 'اثنين', 'اثنتان', 'اثنتين', 'ثنين', 'اتنين'],
  ['three', 'ثلاثة', 'ثلاث', 'تلاتة', 'تلات'],
  ['four', 'أربعة', 'أربع', 'اربعة', 'اربع'],
  ['five', 'خمسة', 'خمس'],
  ['six', 'ستة', 'ست'],
  ['seven', 'سبعة', 'سبع'],
  ['eight', 'ثمانية', 'ثماني', 'ثمان', 'تمانية', 'تمنية'],
  ['nine', 'تسعة', 'تسع'],
]

/** Every number 0-9 said in the transcript, as digits or as words. */
export function readNumbers(text: string, lang: Lang): Set<number> {
  const found = new Set<number>()
  const western = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  for (const m of western.match(/\d+/g) ?? []) if (m.length === 1) found.add(Number(m))
  const toks = new Set(tokens(text, lang))
  NUMBER_WORDS.forEach((forms, n) => {
    if (forms.some((f) => toks.has(tokens(f, lang)[0] ?? ''))) found.add(n)
  })
  return found
}

// ---- Items ----
type Task = 'digits' | 'yes/no' | 'animals'
interface Item { lang: Lang; task: Task; word: string; path: string; speaker: string }
type Outcome = 'correct' | 'wrong' | 'nothing'

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

function outcome(item: Item, text: string): Outcome {
  if (!text.trim()) return 'nothing'
  if (item.task === 'digits') return readNumbers(text, item.lang).has(DIGITS.indexOf(item.word)) ? 'correct' : 'wrong'
  if (item.task === 'yes/no') return readYesNo(text, item.lang) === (item.word === 'yes') ? 'correct' : 'wrong'
  const row = ANIMALS.en.findIndex((r) => r[0] === item.word)
  return matchClosedSet(text, ANIMALS.en, 'en').has(row) ? 'correct' : 'wrong'
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
/** Up to n clips, spread across speakers: speakers in random order, one clip each per round. */
function balanced(clips: { path: string; speaker: string }[], n: number, r: () => number) {
  const by = new Map<string, string[]>()
  for (const c of [...clips].sort((a, b) => a.path.localeCompare(b.path))) by.set(c.speaker, [...(by.get(c.speaker) ?? []), c.path])
  const queues = shuffle([...by.keys()].sort(), r).map((s) => ({ s, q: shuffle(by.get(s)!, r) }))
  const out: { path: string; speaker: string }[] = []
  while (out.length < n && queues.some((x) => x.q.length)) for (const x of queues) if (x.q.length && out.length < n) out.push({ path: x.q.shift()!, speaker: x.s })
  return out
}

const EN_DIR = join(ROOT, 'external/speech-commands-en/x')
const AR_DIR = join(ROOT, 'external/speech-commands-ar/x/abdulkaderghandoura-arabic-speech-commands-dataset-72f3438/dataset')

function itemsFor(lang: Lang): Item[] {
  const r = rng(SEED + (lang === 'ar' ? 1 : 0))
  const items: Item[] = []
  const add = (task: Task, word: string, clips: { path: string; speaker: string }[]) => {
    for (const c of balanced(clips, PER_WORD, r)) items.push({ lang, task, word, ...c })
  }
  if (lang === 'en') {
    // In the v0.02 test set, yes and no have their own folders; digits and cat/dog/bird sit in _unknown_ as word_speaker_nohash_n.wav.wav.
    const unknown = readdirSync(join(EN_DIR, '_unknown_'))
    const fromUnknown = (w: string) => unknown.filter((f) => f.startsWith(w + '_')).map((f) => ({ path: join(EN_DIR, '_unknown_', f), speaker: f.split('_')[1] }))
    for (const w of DIGITS) add('digits', w, fromUnknown(w))
    for (const w of ['yes', 'no']) add('yes/no', w, readdirSync(join(EN_DIR, w)).filter((f) => f.endsWith('.wav')).map((f) => ({ path: join(EN_DIR, w, f), speaker: f.split('_')[0] })))
    for (const w of ['cat', 'dog', 'bird']) add('animals', w, fromUnknown(w))
  } else {
    // File names are SPEAKERID_NO_round.wav (dataset README).
    const folder = (w: string) => readdirSync(join(AR_DIR, w)).filter((f) => f.endsWith('.wav')).map((f) => ({ path: join(AR_DIR, w, f), speaker: f.slice(0, 8) }))
    for (const w of DIGITS) add('digits', w, folder(w))
    for (const w of ['yes', 'no']) add('yes/no', w, folder(w))
  }
  return items
}

// ---- Stats ----
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1]
  const z = 1.959964, p = k / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
interface Row { group: string; n: number; speakers: number; correct: number; wrong: number; nothing: number; correctCi: [number, number]; wrongCi: [number, number]; nothingCi: [number, number] }
function summarise(group: string, rs: { speaker: string; outcome: Outcome }[]): Row {
  const n = rs.length, c = (o: Outcome) => rs.filter((x) => x.outcome === o).length
  const correct = c('correct'), wrong = c('wrong'), nothing = c('nothing')
  return { group, n, speakers: new Set(rs.map((x) => x.speaker)).size, correct, wrong, nothing, correctCi: wilson(correct, n), wrongCi: wilson(wrong, n), nothingCi: wilson(nothing, n) }
}

async function run(lang: Lang) {
  checkWorkerUnchanged()
  const limit = Number(process.env.BENCH_LIMIT ?? 0)
  const items = limit ? shuffle(itemsFor(lang), rng(1)).slice(0, limit) : itemsFor(lang)
  const t0 = Date.now()
  await load(lang)
  const loadS = (Date.now() - t0) / 1000
  const results: (Item & { text: string; outcome: Outcome })[] = []
  const t1 = Date.now()
  for (const [i, it] of items.entries()) {
    const text = await transcribe(readWav(it.path), lang)
    results.push({ ...it, text, outcome: outcome(it, text) })
    if ((i + 1) % 25 === 0) console.log(`${lang} ${i + 1}/${items.length} ${((Date.now() - t1) / 1000).toFixed(0)}s`)
  }
  const runS = (Date.now() - t1) / 1000
  const words = [...new Set(items.map((x) => x.word))]
  const tasks = [...new Set(items.map((x) => x.task))]
  const errors: Record<string, Record<string, number>> = {}
  for (const r of results.filter((x) => x.outcome === 'wrong')) {
    const e = (errors[r.word] ??= {}); e[r.text] = (e[r.text] ?? 0) + 1
  }
  const topErrors = Object.fromEntries(Object.entries(errors).map(([w, m]) => [w, Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)]))
  const block = {
    model: MODEL[lang], dtype: 'q8', backend: loaded!.device, seed: SEED + (lang === 'ar' ? 1 : 0), perWordCap: PER_WORD,
    clips: results.length, loadSeconds: Math.round(loadS), runSeconds: Math.round(runS), secondsPerClip: +(runS / results.length).toFixed(2),
    byWord: words.map((w) => summarise(w, results.filter((x) => x.word === w))),
    byTask: tasks.map((t) => summarise(t, results.filter((x) => x.task === t))),
    overall: summarise('all', results),
    topWrongTranscripts: topErrors,
    clipsUsed: results.map((r) => ({ file: r.path.slice(ROOT.length), word: r.word, text: r.text, outcome: r.outcome })),
  }
  if (limit) { for (const r of results) console.log(r.word, JSON.stringify(r.text), r.outcome); return }
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const out = { ...prev, generated: new Date().toISOString().slice(0, 10), [lang]: block }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
  for (const r of [...block.byWord, ...block.byTask, block.overall]) console.log(lang, fmt(r))
  console.log(`${lang}: ${results.length} clips, load ${loadS.toFixed(0)}s, run ${runS.toFixed(0)}s, backend ${loaded!.device}`)
}

const pct = (x: number, n: number) => (n ? (100 * x / n).toFixed(0) : '-') + '%'
const ci = (c: [number, number]) => `${(c[0] * 100).toFixed(0)}-${(c[1] * 100).toFixed(0)}`
function fmt(r: Row) {
  return `${r.group.padEnd(8)} n=${r.n} spk=${r.speakers} correct ${pct(r.correct, r.n)} [${ci(r.correctCi)}] wrong ${pct(r.wrong, r.n)} nothing ${pct(r.nothing, r.n)}`
}

function markdown() {
  const data = JSON.parse(readFileSync(OUT, 'utf8'))
  for (const lang of ['en', 'ar'] as Lang[]) {
    const b = data[lang]
    if (!b) continue
    console.log(`\n### ${lang === 'en' ? 'English' : 'Arabic'} (${b.model}, ${b.dtype}, ${b.clips} clips)\n`)
    console.log('| Word or task | Clips | Speakers | Correct (95% CI) | Wrong word (95% CI) | Nothing heard (95% CI) |\n|---|---|---|---|---|---|')
    for (const r of [...b.byWord, ...b.byTask.map((x: Row) => ({ ...x, group: `**${x.group}**` })), { ...b.overall, group: '**all**' }] as Row[]) {
      console.log(`| ${r.group} | ${r.n} | ${r.speakers} | ${pct(r.correct, r.n)} (${ci(r.correctCi)}) | ${pct(r.wrong, r.n)} (${ci(r.wrongCi)}) | ${pct(r.nothing, r.n)} (${ci(r.nothingCi)}) |`)
    }
  }
}

const arg = process.argv[2]
if (arg === 'md') markdown()
else if (arg === 'en' || arg === 'ar') await run(arg)
else { console.error('usage: human-speech-bench.ts en|ar|md'); process.exit(1) }
