// Scores the Jais-ASR transcripts (from scripts/jais-asr-transcribe.py) on exactly the clips the
// human-speech bench used, with the same matchers and the same outcome rules, so the two are comparable.
// Usage: npx tsx scripts/jais-asr-score.ts      (writes src/data/jais-asr-bench.json and prints tables;
// keeps the `withTemplates` block that scripts/jais-asr-templates.ts adds)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANIMALS, type Lang } from '../src/engine/lexicon'
import { matchClosedSet } from '../src/engine/match'
import { readYesNo } from '../src/engine/yesno'
import { DIGITS, readNumbers, wilson } from './human-speech-bench'

const ROOT = new URL('..', import.meta.url).pathname
const BENCH = JSON.parse(readFileSync(join(ROOT, 'src/data/human-speech-bench.json'), 'utf8'))
const OUT = join(ROOT, 'src/data/jais-asr-bench.json')

type Task = 'digits' | 'yes/no' | 'animals'
type Outcome = 'correct' | 'wrong' | 'nothing'
const taskOf = (w: string): Task => (DIGITS.includes(w) ? 'digits' : w === 'yes' || w === 'no' ? 'yes/no' : 'animals')

// Same rules as outcome() in scripts/human-speech-bench.ts (not exported there).
function outcome(lang: Lang, word: string, text: string): Outcome {
  if (!text.trim()) return 'nothing'
  const task = taskOf(word)
  if (task === 'digits') return readNumbers(text, lang).has(DIGITS.indexOf(word)) ? 'correct' : 'wrong'
  if (task === 'yes/no') return readYesNo(text, lang) === (word === 'yes') ? 'correct' : 'wrong'
  const row = ANIMALS.en.findIndex((r) => r[0] === word)
  return matchClosedSet(text, ANIMALS.en, 'en').has(row) ? 'correct' : 'wrong'
}

// Speaker id as the bench derives it: English word_SPEAKER_nohash or SPEAKER_nohash; Arabic first 8 chars.
function speaker(file: string, lang: Lang) {
  const f = file.split('/').pop()!
  if (lang === 'ar') return f.slice(0, 8)
  return f.includes('/_unknown_/') || file.includes('/_unknown_/') ? f.split('_')[1] : f.split('_')[0]
}

// Speaker-clustered bootstrap: resample speakers with replacement, 2000 draws, seeded (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const r3 = (x: number) => Math.round(x * 1000) / 1000
function bootstrap(rs: { speaker: string; ok: boolean }[], seed = 20261114): [number, number] {
  const by = new Map<string, [number, number]>()
  for (const x of rs) { const v = by.get(x.speaker) ?? [0, 0]; v[0] += x.ok ? 1 : 0; v[1]++; by.set(x.speaker, v) }
  const sp = [...by.values()], r = rng(seed), boots: number[] = []
  for (let b = 0; b < 2000 && sp.length; b++) {
    let k = 0, n = 0
    for (let i = 0; i < sp.length; i++) { const s = sp[Math.floor(r() * sp.length)]; k += s[0]; n += s[1] }
    boots.push(n ? k / n : 0)
  }
  boots.sort((a, b) => a - b)
  const q = (p: number) => boots[Math.min(boots.length - 1, Math.floor(p * boots.length))] ?? 0
  return [r3(q(0.025)), r3(q(0.975))]
}

interface Row { group: string; n: number; speakers: number; correct: number; wrong: number; nothing: number; correctCi: [number, number]; wrongCi: [number, number]; nothingCi: [number, number]; correctSpeakerBootstrap: [number, number]; wrongSpeakerBootstrap: [number, number]; nothingSpeakerBootstrap: [number, number] }
function summarise(group: string, rs: { speaker: string; outcome: Outcome }[]): Row {
  const n = rs.length, c = (o: Outcome) => rs.filter((x) => x.outcome === o).length
  const correct = c('correct'), wrong = c('wrong'), nothing = c('nothing')
  const b = (o: Outcome) => bootstrap(rs.map((x) => ({ speaker: x.speaker, ok: x.outcome === o })))
  return { group, n, speakers: new Set(rs.map((x) => x.speaker)).size, correct, wrong, nothing, correctCi: wilson(correct, n).map(r3) as [number, number], wrongCi: wilson(wrong, n).map(r3) as [number, number], nothingCi: wilson(nothing, n).map(r3) as [number, number], correctSpeakerBootstrap: b('correct'), wrongSpeakerBootstrap: b('wrong'), nothingSpeakerBootstrap: b('nothing') }
}

const pct = (x: number, n: number) => (n ? (100 * x / n).toFixed(0) : '-') + '%'
const ci = (c: [number, number]) => `${(c[0] * 100).toFixed(0)}-${(c[1] * 100).toFixed(0)}`

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const metaPath = join(ROOT, 'external/jais-asr/run-meta.json')
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null
const out: Record<string, unknown> = {
  generated: new Date().toISOString().slice(0, 10),
  model: meta?.model ?? 'IFM/Jais-ASR (bf16) via the official IFM/jais-asr Hugging Face Space, ZeroGPU',
  settings: meta?.settings ?? { languagePin: 'same as the clip language (ar or en)', diacritics: false, codeSwitch: false, decoding: 'greedy (Space default)', speechGate: 'none; raw clip sent, the model has its own no-speech signal' },
  runtime: meta?.runtime ?? null,
}
for (const lang of ['ar', 'en'] as Lang[]) {
  const path = join(ROOT, `external/jais-asr/transcripts-${lang}.json`)
  if (!existsSync(path)) continue
  const tr: Record<string, { word: string; text: string; language: string; refused: boolean; truncated: boolean; gpuSeconds: number | null; wallSeconds: number }> = JSON.parse(readFileSync(path, 'utf8'))
  const used: { file: string; word: string; text: string; outcome: Outcome }[] = BENCH[lang].clipsUsed
  const missing = used.filter((c) => !tr[c.file])
  // Check: the outcome rules here give the stored Whisper outcome for every stored Whisper transcript.
  const disagree = used.filter((c) => outcome(lang, c.word, c.text) !== c.outcome)
  if (disagree.length) throw new Error(`${lang}: outcome() disagrees with the bench on ${disagree.length} Whisper clips, e.g. ${JSON.stringify(disagree[0])}`)
  const results = used.filter((c) => tr[c.file]).map((c) => {
    const t = tr[c.file]
    return { file: c.file, word: c.word, task: taskOf(c.word), speaker: speaker(c.file, lang), text: t.text, outcome: outcome(lang, c.word, t.text), whisperText: c.text, whisperOutcome: c.outcome, detected: t.language, refused: t.refused, gpuSeconds: t.gpuSeconds, wallSeconds: t.wallSeconds }
  })
  const words = [...new Set(results.map((x) => x.word))]
  const tasks = [...new Set(results.map((x) => x.task))]
  const gpu = results.map((r) => r.gpuSeconds).filter((x): x is number => x != null).sort((a, b) => a - b)
  const wall = results.map((r) => r.wallSeconds).sort((a, b) => a - b)
  const med = (xs: number[]) => xs[Math.floor(xs.length / 2)]
  // Paired comparison with the on-device Whisper result on the same clip.
  const pair = { bothCorrect: 0, jaisOnly: 0, whisperOnly: 0, neither: 0 }
  for (const r of results) {
    const j = r.outcome === 'correct', w = r.whisperOutcome === 'correct'
    if (j && w) pair.bothCorrect++; else if (j) pair.jaisOnly++; else if (w) pair.whisperOnly++; else pair.neither++
  }
  const errors: Record<string, Record<string, number>> = {}
  for (const r of results.filter((x) => x.outcome !== 'correct')) { const e = (errors[r.word] ??= {}); e[r.text] = (e[r.text] ?? 0) + 1 }
  const detectedCounts: Record<string, number> = {}
  for (const r of results) detectedCounts[r.detected] = (detectedCounts[r.detected] ?? 0) + 1
  // A miss that names another list word (a different digit, or the opposite answer for yes/no) would give
  // credit for the wrong word in a closed-set task. Counted for both listeners.
  const otherWord = (word: string, text: string) => {
    const t = taskOf(word)
    if (t === 'digits') return [...readNumbers(text, lang)].some((d) => d !== DIGITS.indexOf(word))
    if (t === 'yes/no') return readYesNo(text, lang) === (word !== 'yes')
    return false
  }
  const namesOtherWord = { jais: results.filter((r) => r.outcome !== 'correct' && otherWord(r.word, r.text)).length, whisper: results.filter((r) => r.whisperOutcome !== 'correct' && otherWord(r.word, r.whisperText)).length }
  const block = {
    namesOtherWord,
    clips: results.length, missing: missing.length,
    medianGpuSecondsPerClip: gpu.length ? med(gpu) : null, meanGpuSecondsPerClip: gpu.length ? +(gpu.reduce((a, b) => a + b, 0) / gpu.length).toFixed(2) : null,
    medianWallSecondsPerClip: med(wall),
    byWord: words.map((w) => summarise(w, results.filter((x) => x.word === w))),
    byTask: tasks.map((t) => summarise(t, results.filter((x) => x.task === t))),
    overall: summarise('all', results),
    whisperSameClips: summarise('whisper', results.map((r) => ({ speaker: r.speaker, outcome: r.whisperOutcome }))),
    pairedVsWhisper: pair,
    refused: results.filter((r) => r.refused).length,
    detectedLanguage: detectedCounts,
    topMisses: Object.fromEntries(Object.entries(errors).map(([w, m]) => [w, Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)])),
    clipsUsed: results,
  }
  out[lang] = block
  console.log(`\n### ${lang === 'en' ? 'English' : 'Arabic'} (${results.length} clips${missing.length ? `, ${missing.length} missing` : ''})\n`)
  console.log('| Word or task | Clips | Speakers | Correct (Wilson; speaker bootstrap) | Wrong word (Wilson; speaker bootstrap) | Nothing heard (Wilson; speaker bootstrap) |\n|---|---|---|---|---|---|')
  const whisperRows = [...tasks.map((t) => ({ ...summarise(t, results.filter((x) => x.task === t).map((r) => ({ speaker: r.speaker, outcome: r.whisperOutcome }))), group: `Whisper, task: ${t}` })), { ...block.whisperSameClips, group: 'Whisper (current app), same clips' }]
  for (const r of [...block.byWord, ...block.byTask.map((x) => ({ ...x, group: `Task: ${x.group}` })), { ...block.overall, group: `All ${lang === 'en' ? 'English' : 'Arabic'}` }, ...whisperRows]) {
    console.log(`| ${r.group} | ${r.n} | ${r.speakers} | ${pct(r.correct, r.n)} (${ci(r.correctCi)}; ${ci(r.correctSpeakerBootstrap)}) | ${pct(r.wrong, r.n)} (${ci(r.wrongCi)}; ${ci(r.wrongSpeakerBootstrap)}) | ${pct(r.nothing, r.n)} (${ci(r.nothingCi)}; ${ci(r.nothingSpeakerBootstrap)}) |`)
  }
  ;(block as Record<string, unknown>).whisperByTask = whisperRows.slice(0, -1)
  console.log('misses naming another list word', namesOtherWord)
  console.log('paired', pair, 'refused', block.refused, 'gpu median', block.medianGpuSecondsPerClip, 'mean', block.meanGpuSecondsPerClip, 'wall median', block.medianWallSecondsPerClip)
  console.log('detected', detectedCounts)
  console.log('misses', JSON.stringify(block.topMisses))
}
if (prev.withTemplates) out.withTemplates = prev.withTemplates
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
