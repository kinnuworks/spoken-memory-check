// Checks, from the browser's own network log, that a check by voice sends nothing off the device.
// Chromium writes every request it makes (from the page, its workers and everything else) to a
// NetLog file. A computer voice is fed in as the microphone (as in scripts/mic-check.ts) and goes
// through "Try it with your voice": sound check, a minute's worth of animals, scoring on the device.
// The log is then read for every request's method and host, every upload body and every
// WebSocket frame. The page's own counter (src/privacy/meter.ts) is read too and must agree.
//
// usage: npx tsx scripts/privacy-check.ts [base-url] [en|ar]   (default: the live site, English)
// Needs output/mic-check/mic-<lang>.wav from scripts/mic-check.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? process.env.LIVE_URL ?? 'https://spoken-memory-check.vercel.app').replace(/\/$/, '')
const LANGS = (process.argv[3] ? [process.argv[3]] : ['en', 'ar']) as ('en' | 'ar')[]
const dir = resolve('output/privacy-check')
mkdirSync(dir, { recursive: true })

async function check(LANG: 'en' | 'ar') {
const wav = resolve(`output/mic-check/mic-${LANG}.wav`)
if (!existsSync(wav)) throw new Error(`${wav} is missing: run npx tsx scripts/mic-check.ts first`)
const netlog = join(dir, `netlog-${LANG}.json`)

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, `--log-net-log=${netlog}`, '--net-log-capture-mode=Default'] })
let page = { bytes: -1, uploads: -1 }
let heard = ''
try {
  const ctx = await browser.newContext({ permissions: ['microphone'] })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/#/try`)
  if (LANG === 'ar') await p.getByRole('button', { name: 'العربية' }).click()
  await p.getByRole('button', { name: 'Start the sound check' }).click()
  const outcome = p.getByRole('heading', { name: /We can hear you|We couldn't hear the three words|The microphone isn't available here|The speech model didn't load/ })
  await outcome.waitFor({ timeout: 4 * 60_000 })
  if ((await outcome.innerText()) !== 'We can hear you') throw new Error(`sound check: ${await outcome.innerText()}`)
  await p.getByRole('button', { name: 'Start naming animals' }).click()
  await p.getByRole('heading', { name: 'What we heard' }).waitFor({ timeout: 5 * 60_000 })
  heard = (await p.locator('p.big').first().innerText()).trim()
  const m = p.locator('.sent-meter').first()
  page = { bytes: Number(await m.getAttribute('data-sent-bytes')), uploads: Number(await m.getAttribute('data-sent-uploads')) }
} finally {
  await browser.close()
}

// The log is a JSON object; if the browser stopped before closing it, close it here.
let text = readFileSync(netlog, 'utf8').trim()
if (!text.endsWith('}')) text = text.replace(/,\s*$/, '') + ']}'
const log = JSON.parse(text) as { constants: { logEventTypes: Record<string, number> }; events: { type: number; params?: Record<string, unknown> }[] }
const name = Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([k, v]) => [v, k]))
const requests: { method: string; url: string }[] = []
let uploadBytes = 0, uploads = 0, websocket = 0
for (const e of log.events) {
  const t = name[e.type] ?? ''
  if (t === 'URL_REQUEST_START_JOB' && e.params) requests.push({ method: String(e.params.method), url: String(e.params.url) })
  if (t === 'UPLOAD_DATA_STREAM_INIT' && e.params) { uploads++; uploadBytes += Number(e.params.total_size ?? 0) }
  if (t.startsWith('WEBSOCKET')) websocket++
}
const web = requests.filter((r) => /^https?:/.test(r.url))
const methods: Record<string, number> = {}
for (const r of web) methods[r.method] = (methods[r.method] ?? 0) + 1
const hosts = [...new Set(web.map((r) => new URL(r.url).host))].sort()
const notGet = web.filter((r) => r.method !== 'GET' && r.method !== 'HEAD')
const ok = uploadBytes === 0 && notGet.length === 0 && websocket === 0 && page.bytes === 0 && heard !== ''
const out = { lang: LANG, heard, requests: web.length, methods, hosts, uploadBytes, uploads, notGet, websocketEvents: websocket, pageCounter: page, ok }
console.log(`${ok ? 'PASS' : 'FAIL'}  nothing sent off the device (${LANG}): ${web.length} requests (${Object.entries(methods).map(([k, v]) => `${v} ${k}`).join(', ')}) to ${hosts.join(', ')}; ${uploadBytes} bytes uploaded in ${uploads} upload bodies; ${websocket} WebSocket events; the page's own counter: ${page.bytes} bytes; heard ${heard}`)
return out
}

const runs = []
for (const l of LANGS) runs.push(await check(l))
const all = {
  url: BASE, ranAt: new Date().toISOString(),
  voice: 'computer voice fed in as the microphone (Chromium fake audio capture), not a person',
  path: '"Try it with your voice": sound check, animals, scored on the device',
  uploadBytes: runs.reduce((a, r) => a + r.uploadBytes, 0), ok: runs.every((r) => r.ok), runs,
}
if (process.env.PRIVACY_CHECK_NO_WRITE !== '1') writeFileSync('src/data/privacy-check.json', JSON.stringify(all, null, 1) + '\n')
if (!all.ok) process.exit(1)
