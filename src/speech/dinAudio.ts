// Plays one digits-in-noise triplet: steady noise, with three digits mixed in at a given
// signal-to-noise ratio. Each digit recording is scaled to the same loudness first.
import { DIN } from '../engine/din'

let ctx: AudioContext | null = null
const cache = new Map<string, AudioBuffer>()
let noise: AudioBuffer | null = null

function rms(b: AudioBuffer): number {
  const d = b.getChannelData(0)
  let s = 0
  for (let i = 0; i < d.length; i++) s += d[i] * d[i]
  return Math.sqrt(s / d.length) || 1e-6
}

/** Noise with more energy in the low frequencies, roughly like the spectrum of speech. */
function makeNoise(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 6
  const b = c.createBuffer(1, len, c.sampleRate)
  const d = b.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12
  }
  return b
}

export async function prepare(lang: 'en' | 'ar'): Promise<void> {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  noise ??= makeNoise(ctx)
  await Promise.all(DIN.digits.map(async (d) => {
    const key = `${lang}${d}`
    if (cache.has(key)) return
    const bytes = await (await fetch(`din/${lang}/${d}.wav`)).arrayBuffer()
    cache.set(key, await ctx!.decodeAudioData(bytes))
  }))
}

/** Plays the triplet and resolves when it has finished. */
export function play(lang: 'en' | 'ar', digits: number[], snr: number, noiseLevel = 0.5): Promise<void> {
  const c = ctx!
  const t0 = c.currentTime + 0.05
  const lead = 0.5, gap = 0.25
  const bufs = digits.map((d) => cache.get(`${lang}${d}`)!)
  const speechLen = bufs.reduce((a, b) => a + b.duration, 0) + gap * (bufs.length - 1)
  const total = lead * 2 + speechLen

  const n = c.createBufferSource()
  n.buffer = noise
  const ng = c.createGain()
  const noiseRms = rms(noise!)
  ng.gain.setValueAtTime(0, t0)
  ng.gain.linearRampToValueAtTime(noiseLevel / noiseRms * 0.1, t0 + 0.05)
  ng.gain.setValueAtTime(noiseLevel / noiseRms * 0.1, t0 + total - 0.05)
  ng.gain.linearRampToValueAtTime(0, t0 + total)
  n.connect(ng).connect(c.destination)
  n.start(t0, Math.random() * 2)
  n.stop(t0 + total)

  // Speech level relative to the noise, set by the SNR in decibels.
  const target = (noiseLevel * 0.1) * Math.pow(10, snr / 20)
  let at = t0 + lead
  for (const b of bufs) {
    const s = c.createBufferSource()
    s.buffer = b
    const g = c.createGain()
    g.gain.value = Math.min(4, target / rms(b))
    s.connect(g).connect(c.destination)
    s.start(at)
    at += b.duration + gap
  }
  return new Promise((r) => setTimeout(r, (total + 0.1) * 1000))
}

/** A comfortable-volume sample: one triplet with the digits well above the noise. */
export function sample(lang: 'en' | 'ar'): Promise<void> {
  return play(lang, [2, 5, 9], 8)
}
