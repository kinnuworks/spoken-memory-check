// Makes every computer-voice recording the site plays, with Microsoft Azure neural voices,
// whose output may be used in a public and commercial setting on a paid Speech resource.
// The recordings are synthetic stand-ins for a person and the app labels them so.
//
//   public/samples/full/<lang>/  the full recorded check: reg-01..10 (each list word said back),
//                                recall-1, animals, recall-2, answer (16 kHz mono 16-bit WAV)
//   public/samples/synthetic-voice-animals-<lang>.wav   twenty animals for the short recorded check
//   public/din/<lang>/<d>.wav    hearing-test digits 1-6, 8, 9 (22.05 kHz)
//
// Needs AZURE_SPEECH_KEY (and optionally AZURE_SPEECH_REGION, default uaenorth) in .env.
// Usage: npx tsx scripts/make-voice-audio.ts [--dry-run]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { ANIMALS, WORD_LISTS, type Lang } from '../src/engine/lexicon'
import { matchClosedSet } from '../src/engine/match'

const DRY = process.argv.includes('--dry-run')

function env(): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync('.env')) return out
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const E = { ...env(), ...process.env } as Record<string, string | undefined>
const KEY = E.AZURE_SPEECH_KEY
const REGION = E.AZURE_SPEECH_REGION || 'uaenorth'

/** UAE Arabic and US English neural voices. Override with AZURE_TTS_VOICE_AR / AZURE_TTS_VOICE_EN. */
const VOICE: Record<Lang, { name: string; locale: string }> = {
  ar: { name: E.AZURE_TTS_VOICE_AR || 'ar-AE-HamdanNeural', locale: 'ar-AE' },
  en: { name: E.AZURE_TTS_VOICE_EN || 'en-US-AvaNeural', locale: 'en-US' },
}

// What the voice says. The recorded check page scores the listeners against these same lists.
const SCRIPT: Record<Lang, { recall1: string[]; animals: string[]; recall2: string[]; answer: string; twenty: string[]; digits: string[] }> = {
  en: {
    recall1: ['river', 'candle', 'window', 'garden', 'carpet', 'bridge', 'mirror', 'jacket'],
    animals: ['dog', 'cat', 'horse', 'cow', 'lion', 'tiger', 'elephant', 'giraffe', 'camel', 'monkey', 'rabbit', 'eagle', 'shark', 'sheep'],
    recall2: ['river', 'window', 'garden', 'mirror', 'candle', 'butter'],
    answer: 'No.',
    twenty: ['dog', 'cat', 'horse', 'cow', 'sheep', 'goat', 'camel', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'bear', 'wolf', 'fox', 'rabbit', 'eagle', 'shark', 'snake'],
    digits: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  },
  ar: {
    recall1: ['نهر', 'شمعة', 'نافذة', 'حديقة', 'كرسي', 'جسر', 'مرآة', 'معطف'],
    animals: ['جمل', 'حصان', 'قطة', 'كلب', 'أسد', 'نمر', 'فيل', 'زرافة', 'غزال', 'صقر', 'سمكة', 'بقرة', 'خروف', 'ثعلب'],
    recall2: ['نهر', 'نافذة', 'حديقة', 'مرآة', 'شمعة', 'زبدة'],
    answer: 'لا.',
    twenty: ['جمل', 'حصان', 'كلب', 'قطة', 'بقرة', 'خروف', 'ماعز', 'حمار', 'أسد', 'نمر', 'فيل', 'زرافة', 'قرد', 'دب', 'ذئب', 'ثعلب', 'غزال', 'أرنب', 'صقر', 'سمكة'],
    digits: ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'],
  },
}
const DIN_DIGITS = [1, 2, 3, 4, 5, 6, 8, 9]
const GAPS = [900, 1300, 700, 1600, 1000, 800, 1400, 1100, 1200, 900, 1500, 800, 1000, 1300]
/** Speaking-rate changes for the ten words said back, so the answer key is not ten identical takes. */
const RATES = ['-5%', '+4%', '-10%', '+8%', '0%', '-7%', '+6%', '+2%', '-3%', '+10%']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function ssml(lang: Lang, body: string, rate = '0%'): string {
  const v = VOICE[lang]
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}"><voice name="${v.name}"><prosody rate="${rate}">${body}</prosody></voice></speak>`
}
const spaced = (words: string[]) => words.map((w, i) => (i ? `<break time="${GAPS[(i - 1) % GAPS.length]}ms"/>` : '') + esc(w)).join(' ')

async function synth(xml: string, format: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': KEY!, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': format, 'User-Agent': 'voice-audio-script' },
      body: xml,
    })
    if (r.ok) return Buffer.from(await r.arrayBuffer())
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise((res) => setTimeout(res, 1500 * attempt)); continue }
    throw new Error(`Azure TTS ${r.status}: ${(await r.text()).slice(0, 200)}`)
  }
}

/** Trims leading and trailing silence from a 16-bit mono WAV, keeping a short pad. */
function trimWav(wav: Buffer, padMs = 30): Buffer {
  let off = 12, fmt: { rate: number } | null = null, dataStart = -1, dataLen = 0
  while (off + 8 <= wav.length) {
    const id = wav.toString('ascii', off, off + 4), len = wav.readUInt32LE(off + 4)
    if (id === 'fmt ') fmt = { rate: wav.readUInt32LE(off + 12) }
    if (id === 'data') { dataStart = off + 8; dataLen = Math.min(len, wav.length - off - 8); break }
    off += 8 + len + (len % 2)
  }
  if (!fmt || dataStart < 0) return wav
  const n = dataLen >> 1
  const s = (i: number) => wav.readInt16LE(dataStart + i * 2)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(s(i)))
  const thr = peak * 0.02
  let a = 0, b = n - 1
  while (a < n && Math.abs(s(a)) < thr) a++
  while (b > a && Math.abs(s(b)) < thr) b--
  const pad = Math.round((fmt.rate * padMs) / 1000)
  a = Math.max(0, a - pad); b = Math.min(n - 1, b + pad)
  const pcm = wav.subarray(dataStart + a * 2, dataStart + (b + 1) * 2)
  const head = Buffer.from(wav.subarray(0, dataStart))
  head.writeUInt32LE(head.length - 8 + pcm.length, 4)
  head.writeUInt32LE(pcm.length, dataStart - 4)
  return Buffer.concat([head, pcm])
}

function checkScripts() {
  // Every word the voice says for the animal tasks must be an accepted animal, each a different one.
  for (const lang of ['en', 'ar'] as Lang[]) {
    for (const [name, words] of [['animals', SCRIPT[lang].animals], ['twenty', SCRIPT[lang].twenty]] as const) {
      const rows = matchClosedSet(words.join(' '), ANIMALS[lang], lang)
      if (rows.size !== words.length) throw new Error(`${lang} ${name}: ${words.length} animals said but ${rows.size} distinct accepted animals`)
    }
    const list = WORD_LISTS[lang][0]
    for (const w of [...SCRIPT[lang].recall1, ...SCRIPT[lang].recall2]) if (!list.includes(w) && w !== SCRIPT[lang].recall1[4]) throw new Error(`${lang}: ${w} is not on list 1`)
  }
}

async function main() {
  checkScripts()
  const jobs: { out: string; xml: string; format: string; trim: boolean }[] = []
  const F16 = 'riff-16khz-16bit-mono-pcm', F22 = 'riff-22050hz-16bit-mono-pcm'
  for (const lang of ['en', 'ar'] as Lang[]) {
    const s = SCRIPT[lang], dir = `public/samples/full/${lang}`
    WORD_LISTS[lang][0].forEach((w, i) => jobs.push({ out: `${dir}/reg-${String(i + 1).padStart(2, '0')}.wav`, xml: ssml(lang, esc(w), RATES[i]), format: F16, trim: true }))
    jobs.push({ out: `${dir}/recall-1.wav`, xml: ssml(lang, spaced(s.recall1), '-3%'), format: F16, trim: false })
    jobs.push({ out: `${dir}/animals.wav`, xml: ssml(lang, spaced(s.animals)), format: F16, trim: false })
    jobs.push({ out: `${dir}/recall-2.wav`, xml: ssml(lang, spaced(s.recall2), '-6%'), format: F16, trim: false })
    jobs.push({ out: `${dir}/answer.wav`, xml: ssml(lang, esc(s.answer)), format: F16, trim: false })
    jobs.push({ out: `public/samples/synthetic-voice-animals-${lang}.wav`, xml: ssml(lang, spaced(s.twenty)), format: F16, trim: false })
    for (const d of DIN_DIGITS) jobs.push({ out: `public/din/${lang}/${d}.wav`, xml: ssml(lang, esc(s.digits[d])), format: F22, trim: true })
  }
  const chars = jobs.reduce((n, j) => n + j.xml.length, 0)
  console.log(`${jobs.length} recordings, ${chars} characters of SSML, voices ${VOICE.ar.name} and ${VOICE.en.name}, region ${REGION}`)
  if (DRY) return
  if (!KEY) { console.error('AZURE_SPEECH_KEY is not set (add it to .env)'); process.exit(1) }
  for (const j of jobs) {
    const wav = await synth(j.xml, j.format)
    mkdirSync(j.out.slice(0, j.out.lastIndexOf('/')), { recursive: true })
    writeFileSync(j.out, j.trim ? trimWav(wav) : wav)
    process.stdout.write('.')
  }
  writeFileSync('public/samples/VOICES.txt', `Every recording under samples/ and din/ is synthetic speech made with Microsoft Azure neural text to speech (${VOICE.ar.name} for Arabic, ${VOICE.en.name} for English), generated ${new Date().toISOString().slice(0, 10)} by scripts/make-voice-audio.ts. No person was recorded.\n`)
  console.log(`\ndone: ${jobs.length} files`)
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1) })
