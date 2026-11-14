// Older and Gulf speakers: the app's on-device Arabic listener on Saudi TV speech from the SADA 2022
// test split (CC BY-NC-SA 4.0), labelled by annotators with speaker age group and dialect.
// The question is narrow: does the listener hear older speakers, and Gulf (Khaliji) speakers,
// worse than other adults? It is not a test of the memory check itself (these are sentences, not
// word lists), and SADA gives no speaker ids, so several clips may come from one speaker.
//
// Usage:
//   python -I scripts/sada-extract.py external/sada/test.parquet external/sada/clips
//   npx tsx scripts/sada-bench.ts run <none|style>   transcribe with the app's model (cached, resumes)
//   npx tsx scripts/sada-bench.ts report             word error by group, written to src/data/sada-bench.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration } from '@huggingface/transformers'
import { foldArabic, tokens } from '../src/engine/match'
import { compact, looped, readWav, rng, segments } from './human-speech-bench'

const ROOT = new URL('..', import.meta.url).pathname
const CLIPS = join(ROOT, 'external/sada/clips')
const MODEL = 'onnx-community/whisper-small-ar-ONNX' // the app's Arabic listener (src/speech/whisper.worker.ts)
const DTYPE = 'q4'
const STYLE_AR = 'بيت، كتاب، سيارة، شجرة، مدرسة، باب، كرسي، شارع، كوب، حذاء'

interface Clip { file: string; row: number; age: string; dialect: string; gender: string; text: string; seconds: number }
const manifest: Clip[] = JSON.parse(readFileSync(join(CLIPS, 'manifest.json'), 'utf8'))
const cachePath = (p: string) => join(ROOT, `external/sada/whisper-${p}.json`)

async function run(prompt: 'none' | 'style') {
  const path = cachePath(prompt)
  const done: Record<string, string> = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  const [processor, tokenizer, model] = await Promise.all([
    AutoProcessor.from_pretrained(MODEL),
    AutoTokenizer.from_pretrained(MODEL),
    WhisperForConditionalGeneration.from_pretrained(MODEL, { dtype: DTYPE, device: 'cpu' }),
  ])
  const id = (t: string) => tokenizer.encode(t, { add_special_tokens: false })[0]
  const init = [id('<|startoftranscript|>'), id('<|ar|>'), id('<|transcribe|>'), id('<|notimestamps|>')]
  const decoder_input_ids = prompt === 'style'
    ? [id('<|startofprev|>'), ...tokenizer.encode(' ' + STYLE_AR, { add_special_tokens: false }), ...init]
    : init
  const t0 = Date.now()
  let n = 0
  for (const c of manifest) {
    if (c.file in done) continue
    const audio = readWav(join(CLIPS, c.file))
    const segs = segments(audio)
    const texts: string[] = []
    for (const w of segs.length ? compact(audio, segs) : []) {
      const { input_features } = await processor(w)
      const out = await model.generate({ inputs: input_features, decoder_input_ids, max_new_tokens: 200 })
      const t = tokenizer.decode(out[0].tolist().map(Number).slice(decoder_input_ids.length), { skip_special_tokens: true }).trim()
      if (!looped(t)) texts.push(t)
    }
    done[c.file] = texts.join(' ')
    if (++n % 20 === 0) { writeFileSync(path, JSON.stringify(done)); console.log(n, 'clips', Math.round((Date.now() - t0) / 1000), 's') }
  }
  writeFileSync(path, JSON.stringify(done))
}

const norm = (s: string) => tokens(s, 'ar').map(foldArabic).filter(Boolean)

/** Word-level edit distance. */
function edits(ref: string[], hyp: string[]): number {
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j)
  for (let i = 1; i <= ref.length; i++) {
    const cur = [i]
    for (let j = 1; j <= hyp.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[hyp.length]
}

/** Share of reference words the listener also wrote, in any position: closer to what word recall needs. */
function wordsHeard(ref: string[], hyp: string[]): number {
  const left = [...hyp]
  let k = 0
  for (const w of ref) { const i = left.indexOf(w); if (i >= 0) { k++; left.splice(i, 1) } }
  return k
}

interface GroupStat { clips: number; refWords: number; wer: number; werCi: [number, number]; heard: number; heardCi: [number, number] }

function stat(rows: { ref: string[]; hyp: string[] }[], seed: number): GroupStat {
  const agg = (rs: typeof rows) => {
    const n = rs.reduce((a, r) => a + r.ref.length, 0)
    return { wer: rs.reduce((a, r) => a + edits(r.ref, r.hyp), 0) / n, heard: rs.reduce((a, r) => a + wordsHeard(r.ref, r.hyp), 0) / n }
  }
  const all = agg(rows)
  // Bootstrap over clips (no speaker ids exist, so this understates the true uncertainty).
  const r = rng(seed), wers: number[] = [], heards: number[] = []
  for (let b = 0; b < 1000; b++) {
    const s = Array.from({ length: rows.length }, () => rows[Math.floor(r() * rows.length)])
    const a = agg(s); wers.push(a.wer); heards.push(a.heard)
  }
  const ci = (xs: number[]): [number, number] => { xs.sort((a, b) => a - b); return [round(xs[25]), round(xs[974])] }
  return { clips: rows.length, refWords: rows.reduce((a, x) => a + x.ref.length, 0), wer: round(all.wer), werCi: ci(wers), heard: round(all.heard), heardCi: ci(heards) }
}
const round = (x: number) => Math.round(x * 1000) / 1000

function report() {
  const out: Record<string, unknown> = {
    generated: new Date().toISOString().slice(0, 10),
    dataset: 'SADA 2022 test split (Saudi Data and AI Authority; Saudi TV programmes), CC BY-NC-SA 4.0, via huggingface.co/datasets/MohamedRashad/SADA22',
    sample: 'Every clip labelled Elderly (120) plus seeded random adult clips: 200 Khaliji, 100 Najdi, 100 Hijazi (seed 20261115, scripts/sada-extract.py)',
    model: `${MODEL} (${DTYPE}), the app's on-device Arabic listener, run in Node with the app's speech gate and windowing`,
    metric: 'Word error rate after the app\'s Arabic letter folding; "words heard" is the share of reference words that appear anywhere in the transcript. 95% bootstrap over clips.',
    caveats: [
      'TV speech, not older adults doing a memory check; sentences, not single words.',
      'Age and dialect are annotator labels; SADA has no speaker ids, so clips are not independent and intervals are too narrow.',
      'Reference transcripts are SADA\'s own and contain spelling variation that counts as error for every group alike.',
    ],
    results: {} as Record<string, unknown>,
  }
  const sources = [
    { key: 'appSetting', path: cachePath('style') },
    { key: 'noPrompt', path: cachePath('none') },
    // Jais-ASR (MBZUAI and Inception), 4-bit MLX build on this Mac: scripts/sada-jais.py
    { key: 'jaisAsr', path: join(ROOT, 'external/sada/jais.json') },
  ]
  for (const { key, path } of sources) {
    if (!existsSync(path)) continue
    const hyp: Record<string, string> = JSON.parse(readFileSync(path, 'utf8'))
    const rows = manifest.filter((c) => c.file in hyp).map((c) => ({ ...c, ref: norm(c.text), hyp: norm(hyp[c.file]) })).filter((r) => r.ref.length > 0)
    const groups: Record<string, typeof rows> = {
      'Older, Gulf (Khaliji)': rows.filter((r) => r.age === 'Elderly' && r.dialect === 'Khaliji'),
      'Older, other Saudi dialects': rows.filter((r) => r.age === 'Elderly' && r.dialect !== 'Khaliji'),
      'Older, all': rows.filter((r) => r.age === 'Elderly'),
      'Adult, Gulf (Khaliji)': rows.filter((r) => r.age === 'Adult' && r.dialect === 'Khaliji'),
      'Adult, Najdi': rows.filter((r) => r.age === 'Adult' && r.dialect === 'Najdi'),
      'Adult, Hijazi': rows.filter((r) => r.age === 'Adult' && r.dialect === 'Hijazi'),
      'Adult, all': rows.filter((r) => r.age === 'Adult'),
    }
    ;(out.results as Record<string, unknown>)[key] =Object.fromEntries(Object.entries(groups).map(([k, v], i) => [k, stat(v, 7 + i)]))
  }
  writeFileSync(join(ROOT, 'src/data/sada-bench.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(JSON.stringify(out.results, null, 1))
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'run') await run(arg === 'style' ? 'style' : 'none')
else if (cmd === 'report') report()
else console.log('usage: run <none|style> | report')
