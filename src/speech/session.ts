import type { Lang } from '../engine/lexicon'
import { level, startCapture } from './capture'
import { browserRecogniser, type ListenControl } from './recogniser'
import { SECOND_NAME, secondLoading, secondSupported, transcribeSecond } from './second'

export interface Heard {
  /** What the browser's recogniser heard, available as soon as listening ends. */
  first: Record<string, string>
  /** Resolves with both transcripts once the on-device listener has heard the clip, or with the first alone if it could not. */
  both: Promise<Record<string, string>>
}

/**
 * Listens to one task. The browser's recogniser hears it live; the same speech is recorded
 * and given to the on-device listener afterwards. On phones the two often cannot share the
 * microphone, so a silent recording simply means one listener, which the screen states.
 */
export async function listenTask(lang: Lang, ms: number, onPartial: (text: string) => void, control?: ListenControl, useSecond = true): Promise<Heard> {
  const wantSecond = useSecond && secondSupported() && secondLoading(lang)
  const capture = wantSecond ? await startCapture() : null
  let text: string
  try {
    text = await browserRecogniser.listen(lang, ms, onPartial, control)
  } catch (e) {
    void capture?.stop()
    throw e
  }
  const first = { [browserRecogniser.name]: text }
  const both = (async () => {
    const clip = capture ? await capture.stop() : null
    if (!clip || level(clip) < 0.002) return first
    const second = await transcribeSecond(clip, lang)
    return second === null ? first : { ...first, [SECOND_NAME]: second }
  })()
  return { first, both }
}
