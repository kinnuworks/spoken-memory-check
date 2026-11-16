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
  /** The recording itself, or null if none was made. */
  clip: Promise<Float32Array | null>
}

/**
 * Listens to one task. By default the speech is recorded and scored on this device only.
 * If the person turns on the browser's recogniser, it hears the task live and the same speech
 * is recorded and given to the on-device listener afterwards. On phones the two often cannot
 * share the microphone, so a silent recording simply means one listener, which the screen states.
 */
export interface ListenOptions {
  /** Let the browser's own recogniser listen too. It shows words live, but the browser's maker may receive the audio. Off by default. */
  browser?: boolean
  /** Called when the recording stops and scoring on the device begins (on-device only). */
  onRecorded?: () => void
  /** Score the recording (on-device only). Off for tasks that are recorded but not scored. */
  score?: boolean
}

/** Whether this device can score speech on its own, with nothing sent anywhere. */
export function deviceOnlyPossible(lang?: Lang): boolean {
  return secondSupported(lang) && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

export async function listenTask(lang: Lang, ms: number, onPartial: (text: string) => void, control?: ListenControl, useSecond = true, useCloud = false, own?: Templates, opts: ListenOptions = { browser: true }): Promise<Heard> {
  const wantOwn = !!own && Object.keys(own).length > 0
  if (!opts.browser) {
    // On-device only: record for the task's time, then score the recording on this device.
    // Nothing is sent anywhere unless the person turned on the UAE-hosted listener.
    const capture = await startCapture()
    if (!capture) throw new Error('blocked')
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms)
      if (control) control.stop = () => { clearTimeout(t); resolve() }
    })
    const clip = await capture.stop()
    opts.onRecorded?.()
    const both = (async (): Promise<Record<string, string>> => {
      if (!clip || level(clip) < 0.002 || opts.score === false) return {}
      const [second, cloud] = await Promise.all([transcribeSecond(clip, lang), useCloud ? transcribeCloud(clip, lang) : Promise.resolve(null)])
      const ownText = wantOwn ? spot(own!, clip).map((d) => d.word).join(' ') : null
      return { ...(second === null ? {} : { [SECOND_NAME]: second }), ...(cloud === null ? {} : { [CLOUD_NAME]: cloud }), ...(ownText === null ? {} : { [OWN_NAME]: ownText }) }
    })()
    // Nothing is heard live, so `first` is empty; callers that need the words wait for `both`.
    return { first: {}, both, clip: Promise.resolve(clip) }
  }
  const wantSecond = useSecond && secondSupported(lang) && secondLoading(lang)
  const wantCloud = useSecond && useCloud
  const capture = wantSecond || wantCloud || wantOwn ? await startCapture() : null
  let text: string
  try {
    text = await browserRecogniser.listen(lang, ms, onPartial, control)
  } catch (e) {
    void capture?.stop()
    throw e
  }
  const first = { [browserRecogniser.name]: text }
  const clipP = capture ? capture.stop() : Promise.resolve(null)
  const both = (async () => {
    const clip = await clipP
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
  return { first, both, clip: clipP }
}
