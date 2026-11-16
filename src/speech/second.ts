import type { Lang } from '../engine/lexicon'

// Main-thread handle on the second listener (see whisper.worker.ts).
export const SECOND_NAME = 'On-device'
export const DOWNLOAD_MB: Record<Lang, number> = { en: 77, ar: 165 }
/** Where the one-time download comes from. The Arabic model is a smaller copy served by this site. */
export const DOWNLOAD_FROM: Record<Lang, string> = { en: 'huggingface.co', ar: 'this site' }

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()
let onProgress: ((percent: number) => void) | null = null
let ready: Partial<Record<Lang, Promise<void>>> = {}

// A phone that runs out of memory loading or running the model is closed by the browser without
// warning, and the page reloads. So the attempt is written down first, and cleared when it ends
// or when the person leaves the page normally. If the page finds an attempt still open, the
// last one died with the page, and this device is not offered the model for that language again.
const KEY = (lang: Lang) => `device-listener-${lang}`
function store(): Storage | null {
  try { return window.localStorage } catch { return null }
}
let open: Lang | null = null
function begin(lang: Lang) {
  open = lang
  store()?.setItem(KEY(lang), 'running')
}
function end(lang: Lang, ok: boolean) {
  if (open === lang) open = null
  store()?.setItem(KEY(lang), ok ? 'ok' : 'failed')
}
if (typeof window !== 'undefined') {
  for (const l of ['en', 'ar'] as Lang[]) if (store()?.getItem(KEY(l)) === 'running') store()?.setItem(KEY(l), 'crashed')
  window.addEventListener('pagehide', () => { if (open) store()?.removeItem(KEY(open)) })
}

/** True when an earlier attempt to run the model in this language ended with the page itself closing, as happens when a phone runs out of memory. */
export function secondCrashedBefore(lang: Lang): boolean {
  return store()?.getItem(KEY(lang)) === 'crashed'
}

/** Whether to offer the on-device listener here. Weak devices, and any device where it closed the page before, say so and offer another way. */
export function secondSupported(lang?: Lang): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return false
  if (lang && secondCrashedBefore(lang)) return false
  if (nav.connection?.saveData) return false
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false
  return (nav.hardwareConcurrency ?? 4) >= 2
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
  if (ready[lang] === undefined) begin(lang)
  ready[lang] ??= call('load', lang).then(() => { end(lang, true) }).catch((e) => { end(lang, false); ready = { ...ready, [lang]: undefined }; throw e })
  return ready[lang] as Promise<void>
}

export function secondLoading(lang: Lang): boolean {
  return ready[lang] !== undefined
}

/** Transcribes a finished 16 kHz mono clip on this device. Resolves to null if it fails or takes too long. */
export async function transcribeSecond(audio: Float32Array, lang: Lang, timeoutMs = 90000): Promise<string | null> {
  try {
    await loadSecond(lang)
    begin(lang)
    const text = await Promise.race([
      call('transcribe', lang, audio.slice()),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ])
    end(lang, text !== null)
    return text
  } catch {
    end(lang, false)
    return null
  }
}
