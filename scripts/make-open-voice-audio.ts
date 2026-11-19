// Makes every synthetic recording the site plays with open voices whose licences allow public and
// commercial use, in place of the macOS system voices (Apple's licence allows those only for
// personal, non-commercial use). Same 46 recordings as scripts/make-voice-audio.ts, from the same
// script (scripts/voice-script.ts). The app labels them as a computer voice; no person is recorded.
//
// Needs, under external/ (never committed):
//   external/tts/vits-piper-en_US-ljspeech-medium/   and   external/el-ar/batch1.mp3 to batch4.mp3
//     from https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
//   external/tts-venv/   python3.12 -m venv external/tts-venv && external/tts-venv/bin/pip install sherpa-onnx==1.13.8 soundfile numpy
// Usage: npx tsx scripts/make-open-voice-audio.ts [en|ar]   (one language only, or both)
//
// English: Piper (LJ Speech voice, no random variation); 26 of 27 words on the recorded check, 17 Nov.
// Arabic: an open voice (Nabra-82M) was tried first and the Arabic listener heard only 6 to 9 of 14
// animals, so the Arabic words come from ElevenLabs instead (scripts/el_voice_synth.py, 19 Nov).
// The batch files are under external/el-ar/ (never committed).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Lang } from '../src/engine/lexicon'
import { GAPS, checkScripts, jobs } from './voice-script'

checkScripts()
const only = process.argv[2] as Lang | undefined
if (only && only !== 'en' && only !== 'ar') throw new Error('usage: make-open-voice-audio.ts [en|ar]')
const all = jobs().filter((j) => !only || j.lang === only)
const tmp = mkdtempSync(join(tmpdir(), 'open-voices-'))
try {
  // English: Piper through sherpa-onnx. Arabic: words made with ElevenLabs (see scripts/el_voice_synth.py).
  const en = all.filter((j) => j.lang === 'en')
  const ar = all.filter((j) => j.lang === 'ar')
  if (en.length) {
    writeFileSync(join(tmp, 'en.json'), JSON.stringify({ gaps: GAPS, jobs: en }))
    execFileSync('external/tts-venv/bin/python', ['-I', 'scripts/open_voice_synth.py', join(tmp, 'en.json'), 'external/tts'], { stdio: 'inherit' })
  }
  if (ar.length) {
    writeFileSync(join(tmp, 'ar.json'), JSON.stringify({ gaps: GAPS, jobs: ar }))
    execFileSync('external/tts-venv/bin/python', ['-I', 'scripts/el_voice_synth.py', join(tmp, 'ar.json'), 'external/el-ar'], { stdio: 'inherit' })
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
const SOURCE: Record<Lang, string> = {
  en: 'Piper voice en_US-ljspeech (medium), trained on the LJ Speech recordings (public domain); Piper voices are MIT-licensed. Made by scripts/make-open-voice-audio.ts through sherpa-onnx (Apache-2.0).',
  ar: 'ElevenLabs text to speech (premade voice "Roger", model eleven_multilingual_v2), made on a paid Starter plan whose terms allow commercial use of the audio. Joined into recordings by scripts/el_voice_synth.py.',
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
