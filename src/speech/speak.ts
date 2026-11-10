import type { Lang } from '../engine/lexicon'

// Spoken prompts. This build uses the device's own synthetic voice; the patient version
// plays prompts recorded by a native speaker.
export function speak(text: string, lang: Lang, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    u.rate = rate
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Reads a word list aloud, one word about every two seconds. */
export async function speakList(words: string[], lang: Lang): Promise<void> {
  for (const w of words) {
    await speak(w, lang, 0.8)
    await pause(1100)
  }
}
