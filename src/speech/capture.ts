// Records the microphone for one task so the second listener can hear the same speech.
// The recording stays in memory and is dropped when the page closes.
const TARGET = 16000

export interface Capture { stop(): Promise<Float32Array | null> }

export async function decodeTo16k(bytes: ArrayBuffer): Promise<Float32Array> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  const decoded = await ctx.decodeAudioData(bytes)
  void ctx.close()
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET), TARGET)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  return (await off.startRendering()).getChannelData(0)
}

export async function startCapture(): Promise<Capture | null> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null
  let stream: MediaStream
  try {
    // Processing that suits calls can clip single words, so it is turned off.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  } catch {
    return null
  }
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.start()
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        try { resolve(await decodeTo16k(await new Blob(chunks, { type: rec.mimeType }).arrayBuffer())) } catch { resolve(null) }
      }
      try { rec.stop() } catch { resolve(null) }
    }),
  }
}

/** Root-mean-square level of a clip; near zero means the recording heard nothing. */
export function level(audio: Float32Array): number {
  let e = 0
  for (let i = 0; i < audio.length; i++) e += audio[i] * audio[i]
  return Math.sqrt(e / Math.max(1, audio.length))
}
