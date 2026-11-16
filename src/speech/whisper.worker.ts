/// <reference lib="webworker" />
// The second listener: an open speech model that runs on this device, in this worker.
// It hears the finished clip, never a live stream, and sends nothing anywhere.
import { AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration, env } from '@huggingface/transformers'

type Lang = 'en' | 'ar'
// Arabic uses a small model fine-tuned on Arabic (ayoubkirouane/whisper-small-ar, Apache-2.0). On real
// recordings of single Arabic words it found the right word far more often than the general small model
// (scripts/arabic-asr-experiments.ts). Its 4-bit weights scored the same as 8-bit. This site serves its own copy
// with the token-embedding table, left at 32 bits in that build, also stored as 4-bit (scripts/shrink-arabic-model.py):
// about 165 MB to download instead of 299, every file under 100 MB. Arabic, with its tokenizer and audio settings,
// comes from this site only. English is the unchanged onnx-community/whisper-base from huggingface.co, whose CDN
// was many times faster than this site in testing; scripts/build-english-model.sh makes a copy for a host that
// a pilot controls.
const MODEL: Record<Lang, string> = { en: 'onnx-community/whisper-base', ar: 'whisper-small-ar-q4emb' }
const HOST: Record<Lang, { host: string; path: string }> = {
  en: { host: 'https://huggingface.co/', path: '{model}/resolve/{revision}/' },
  ar: { host: `${self.location.origin}/models/`, path: '{model}/' },
}
env.allowLocalModels = false
env.allowRemoteModels = true
const DTYPE: Record<Lang, 'q8' | 'q4'> = { en: 'q8', ar: 'q4' }
// A prompt that shows the wanted format (single nouns, comma separated) and none of the answers.
// Putting the word list itself in the prompt made the model report words nobody said.
const STYLE: Record<Lang, string> = {
  en: 'house, book, car, tree, school, door, chair, street, cup, shoe',
  ar: 'بيت، كتاب، سيارة، شجرة، مدرسة، باب، كرسي، شارع، كوب، حذاء',
}
const SR = 16000
// Memory settings for the inference engine, so the model fits in a phone browser's memory.
const LEAN = { enableCpuMemArena: false, enableMemPattern: false, extra: { session: { disable_prepacking: '1' } } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaded: { lang: Lang; processor: any; tokenizer: any; model: any } | null = null

async function load(lang: Lang) {
  if (loaded?.lang === lang) return
  const id = MODEL[lang]
  const files = new Map<string, number>()
  const progress_callback = (p: { status?: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file && typeof p.progress === 'number') {
      files.set(p.file, p.progress)
      const vals = [...files.values()]
      postMessage({ type: 'progress', percent: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) })
    }
  }
  env.remoteHost = HOST[lang].host
  env.remotePathTemplate = HOST[lang].path
  const [processor, tokenizer] = await Promise.all([
    AutoProcessor.from_pretrained(id, { progress_callback }),
    AutoTokenizer.from_pretrained(id, { progress_callback }),
  ])
  const model = await WhisperForConditionalGeneration.from_pretrained(id, { dtype: DTYPE[lang], device: 'wasm', progress_callback, session_options: LEAN })
  loaded = { lang, processor, tokenizer, model }
}

/** Speech segments as [start, end) sample ranges: 30 ms frames, level threshold, 300 ms hangover, 150 ms padding. */
function segments(audio: Float32Array): [number, number][] {
  const frame = 480, hang = 10, pad = 2400
  // The threshold follows the clip's own noise floor, so a quiet room and a noisy one both work.
  const levels: number[] = []
  for (let i = 0; i + frame <= audio.length; i += frame) {
    let e = 0
    for (let j = i; j < i + frame; j++) e += audio[j] * audio[j]
    levels.push(Math.sqrt(e / frame))
  }
  const sorted = [...levels].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0
  const thr = Math.max(0.008, floor * 3)
  const segs: [number, number][] = []
  let start = -1, quiet = 0
  levels.forEach((lv, k) => {
    const i = k * frame
    if (lv > thr) { if (start < 0) start = i; quiet = 0 }
    else if (start >= 0 && ++quiet > hang) { segs.push([Math.max(0, start - pad), Math.min(audio.length, i - (hang - 1) * frame + pad)]); start = -1; quiet = 0 }
  })
  if (start >= 0) segs.push([Math.max(0, start - pad), audio.length])
  return segs
}

/** Joins speech with short gaps and splits into windows of at most 28 s, cutting only between segments. */
function compact(audio: Float32Array, segs: [number, number][]): Float32Array[] {
  const gap = Math.round(0.4 * SR), max = 28 * SR
  const windows: Float32Array[] = []
  let parts: Float32Array[] = [], len = 0
  const flush = () => {
    if (!parts.length) return
    const out = new Float32Array(len + gap)
    let o = gap
    for (const p of parts) { out.set(p, o); o += p.length + gap }
    windows.push(out.subarray(0, Math.max(o, SR)))
    parts = []; len = 0
  }
  for (const [a, b] of segs) {
    const p = audio.subarray(a, b)
    if (len + p.length + gap > max) flush()
    parts.push(p); len += p.length + gap
  }
  flush()
  return windows
}

/** True when the text is one short phrase repeated, which is how this kind of model fails on noise. */
function looped(text: string): boolean {
  const w = text.split(/[\s,،]+/).filter(Boolean)
  return w.length >= 8 && new Set(w).size <= Math.max(2, w.length / 4)
}

async function transcribe(audio: Float32Array, lang: Lang): Promise<string> {
  await load(lang)
  const { processor, tokenizer, model } = loaded!
  const segs = segments(audio)
  // No speech found: say so, and do not ask the model, which can invent words from silence.
  if (!segs.length) return ''
  const id = (t: string) => tokenizer.encode(t, { add_special_tokens: false })[0]
  const init = [id('<|startoftranscript|>'), id(`<|${lang}|>`), id('<|transcribe|>'), id('<|notimestamps|>')]
  const prompt = tokenizer.encode(' ' + STYLE[lang], { add_special_tokens: false }).slice(-223)
  const decoder_input_ids = [id('<|startofprev|>'), ...prompt, ...init]
  const texts: string[] = []
  for (const w of compact(audio, segs)) {
    const { input_features } = await processor(w)
    const out = await model.generate({ inputs: input_features, decoder_input_ids, max_new_tokens: 120 })
    const toks = out[0].tolist().map(Number).slice(decoder_input_ids.length)
    const text = tokenizer.decode(toks, { skip_special_tokens: true }).trim()
    if (!looped(text)) texts.push(text)
  }
  return texts.join(' ')
}

self.onmessage = async (e: MessageEvent<{ type: 'load' | 'transcribe'; id: number; lang: Lang; audio?: Float32Array }>) => {
  const { type, id, lang, audio } = e.data
  try {
    if (type === 'load') { await load(lang); postMessage({ type: 'done', id, text: '' }) }
    else postMessage({ type: 'done', id, text: await transcribe(audio!, lang) })
  } catch (err) {
    postMessage({ type: 'error', id, message: String(err) })
  }
}
