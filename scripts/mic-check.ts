// Runs "Try it with your voice" through the browser's real microphone path: Chromium is started
// with a recorded voice as its microphone (its fake audio capture), so getUserMedia, the recorder,
// the on-device speech model and the scoring all run exactly as they do for a person. It is still
// a computer voice, not a person, and not a phone.
//
// The recording loops the three sound-check words mixed with animal names, so any 7-second
// stretch holds sound-check words and any 20-second stretch holds several animals. The check
// passes when the sound check passes, at least 3 animals are credited, and every credited animal
// is one the recording says. A control run with silence as the microphone must fail the sound
// check, so nothing is scored.
//
// usage: npx tsx scripts/mic-check.ts [base-url] [en|ar]   (default: the live site, both languages)
// Needs the open English voice and the Arabic word batches (see scripts/make-open-voice-audio.ts).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { ANIMALS, SOUND_CHECK_WORDS, type Lang } from '../src/engine/lexicon'

const BASE = (process.argv[2] ?? process.env.LIVE_URL ?? 'https://spoken-memory-check.vercel.app').replace(/\/$/, '')
const LANGS = (process.argv[3] ? [process.argv[3]] : ['en', 'ar']) as Lang[]
const SAID: Record<Lang, string[]> = {
  en: ['horse', 'cat', 'dog', 'lion', 'camel', 'goat', 'sheep', 'cow', 'tiger', 'elephant', 'zebra', 'monkey'],
  ar: ['حصان', 'قطة', 'كلب', 'أسد', 'جمل', 'ماعز', 'خروف', 'بقرة', 'نمر', 'فيل', 'زرافة', 'قرد'],
}

// Every said animal must be a listed animal, or the check would test nothing.
for (const lang of LANGS) for (const a of SAID[lang]) if (!ANIMALS[lang].some((row) => row.includes(a))) throw new Error(`${a} is not in the ${lang} animal list`)

function words(lang: Lang): string[] {
  const sc = SOUND_CHECK_WORDS[lang]
  return SAID[lang].flatMap((a, i) => [sc[i % sc.length], a])
}

function makeAudio(lang: Lang, dir: string): string {
  const out = join(dir, `mic-${lang}.wav`)
  const job = { out, lang, words: words(lang), ratePct: 0, sampleRate: 48000, trim: false }
  const spec = join(dir, `mic-${lang}.json`)
  writeFileSync(spec, JSON.stringify({ gaps: [700], jobs: [job] }))
  const py = lang === 'en' ? ['scripts/open_voice_synth.py', spec, 'external/tts'] : ['scripts/el_voice_synth.py', spec, 'external/el-ar']
  execFileSync('external/tts-venv/bin/python', ['-I', ...py], { stdio: 'inherit' })
  return out
}

function rowOf(lang: Lang, label: string): number {
  return ANIMALS[lang].findIndex((row) => row.includes(label))
}

async function silence(dir: string) {
  const wav = join(dir, 'mic-silence.wav')
  execFileSync('external/tts-venv/bin/python', ['-I', '-c', 'import sys, numpy, soundfile; soundfile.write(sys.argv[1], numpy.zeros(48000 * 10, dtype="int16"), 48000, subtype="PCM_16")', wav])
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] })
  try {
    const page = await (await browser.newContext({ permissions: ['microphone'] })).newPage()
    await page.goto(`${BASE}/#/try`)
    await page.getByRole('button', { name: 'Start the sound check' }).click()
    const outcome = page.getByRole('heading', { name: /We can hear you|We can't hear you clearly here|The microphone isn't available here/ })
    await outcome.waitFor({ timeout: 10 * 60_000 })
    const text = await outcome.innerText()
    if (text !== "We can't hear you clearly here") throw new Error(`silence gave "${text}"`)
    return { lang: 'silence', ok: true, detail: 'silence as the microphone fails the sound check, so nothing is scored' }
  } finally {
    await browser.close()
  }
}

async function run(lang: Lang, wav: string) {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] })
  try {
    const context = await browser.newContext({ permissions: ['microphone'] })
    const page = await context.newPage()
    await page.goto(`${BASE}/#/try`)
    if (lang === 'ar') await page.getByRole('button', { name: 'العربية' }).click()
    const t0 = Date.now()
    await page.getByRole('button', { name: 'Start the sound check' }).click()
    const outcome = page.getByRole('heading', { name: /We can hear you|We can't hear you clearly here|The microphone isn't available here/ })
    await outcome.waitFor({ timeout: 10 * 60_000 })
    const soundText = await outcome.innerText()
    if (soundText !== 'We can hear you') throw new Error(`sound check: "${soundText}"`)
    await page.getByRole('button', { name: 'Start naming animals' }).click()
    const result = page.getByRole('heading', { name: 'What we heard' })
    await result.waitFor({ timeout: 5 * 60_000 })
    const total = (await page.locator('p.big').first().innerText()).trim()
    const chips = await page.locator('.chip').allInnerTexts()
    const said = new Set(SAID[lang].map((a) => rowOf(lang, a)))
    const wrong = chips.filter((c) => !said.has(rowOf(lang, c.trim())))
    if (chips.length < 3) throw new Error(`only ${chips.length} animals credited (${total})`)
    if (wrong.length) throw new Error(`credited animals the recording never says: ${wrong.join(', ')}`)
    return { lang, ok: true, detail: `sound check passed; ${total} credited in 20 s, all said by the recording (${chips.join(', ')}); ${Math.round((Date.now() - t0) / 1000)} s in all` }
  } finally {
    await browser.close()
  }
}

const dir = join('output', 'mic-check')
mkdirSync(dir, { recursive: true })
const rows = []
for (const lang of LANGS) {
  const wav = makeAudio(lang, dir)
  try {
    rows.push(await run(lang, wav))
  } catch (e) {
    rows.push({ lang, ok: false, detail: String((e as Error).message ?? e).split('\n')[0].slice(0, 200) })
  }
  const r = rows[rows.length - 1]
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  microphone path, ${lang}: ${r.detail}`)
}
try {
  rows.push(await silence(dir))
} catch (e) {
  rows.push({ lang: 'silence', ok: false, detail: String((e as Error).message ?? e).split('\n')[0].slice(0, 200) })
}
console.log(`${rows[rows.length - 1].ok ? 'PASS' : 'FAIL'}  microphone path, control: ${rows[rows.length - 1].detail}`)
if (process.env.MIC_CHECK_NO_WRITE !== '1') writeFileSync('src/data/mic-check.json', JSON.stringify({ url: BASE, ranAt: new Date().toISOString(), voice: 'computer voice fed in as the microphone (Chromium fake audio capture), not a person', rows }, null, 1) + '\n')
if (rows.some((r) => !r.ok)) process.exit(1)
