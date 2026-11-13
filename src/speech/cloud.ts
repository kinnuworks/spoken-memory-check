import type { Lang } from '../engine/lexicon'

// Third listener: a speech service with a Gulf Arabic model in the UAE North region. The
// browser streams the recording straight to that region with a ten-minute token from this
// site's own function; no audio passes through the function. Used only with consent.
export const CLOUD_NAME = 'Cloud (UAE)'
const LOCALE: Record<Lang, string> = { en: 'en-US', ar: 'ar-AE' }

let status: Promise<boolean> | null = null

/** Whether the cloud listener is set up on this deployment. */
export function cloudAvailable(): Promise<boolean> {
  status ??= fetch('api/speech-token', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((j: { available?: boolean }) => Boolean(j.available))
    .catch(() => false)
  return status
}

/** Float samples (16 kHz mono) to 16-bit PCM. */
export function toPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff
  return out
}

/** Transcribes a finished 16 kHz mono clip in the UAE region. Resolves to null if anything fails. */
export async function transcribeCloud(audio: Float32Array, lang: Lang, timeoutMs = 90000): Promise<string | null> {
  try {
    const t = await fetch('api/speech-token', { method: 'POST' })
    if (!t.ok) return null
    const { token, region } = (await t.json()) as { token?: string; region: string }
    if (!token) return null
    const sdk = await import('microsoft-cognitiveservices-speech-sdk')
    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region)
    config.speechRecognitionLanguage = LOCALE[lang]
    const push = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1))
    push.write(toPcm16(audio).buffer as ArrayBuffer)
    push.close()
    const rec = new sdk.SpeechRecognizer(config, sdk.AudioConfig.fromStreamInput(push))
    const parts: string[] = []
    const text = await new Promise<string | null>((resolve) => {
      const done = (v: string | null) => { window.clearTimeout(timer); rec.stopContinuousRecognitionAsync(() => rec.close(), () => rec.close()); resolve(v) }
      const timer = window.setTimeout(() => done(null), timeoutMs)
      rec.recognized = (_s, e) => { if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) parts.push(e.result.text) }
      rec.canceled = (_s, e) => done(e.reason === sdk.CancellationReason.EndOfStream ? parts.join(' ') : null)
      rec.sessionStopped = () => done(parts.join(' '))
      rec.startContinuousRecognitionAsync(undefined, () => done(null))
    })
    return text === null ? null : text.trim()
  } catch {
    return null
  }
}
