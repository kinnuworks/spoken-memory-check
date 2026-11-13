// Experiments on the Arabic second listener: which model and prompt, and which word matcher,
// find the right word most often without matching words nobody said.
// Reuses the sampling, audio reading and speech gate from scripts/human-speech-bench.ts.
//
// Usage:
//   npx tsx scripts/arabic-asr-experiments.ts run <config> <set>   transcribe and cache (resumes)
//       set: subset (first PER_WORD clips per word of the bench sample, default 15)
//            full   (the bench's 720 clips)
//            other  (clips of the dataset's 28 other keywords, for false accepts)
//            seq    (60 recordings of five keywords from one speaker, joined with silence)
//   npx tsx scripts/arabic-asr-experiments.ts report [subset|full]  compare matchers on every cached config
//   npx tsx scripts/arabic-asr-experiments.ts lexicon               text-only false-accept check on the app's word sets
// Transcripts are cached in external/asr-experiments/ (not committed).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration, env } from '@huggingface/transformers'
import { ANIMALS, SOUND_CHECK_WORDS, WORD_LISTS } from '../src/engine/lexicon'
import { matchClosedSet, tokens } from '../src/engine/match'
import { DIGITS, NUMBER_WORDS, balanced, shuffle, compact, itemsFor, looped, readWav, rng, segments, wilson, type Item } from './human-speech-bench'

const ROOT = new URL('..', import.meta.url).pathname
const CACHE = join(ROOT, 'external/asr-experiments')
const AR_DIR = join(ROOT, 'external/speech-commands-ar/x/abdulkaderghandoura-arabic-speech-commands-dataset-72f3438/dataset')
env.localModelPath = join(ROOT, 'external/models') + '/'

// ---- Model configurations ----
type PromptKind = 'none' | 'style' | 'task'
interface Config { model: string; dtype: string; prompt: PromptKind; tokenizer?: string; local?: boolean; note: string }
const CONFIGS: Record<string, Config> = {
  'small-style': { model: 'onnx-community/whisper-small', dtype: 'q8', prompt: 'style', note: 'current app setting' },
  'small-style-rerun': { model: 'onnx-community/whisper-small', dtype: 'q8', prompt: 'style', note: 'current app setting, rerun here for timing' },
  'small-none': { model: 'onnx-community/whisper-small', dtype: 'q8', prompt: 'none', note: 'no prompt' },
  'small-task': { model: 'onnx-community/whisper-small', dtype: 'q8', prompt: 'task', note: 'prompt in the style of the answer' },
  'smallar-none': { model: 'onnx-community/whisper-small-ar-ONNX', dtype: 'q8', prompt: 'none', note: 'ayoubkirouane/whisper-small-ar (Common Voice 11), Apache-2.0' },
  'smallar-style': { model: 'onnx-community/whisper-small-ar-ONNX', dtype: 'q8', prompt: 'style', note: 'as above, style prompt' },
  'smallarq4-none': { model: 'onnx-community/whisper-small-ar-ONNX', dtype: 'q4', prompt: 'none', note: 'as smallar, 4-bit weights' },
  'smallarq4-style': { model: 'onnx-community/whisper-small-ar-ONNX', dtype: 'q4', prompt: 'style', note: 'as smallar, 4-bit weights, style prompt' },
  'smallar-task': { model: 'onnx-community/whisper-small-ar-ONNX', dtype: 'q8', prompt: 'task', note: 'as smallar, task prompt' },
  'dialect-none': { model: 'ovos-small-dialect', dtype: 'int8', prompt: 'none', local: true, tokenizer: 'onnx-community/whisper-small', note: 'oddadmix/whisper-small-arabic-dialectal-v2 via OpenVoiceOS ONNX, Apache-2.0' },
  'dialect-style': { model: 'ovos-small-dialect', dtype: 'int8', prompt: 'style', local: true, tokenizer: 'onnx-community/whisper-small', note: 'as above, style prompt' },
  'turbo-style': { model: 'onnx-community/whisper-large-v3-turbo', dtype: 'q4', prompt: 'style', note: 'large-v3-turbo q4' },
  'turbo-none': { model: 'onnx-community/whisper-large-v3-turbo', dtype: 'q4', prompt: 'none', note: 'large-v3-turbo q4, no prompt' },
}

const STYLE_AR = 'بيت، كتاب، سيارة، شجرة، مدرسة، باب، كرسي، شارع، كوب، حذاء'
// In the style of the expected answer, never the answer: numbers outside 0-9, short replies that are not yes or no.
const TASK_PROMPT: Record<string, string> = {
  digits: 'عشرة، عشرون، ثلاثون، مئة، ألف، أحد عشر، خمسون، مليون',
  'yes/no': 'طيب، تمام، ممكن، خلاص، شكرا',
  other: STYLE_AR,
  seq: 'عشرة، نعم، مئة، لا، ألف، خمسون',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: { processor: any; tokenizer: any; model: any } | null = null
async function load(cfg: Config) {
  const opt = cfg.local ? { local_files_only: true } : {}
  const [processor, tokenizer, model] = await Promise.all([
    AutoProcessor.from_pretrained(cfg.model, opt),
    AutoTokenizer.from_pretrained(cfg.tokenizer ?? cfg.model, cfg.tokenizer ? {} : opt),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WhisperForConditionalGeneration.from_pretrained(cfg.model, { ...opt, dtype: cfg.dtype as any, device: 'cpu' }),
  ])
  loaded = { processor, tokenizer, model }
}

async function transcribe(audio: Float32Array, cfg: Config, task: string): Promise<string> {
  const { processor, tokenizer, model } = loaded!
  const segs = segments(audio)
  if (!segs.length) return ''
  const id = (t: string) => tokenizer.encode(t, { add_special_tokens: false })[0]
  const init = [id('<|startoftranscript|>'), id('<|ar|>'), id('<|transcribe|>'), id('<|notimestamps|>')]
  const text = cfg.prompt === 'style' ? STYLE_AR : cfg.prompt === 'task' ? TASK_PROMPT[task] : ''
  const decoder_input_ids = text
    ? [id('<|startofprev|>'), ...tokenizer.encode(' ' + text, { add_special_tokens: false }).slice(-223), ...init]
    : init
  const texts: string[] = []
  for (const w of compact(audio, segs)) {
    const { input_features } = await processor(w)
    const out = await model.generate({ inputs: input_features, decoder_input_ids, max_new_tokens: 120 })
    const toks = out[0].tolist().map(Number).slice(decoder_input_ids.length)
    const t = tokenizer.decode(toks, { skip_special_tokens: true }).trim()
    if (!looped(t)) texts.push(t)
  }
  return texts.join(' ')
}

// ---- Clip sets ----
const PER_WORD = Number(process.env.PER_WORD ?? 15)
const OTHER_PER_WORD = 5
const OTHER_WORDS = readdirSync(AR_DIR).filter((w) => ![...DIGITS, 'yes', 'no'].includes(w)).sort()

function clipSet(set: string): Item[] {
  const all = itemsFor('ar')
  if (set === 'full') return all
  if (set === 'subset') {
    const seen = new Map<string, number>()
    return all.filter((it) => { const k = (seen.get(it.word) ?? 0) + 1; seen.set(it.word, k); return k <= PER_WORD })
  }
  if (set === 'seq') {
    // Five different keywords from one speaker joined with half a second of silence, closer to a spoken list.
    // Clips come from the bench sample's speakers but are drawn independently; 60 sequences.
    const r = rng(20261115)
    const words = [...DIGITS, 'yes', 'no']
    const bySpeaker = new Map<string, Map<string, string[]>>()
    for (const w of words) for (const f of readdirSync(join(AR_DIR, w)).filter((f) => f.endsWith('.wav')).sort()) {
      const sp = f.slice(0, 8), m = bySpeaker.get(sp) ?? new Map<string, string[]>()
      m.set(w, [...(m.get(w) ?? []), join(AR_DIR, w, f)]); bySpeaker.set(sp, m)
    }
    const speakers = [...bySpeaker.keys()].sort()
    return Array.from({ length: 60 }, (_, i) => {
      const sp = speakers[i % speakers.length], m = bySpeaker.get(sp)!
      const pick = shuffle(words, r).slice(0, 5)
      const paths = pick.map((w) => { const xs = m.get(w)!; return xs[Math.floor(r() * xs.length)] })
      return { lang: 'ar' as const, task: 'seq' as Item['task'], word: pick.join('+'), path: paths.join('|'), speaker: sp }
    })
  }
  if (set === 'other') {
    const r = rng(20261114)
    return OTHER_WORDS.flatMap((w) => {
      const clips = readdirSync(join(AR_DIR, w)).filter((f) => f.endsWith('.wav')).map((f) => ({ path: join(AR_DIR, w, f), speaker: f.slice(0, 8) }))
      return balanced(clips, OTHER_PER_WORD, r).map((c) => ({ lang: 'ar' as const, task: 'other' as Item['task'], word: w, ...c }))
    })
  }
  throw new Error('unknown set ' + set)
}

function joinClips(paths: string[]): Float32Array {
  const gap = 8000, parts = paths.map(readWav)
  const out = new Float32Array(parts.reduce((a, p) => a + p.length + gap, gap))
  let o = gap
  for (const p of parts) { out.set(p, o); o += p.length + gap }
  return out
}

interface Cached { config: string; model: string; dtype: string; prompt: PromptKind; loadSeconds: number; clips: { file: string; word: string; task: string; speaker: string; text: string; seconds: number }[] }
const cachePath = (config: string, set: string) => join(CACHE, `${config}.${set === 'subset' ? 'subset' + PER_WORD : set}.json`)
const relPath = (p: string) => p.split('|').map((x) => x.slice(ROOT.length)).join('|')

async function runConfig(name: string, set: string) {
  const cfg = CONFIGS[name]
  if (!cfg) throw new Error('unknown config ' + name)
  mkdirSync(CACHE, { recursive: true })
  const path = cachePath(name, set)
  const cache: Cached = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { config: name, model: cfg.model, dtype: cfg.dtype, prompt: cfg.prompt, loadSeconds: 0, clips: [] }
  const done = new Set(cache.clips.map((c) => c.file))
  const todo = clipSet(set).filter((it) => !done.has(relPath(it.path)))
  if (!todo.length) { console.log(name, set, 'already done'); return }
  const t0 = Date.now()
  await load(cfg)
  cache.loadSeconds = Math.round((Date.now() - t0) / 1000)
  for (const [i, it] of todo.entries()) {
    const t = Date.now()
    const text = await transcribe(it.path.includes('|') ? joinClips(it.path.split('|')) : readWav(it.path), cfg, it.task)
    cache.clips.push({ file: relPath(it.path), word: it.word, task: it.task, speaker: it.speaker, text, seconds: (Date.now() - t) / 1000 })
    if ((i + 1) % 20 === 0 || i === todo.length - 1) {
      writeFileSync(path, JSON.stringify(cache, null, 1))
      console.log(`${name} ${set} ${i + 1}/${todo.length}`)
    }
  }
}

// ---- Matchers ----
// Letters Whisper often swaps in these clips: emphatic and plain pairs, and the interdentals.
const FOLD: Record<string, string> = { 'ص': 'س', 'ث': 'س', 'ط': 'ت', 'ظ': 'ز', 'ذ': 'ز', 'ض': 'د' }
export function fold(tok: string): string {
  let s = [...tok].map((c) => FOLD[c] ?? c).join('')
  // Feminine and alef endings: ة (already ه after normalising), ه, ا, ى at the end of a longer word.
  if (s.length > 2) s = s.replace(/[ةها]$/, 'ه')
  return s
}

function lev(a: string, b: string): number {
  const x = [...a], y = [...b]
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[y.length]
}

interface MatchOpts { fold: boolean; edit: boolean; minLen: number; sameFirst: boolean }
// 'app' is src/engine/match.ts as it now stands; the others are variants built on the old exact matcher.
const MATCHERS: Record<string, MatchOpts | 'app' | null> = {
  exact: null,
  app: 'app',
  fold: { fold: true, edit: false, minLen: 99, sameFirst: false },
  'edit1>=4': { fold: false, edit: true, minLen: 4, sameFirst: false },
  'fold+edit1>=4': { fold: true, edit: true, minLen: 4, sameFirst: false },
  'fold+edit1>=4 same first': { fold: true, edit: true, minLen: 4, sameFirst: true },
  'fold+edit1>=3 (loose)': { fold: true, edit: true, minLen: 3, sameFirst: false },
}

/** The app's matcher before near misses were added: exact normalised forms, longest first. */
function matchExact(text: string, rows: string[][]): Set<number> {
  const toks = tokens(text, 'ar')
  const forms = rows.flatMap((r, i) => r.map((f) => ({ key: tokens(f, 'ar'), row: i }))).sort((a, b) => b.key.length - a.key.length)
  const used = new Array(toks.length).fill(false)
  const found = new Set<number>()
  for (const { key, row } of forms) {
    if (!key.length) continue
    for (let i = 0; i + key.length <= toks.length; i++) {
      if (used.slice(i, i + key.length).some(Boolean)) continue
      if (key.every((k, j) => toks[i + j] === k)) { for (let j = 0; j < key.length; j++) used[i + j] = true; found.add(row) }
    }
  }
  return found
}

/**
 * Closed-set match on single-word forms. Exact matches always count. A token that matches no
 * form exactly may match after folding, or within one edit of a form at least minLen letters long,
 * but only when exactly one row is that close; ties match nothing.
 */
function fuzzyRows(text: string, rows: string[][], o: MatchOpts | 'app' | null): Set<number> {
  if (o === 'app') return matchClosedSet(text, rows, 'ar')
  const found = matchExact(text, rows)
  if (!o) return found
  const forms = rows.flatMap((r, i) => r.map((f) => ({ t: tokens(f, 'ar'), row: i }))).filter((f) => f.t.length === 1).map((f) => ({ k: f.t[0], row: f.row }))
  const exact = new Set(forms.map((f) => f.k))
  for (const tok of tokens(text, 'ar')) {
    if (exact.has(tok)) continue
    const tf = o.fold ? fold(tok) : tok
    const near = new Set<number>()
    for (const f of forms) {
      const ff = o.fold ? fold(f.k) : f.k
      if (tf === ff) { near.add(f.row); continue }
      if (!o.edit || [...ff].length < o.minLen || [...tf].length < o.minLen - 1) continue
      if (o.sameFirst && [...tf][0] !== [...ff][0]) continue
      if (lev(tf, ff) <= 1) near.add(f.row)
    }
    if (near.size === 1) found.add([...near][0])
  }
  return found
}

// Closed sets for the bench's words: ten digits, then yes and no.
const YES_AR = ['نعم', 'ايوه', 'ايوا', 'اي', 'ايه', 'اكيد', 'صح', 'احيانا', 'أحيانا']
const NO_AR = ['لا', 'لأ', 'كلا', 'ابدا', 'أبدا']
const DIGIT_ROWS = NUMBER_WORDS.map((r) => r.slice(1))
const KEY_ROWS = [...DIGIT_ROWS, YES_AR, NO_AR]
const KEY_WORDS = [...DIGITS, 'yes', 'no']

function digitsIn(text: string): Set<number> {
  const out = new Set<number>()
  const w = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  for (const m of w.match(/\d+/g) ?? []) if (m.length === 1) out.add(Number(m))
  return out
}

/** Rows of KEY_ROWS heard: digit characters plus word forms. Yes and no follow readYesNo: both heard means neither. */
function keyRows(text: string, o: MatchOpts | 'app' | null): Set<number> {
  const rows = fuzzyRows(text, KEY_ROWS, o)
  for (const d of digitsIn(text)) rows.add(d)
  if (rows.has(10) && rows.has(11)) { rows.delete(10); rows.delete(11) }
  return rows
}

// ---- Report ----
const pct = (k: number, n: number) => (n ? Math.round(100 * k / n) : 0) + '%'
const ci = (k: number, n: number) => { const [a, b] = wilson(k, n); return `${Math.round(a * 100)}-${Math.round(b * 100)}` }
const cell = (k: number, n: number) => `${pct(k, n)} (${ci(k, n)})`

function readCaches(set: string): Cached[] {
  if (!existsSync(CACHE)) return []
  const suffix = set === 'subset' ? `.subset${PER_WORD}.json` : `.${set}.json`
  return readdirSync(CACHE).filter((f) => f.endsWith(suffix)).map((f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8')))
}

/** Rows of the app's own closed sets (both Arabic word lists, the animals) that a transcript matches. */
function appSetHits(text: string, o: MatchOpts | 'app' | null): number {
  let n = 0
  for (const rows of [...WORD_LISTS.ar.map((l) => l.map((w) => [w])), ANIMALS.ar]) n += fuzzyRows(text, rows, o).size
  return n
}

function reportSeq() {
  console.log('\n## Five-word sequences (60 sequences, 300 words)\n')
  console.log('| Config | Matcher | Words found | Sequences with a keyword not said | s/sequence |\n|---|---|---|---|---|')
  for (const c of readCaches('seq').sort((a, b) => a.config.localeCompare(b.config))) {
    const secs = c.clips.reduce((a, x) => a + x.seconds, 0) / c.clips.length
    for (const [mname, o] of Object.entries(MATCHERS)) {
      let hit = 0, n = 0, fa = 0
      for (const x of c.clips) {
        const said = x.word.split('+').map((w) => KEY_WORDS.indexOf(w))
        // Yes and no are scored as rows here, not with readYesNo's both-means-neither rule.
        const rows = fuzzyRows(x.text, KEY_ROWS, o)
        for (const d of digitsIn(x.text)) rows.add(d)
        for (const w of said) { n++; if (rows.has(w)) hit++ }
        if ([...rows].some((r) => !said.includes(r))) fa++
      }
      console.log(`| ${c.config} | ${mname} | ${hit}/${n} ${cell(hit, n)} | ${cell(fa, c.clips.length)} | ${secs.toFixed(2)} |`)
    }
  }
}

function report(set: string) {
  const caches = readCaches(set)
  const other = new Map(readCaches('other').map((c) => [c.config, c]))
  console.log(`\n## Keyword clips (${set}${set === 'subset' ? `, ${PER_WORD} per word` : ''})\n`)
  console.log('| Config | Matcher | Clips | Digits correct | Yes/no correct | All correct | Clips matching a wrong keyword | Wrong pairs | Other-keyword clips matching a keyword | Other-keyword clips matching an app list or animal | s/clip |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const c of caches.sort((a, b) => a.config.localeCompare(b.config))) {
    const secs = c.clips.reduce((a, x) => a + x.seconds, 0) / c.clips.length
    for (const [mname, o] of Object.entries(MATCHERS)) {
      let dig = 0, nd = 0, yn = 0, ny = 0, wrongClip = 0, wrongPairs = 0
      for (const x of c.clips) {
        const target = KEY_WORDS.indexOf(x.word)
        const rows = keyRows(x.text, o)
        const ok = rows.has(target)
        if (x.task === 'digits') { nd++; if (ok) dig++ } else { ny++; if (ok) yn++ }
        const wrong = [...rows].filter((r) => r !== target).length
        if (wrong) wrongClip++
        wrongPairs += wrong
      }
      const n = c.clips.length, pairs = n * (KEY_ROWS.length - 1)
      const oc = other.get(c.config)
      const oKey = oc ? oc.clips.filter((x) => keyRows(x.text, o).size > 0).length : NaN
      const oApp = oc ? oc.clips.filter((x) => appSetHits(x.text, o) > 0).length : NaN
      const on = oc?.clips.length ?? 0
      console.log(`| ${c.config} | ${mname} | ${n} | ${cell(dig, nd)} | ${cell(yn, ny)} | ${cell(dig + yn, n)} | ${cell(wrongClip, n)} | ${(100 * wrongPairs / pairs).toFixed(2)}% | ${on ? `${oKey}/${on} ${cell(oKey, on)}` : '-'} | ${on ? `${oApp}/${on} ${cell(oApp, on)}` : '-'} | ${secs.toFixed(2)} |`)
    }
  }
  if (process.env.SHOW) {
    const c = caches.find((x) => x.config === process.env.SHOW)!
    const o = MATCHERS[process.env.MATCHER ?? 'fold+edit1>=4']
    for (const x of c.clips) {
      const before = keyRows(x.text, null), after = keyRows(x.text, o)
      if ([...after].some((r) => !before.has(r))) console.log(x.word, JSON.stringify(x.text), [...after].map((r) => KEY_WORDS[r]).join(','))
    }
    const oc = other.get(c.config)
    for (const x of oc?.clips ?? []) {
      if (keyRows(x.text, o).size > keyRows(x.text, null).size || appSetHits(x.text, o) > appSetHits(x.text, null)) console.log('OTHER', x.word, JSON.stringify(x.text), [...keyRows(x.text, o)].map((r) => KEY_WORDS[r]).join(','))
    }
  }
}

// ---- Text-only check: do the app's own words, and other common nouns, fuzzily match a different item? ----
// Common concrete nouns and everyday words a person might say instead of a list word. Written for this check.
const COMMON = `بيت كتاب سيارة شجرة مدرسة باب كرسي شارع كوب حذاء طاولة ماء صباح مساء ليل نهار شمس قمر نجمة سماء أرض جبل بحر نهر بئر
مطر ريح نار تراب رمل حجر ورقة وردة زهرة نخلة تمر خبز أرز لحم لبن حليب شاي قهوة سكر ملح عسل بيض جبن زيت تفاح موز برتقال عنب
رمان بطيخ طماطم بصل ثوم جزر خيار سرير مخدة بطانية غرفة مطبخ حمام صالة شباك جدار سقف درج مفتاح قفل ساعة هاتف تلفاز راديو مصباح
ثلاجة غسالة صحن ملعقة سكين شوكة قدر فنجان إبريق دفتر ورق حقيبة محفظة نظارة خاتم قميص ثوب عباءة غترة شماغ عقال حزام جورب قبعة
طبيب ممرض معلم مهندس شرطي سائق طباخ نجار خباز تاجر أب أم أخ أخت جد جدة ابن بنت عم خال صديق جار مسجد سوق مستشفى صيدلية مطار
ميناء محطة مكتب بنك فندق مطعم حديقة ملعب مزرعة قرية مدينة طريق جسر سفينة قارب طائرة قطار دراجة حافلة شاحنة سلم كرة لعبة قلم
ممحاة مسطرة لوح صورة مرآة شمعة زبدة معطف نافذة سلة برج ليمون وسادة مزارع تذكرة شريط مطرقة صفر سفر سبعة سبع ستة ست تسعة تسع
مرات تذكر أتذكر شرير شريف أبريل طبيبة حبيب شمس مزرعة امرأة سعادة حديد قلب جسم نهار معطي ليمونة زبدية برجس بحار نافذ`.split(/\s+/).filter(Boolean)

function lexicon() {
  const sets: { name: string; rows: string[][] }[] = [
    { name: 'word list 1', rows: WORD_LISTS.ar[0].map((w) => [w]) },
    { name: 'word list 2', rows: WORD_LISTS.ar[1].map((w) => [w]) },
    { name: 'animals', rows: ANIMALS.ar },
    { name: 'digits+yes/no', rows: KEY_ROWS },
  ]
  const probes = [...new Set([...COMMON, ...WORD_LISTS.ar.flat(), ...ANIMALS.ar.flat(), ...SOUND_CHECK_WORDS.ar, ...KEY_ROWS.flat()])]
  console.log(`\n## Text-only check: ${probes.length} probe words against each set\n`)
  for (const [mname, o] of Object.entries(MATCHERS)) {
    if (!o) continue
    const hits: string[] = []
    for (const s of sets) {
      for (const p of probes) {
        const before = matchExact(p, s.rows)
        if (s.name === 'digits+yes/no') { for (const r of keyRows(p, null)) before.add(r) }
        const after = s.name === 'digits+yes/no' ? keyRows(p, o) : fuzzyRows(p, s.rows, o)
        for (const r of after) if (!before.has(r)) hits.push(`${s.name}: ${p} -> ${s.rows[r][0]}`)
      }
    }
    console.log(`${mname}: ${hits.length} new matches`)
    for (const h of hits) console.log('   ', h)
  }
}

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'run') await runConfig(a, b ?? 'subset')
else if (cmd === 'report') { if (a === 'seq') reportSeq(); else report(a ?? 'subset') }
else if (cmd === 'lexicon') lexicon()
else { console.error('usage: arabic-asr-experiments.ts run <config> <subset|full|other> | report [subset|full] | lexicon'); process.exit(1) }
