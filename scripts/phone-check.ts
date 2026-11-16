// Runs the recorded check in two phone browser engines on this computer, with phone screen
// sizes and user agents, and writes src/data/phone-check.json: the score, how long scoring took,
// and how much memory the page added while the speech model loaded and ran.
// This is not a real phone. A phone's own memory limit is what decides whether it works.
// usage: npx tsx scripts/phone-check.ts [base-url]   (default http://localhost:4317, a production build)
// Memory is read from the operating system's process list (macOS `ps`), so it includes the
// browser engine's own overhead, not only the model.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { chromium, devices, webkit, type BrowserType } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4317'
const ENGINES: { engine: string; type: BrowserType; device: string; proc: RegExp }[] = [
  { engine: 'WebKit (the engine of Safari on iPhone)', type: webkit, device: 'iPhone 15', proc: /ms-playwright\/webkit.*(WebContent|WebProcess)/i },
  { engine: 'Chromium (the engine of Chrome on Android)', type: chromium, device: 'Pixel 7', proc: /ms-playwright\/chromium.*type=renderer/i },
]

function pageMemoryMB(proc: RegExp): number {
  const out = execFileSync('ps', ['-axo', 'rss=,command='], { encoding: 'utf8' })
  return out.split('\n').filter((l) => proc.test(l)).reduce((s, l) => s + Number(l.trim().split(/\s+/)[0] || 0), 0) / 1024
}

const rows = []
for (const e of ENGINES) {
  for (const lang of ['en', 'ar'] as const) {
    const browser = await e.type.launch()
    const page = await (await browser.newContext({ ...devices[e.device] })).newPage()
    await page.goto(`${base}/#/recorded`)
    if (lang === 'ar') await page.getByRole('button', { name: 'العربية' }).click()
    await page.waitForTimeout(3000)
    const before = pageMemoryMB(e.proc)
    let peak = before
    await page.getByRole('button', { name: 'Score this recording on my device' }).click()
    let text = ''
    for (let i = 0; i < 2000; i++) {
      await page.waitForTimeout(300)
      peak = Math.max(peak, pageMemoryMB(e.proc))
      text = await page.locator('main').innerText()
      if (/Scored on this device in|could not run/.test(text)) break
    }
    const animals = Number(/(\d+) of 20 animals/.exec(text)?.[1] ?? NaN)
    const seconds = Number(/Scored on this device in ([\d.]+) seconds/.exec(text)?.[1] ?? NaN)
    const row = { engine: e.engine, device: e.device, lang, ran: Number.isFinite(animals), animals, of: 20, seconds, addedMemoryMB: Math.round(peak - before) }
    console.log(JSON.stringify(row))
    rows.push(row)
    await browser.close()
  }
}
writeFileSync(new URL('../src/data/phone-check.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), host: 'a Mac laptop, not a phone', rows }, null, 1) + '\n')
