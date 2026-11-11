import type { Lang } from '../engine/lexicon'

// Main-thread handle on the second listener (see whisper.worker.ts).
export const SECOND_NAME = 'On-device'
export const DOWNLOAD_MB: Record<Lang, number> = { en: 77, ar: 249 }

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()
let onProgress: ((percent: number) => void) | null = null
let ready: Partial<Record<Lang, Promise<void>>> = {}

/** Whether to offer the second listener on this device. Weak devices and iPhones score with one listener and say so. */
export function secondSupported(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return false
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return false
  if (nav.connection?.saveData) return false
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false
  return (nav.hardwareConcurrency ?? 2) >= 4
}

function call(type: 'load' | 'transcribe', lang: Lang, audio?: Float32Array): Promise<string> {
  if (!worker) {
    worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ type: string; id?: number; text?: string; message?: string; percent?: number }>) => {
      const m = e.data
      if (m.type === 'progress') return onProgress?.(m.percent ?? 0)
      const w = waiting.get(m.id as number)
      if (!w) return
      waiting.delete(m.id as number)
      if (m.type === 'done') w.resolve(m.text ?? '')
      else w.reject(new Error(m.message))
    }
  }
  const id = ++seq
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    worker!.postMessage({ type, id, lang, audio }, audio ? [audio.buffer] : [])
  })
}

/** Starts the one-time model download for a language. Safe to call more than once. */
export function loadSecond(lang: Lang, progress?: (percent: number) => void): Promise<void> {
  if (progress) onProgress = progress
  ready[lang] ??= call('load', lang).then(() => undefined).catch((e) => { ready = { ...ready, [lang]: undefined }; throw e })
  return ready[lang] as Promise<void>
}

export function secondLoading(lang: Lang): boolean {
  return ready[lang] !== undefined
}

/** Transcribes a finished 16 kHz mono clip on this device. Resolves to null if it fails or takes too long. */
export async function transcribeSecond(audio: Float32Array, lang: Lang, timeoutMs = 90000): Promise<string | null> {
  try {
    await loadSecond(lang)
    return await Promise.race([
      call('transcribe', lang, audio.slice()),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ])
  } catch {
    return null
  }
}
