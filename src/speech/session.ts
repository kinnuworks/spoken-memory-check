import type { Lang } from '../engine/lexicon'
import { level, startCapture } from './capture'
import { browserRecogniser, type ListenControl } from './recogniser'
import { SECOND_NAME, secondLoading, secondSupported, transcribeSecond } from './second'
import { CLOUD_NAME, transcribeCloud } from './cloud'
import { spot, type Templates } from '../engine/templates'

/** The person's own registration recordings, used as the answer key for word recall. */
export const OWN_NAME = 'Own voice'

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
export async function listenTask(lang: Lang, ms: number, onPartial: (text: string) => void, control?: ListenControl, useSecond = true, useCloud = false, own?: Templates): Promise<Heard> {
  const wantSecond = useSecond && secondSupported() && secondLoading(lang)
  const wantCloud = useSecond && useCloud
  const wantOwn = !!own && Object.keys(own).length > 0
  const capture = wantSecond || wantCloud || wantOwn ? await startCapture() : null
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
    // The on-device and cloud listeners work through the same recording at the same time.
    const [second, cloud] = await Promise.all([
      wantSecond ? transcribeSecond(clip, lang) : Promise.resolve(null),
      wantCloud ? transcribeCloud(clip, lang) : Promise.resolve(null),
    ])
    // Own-voice matching runs on the device in milliseconds and gives list words directly.
    const ownText = wantOwn ? spot(own!, clip).map((d) => d.word).join(' ') : null
    return { ...first, ...(second === null ? {} : { [SECOND_NAME]: second }), ...(cloud === null ? {} : { [CLOUD_NAME]: cloud }), ...(ownText === null ? {} : { [OWN_NAME]: ownText }) }
  })()
  return { first, both }
}
