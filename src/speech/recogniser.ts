import type { Lang } from '../engine/lexicon'

/** The recogniser puts its stop function here so the caller can end listening early. */
export interface ListenControl { stop?: () => void }

export interface Recogniser {
  name: string
  /** Listens for a fixed time and resolves with everything it heard. */
  listen(lang: Lang, ms: number, onPartial: (text: string) => void, control?: ListenControl): Promise<string>
}

type SR = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}

export function browserSpeechAvailable(): boolean {
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/** The browser's built-in recogniser. Audio handling is the browser vendor's, so the app says so on screen. */
export const browserRecogniser: Recogniser = {
  name: 'Browser',
  listen(lang, ms, onPartial, control) {
    return new Promise((resolve, reject) => {
      const w = window as unknown as Record<string, new () => SR>
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!Ctor) return reject(new Error('no-recogniser'))
      const rec = new Ctor()
      rec.lang = lang === 'ar' ? 'ar-AE' : 'en-US'
      rec.continuous = true
      rec.interimResults = true
      let committed = ''
      let text = ''
      let done = false
      let stopping = false
      const finish = () => { if (!done) { done = true; resolve(text) } }
      rec.onresult = (e) => {
        text = (committed + ' ' + Array.from(e.results).map((r) => r[0].transcript).join(' ')).trim()
        onPartial(text)
      }
      rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { done = true; reject(new Error('blocked')) } }
      // Some browsers end the session after a pause; start again until the time is up.
      rec.onend = () => { if (stopping) return finish(); committed = text; try { rec.start() } catch { finish() } }
      try { rec.start() } catch { return reject(new Error('blocked')) }
      const stop = () => { if (stopping) return; stopping = true; try { rec.stop() } catch { /* already stopped */ } setTimeout(finish, 800) }
      if (control) control.stop = stop
      setTimeout(stop, ms)
    })
  },
}

/** Recognisers that are switched on in this build. The second one joins when its service is configured. */
export function activeRecognisers(): Recogniser[] {
  return [browserRecogniser]
}
