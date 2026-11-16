// Makes every synthetic recording the site plays with open voices whose licences allow public and
// commercial use, in place of the macOS system voices (Apple's licence allows those only for
// personal, non-commercial use). Same 46 recordings as scripts/make-voice-audio.ts, from the same
// script (scripts/voice-script.ts). The app labels them as a computer voice; no person is recorded.
//
// Needs, under external/ (never committed):
//   external/tts/vits-piper-en_US-ljspeech-medium/   and   external/tts/nabra-82m-arabic-int8/
//     from https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
//   external/tts-venv/   python3.12 -m venv external/tts-venv && external/tts-venv/bin/pip install sherpa-onnx==1.13.8 soundfile numpy
// Usage: npx tsx scripts/make-open-voice-audio.ts [en|ar]   (one language only, or both)
//
// Tested 17 Nov with the site's own listeners: English (LJ Speech voice, no random variation) scored
// 26 of 27 words on the recorded check, the listeners agreeing on every item. Arabic (Nabra-82M) is
// not good enough yet: the Arabic listener heard 6 to 9 of 14 animals however it was spoken, and the
// check came out not scored. Arabic is therefore not remade with this script for now.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Lang } from '../src/engine/lexicon'
import { GAPS, SPOKEN_AR, checkScripts, jobs } from './voice-script'

checkScripts()
const only = process.argv[2] as Lang | undefined
if (only && only !== 'en' && only !== 'ar') throw new Error('usage: make-open-voice-audio.ts [en|ar]')
const all = jobs().filter((j) => !only || j.lang === only)
// The Arabic voice reads through espeak-ng, so it gets the vowelled spelling of each word.
const spoken = all.map((j) => (j.lang === 'ar' ? { ...j, words: j.words.map((w) => { if (!SPOKEN_AR[w]) throw new Error(`no vowelled spelling for ${w}`); return SPOKEN_AR[w] }) } : j))
const tmp = mkdtempSync(join(tmpdir(), 'open-voices-'))
try {
  writeFileSync(join(tmp, 'jobs.json'), JSON.stringify({ gaps: GAPS, jobs: spoken }))
  execFileSync('external/tts-venv/bin/python', ['-I', 'scripts/open_voice_synth.py', join(tmp, 'jobs.json'), 'external/tts'], { stdio: 'inherit' })
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
const SOURCE: Record<Lang, string> = {
  en: 'Piper voice en_US-ljspeech (medium), trained on the LJ Speech recordings (public domain); Piper voices are MIT-licensed. Made by scripts/make-open-voice-audio.ts through sherpa-onnx (Apache-2.0).',
  ar: 'Nabra-82M (Modern Standard Arabic) by oddadmix, a fine-tune of Kokoro-82M, Apache-2.0. Made by scripts/make-open-voice-audio.ts through sherpa-onnx (Apache-2.0).',
}
const STILL_APPLE: Record<Lang, string> = {
  en: 'Still the macOS Samantha system voice, whose licence allows only personal, non-commercial use. To be replaced before submission.',
  ar: 'Still the macOS Majed system voice, whose licence allows only personal, non-commercial use. To be replaced before submission.',
}
const made = new Set(all.map((j) => j.lang))
writeFileSync('public/samples/VOICES.txt', `Every recording under samples/ and din/ is synthetic speech; no person was recorded. Updated ${new Date().toISOString().slice(0, 10)}.
English: ${made.has('en') ? SOURCE.en : STILL_APPLE.en}
Arabic: ${made.has('ar') ? SOURCE.ar : STILL_APPLE.ar}
`)
console.log(`${all.length} recordings written; voice credits in public/samples/VOICES.txt`)
