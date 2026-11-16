// End-to-end check of the deployed site in a real (headless) browser. It walks every screen,
// scores the full recorded check in English and in Arabic on the device, takes one packet from
// approval to a closed referral, and checks the hand-off files. deploy.sh runs it after every
// deploy; the result is written to src/data/live-check.json and shown on the evidence page.
//
// Usage: npx tsx scripts/live-check.ts [url]      (default: the live site)
// Exit code 1 when any step fails.
// LIVE_CHECK_VIDEO=<folder> also records a screen video of the whole run (the demo path).
// LIVE_CHECK_NO_WRITE=1 leaves src/data/live-check.json as it is (for routine checks).
import { writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { ROUTES } from './routes'

const BASE = (process.argv[2] ?? process.env.LIVE_URL ?? 'https://spoken-memory-check.vercel.app').replace(/\/$/, '')

interface Step { name: string; ok: boolean; detail: string; seconds: number }
const steps: Step[] = []

async function step(name: string, fn: () => Promise<string>) {
  const t0 = Date.now()
  try {
    const detail = await fn()
    steps.push({ name, ok: true, detail, seconds: Math.round((Date.now() - t0) / 100) / 10 })
  } catch (e) {
    steps.push({ name, ok: false, detail: String((e as Error).message ?? e).split('\n')[0].slice(0, 200), seconds: Math.round((Date.now() - t0) / 100) / 10 })
  }
  const s = steps[steps.length - 1]
  console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${name}  (${s.seconds} s)  ${s.detail}`)
}

function expect(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg) }

async function recordedCheck(page: Page, lang: 'en' | 'ar') {
  await page.goto(`${BASE}/#/recorded-check`)
  await page.getByRole('button', { name: lang === 'en' ? 'English' : 'العربية' }).click()
  await page.getByRole('button', { name: 'Score the whole check on my device' }).click()
  const heading = page.getByRole('heading', { name: 'The whole check' })
  await heading.waitFor({ timeout: 10 * 60_000 })
  const big = page.locator('p.big').first()
  const total = (await big.innerText()).trim()
  expect(total !== 'Not scored', `${lang} check came out not scored`)
  const [said, missed, added] = await Promise.all(['data-said', 'data-missed', 'data-added'].map(async (a) => Number(await big.getAttribute(a))))
  expect(said === 27, `the page scored against ${said} words said, not 27`)
  const nums = total.match(/\d+/g)?.map(Number) ?? []
  expect(nums.length >= 1 && nums.every((n) => n >= 0 && n <= said), `unexpected total "${total}"`)
  expect(Math.max(...nums) === said - missed + added, `top of "${total}" does not equal ${said} said - ${missed} missed + ${added} added`)
  const scoring = await page.locator('tr', { hasText: 'Scoring all three tasks' }).locator('td').last().innerText()
  return `${total} heard of ${said} said; ${missed} missed by every listener, ${added} credited that were not said; scored in ${scoring.trim()}`
}

async function main() {
  const browser = await chromium.launch()
  const video = process.env.LIVE_CHECK_VIDEO
  const context = await browser.newContext({ acceptDownloads: true, ...(video ? { viewport: { width: 1280, height: 800 }, recordVideo: { dir: video, size: { width: 1280, height: 800 } } } : {}) })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await step('Every screen opens without an error', async () => {
    await page.goto(`${BASE}/`)
    await page.getByRole('heading').first().waitFor()
    const all = [...ROUTES, '/story', '/me', '/recorded-check']
    for (const r of all) {
      await page.goto(`${BASE}/#${r}`)
      await page.waitForTimeout(400)
      const h = await page.locator('h1, h2').count()
      expect(h > 0, `${r} rendered no heading`)
    }
    expect(errors.length === 0, `console errors: ${errors.slice(0, 2).join(' | ')}`)
    return `${all.length} screens, no console errors`
  })

  await step('Full check stays locked until the person agrees', async () => {
    await page.goto(`${BASE}/#/check`)
    const start = page.getByRole('button', { name: 'Start the check' })
    expect(await start.isDisabled(), 'start button enabled before consent')
    await page.getByLabel(/I agree to take memory checks at home/).check()
    expect(await start.isEnabled(), 'start button still disabled after consent')
    await page.getByLabel(/I agree to take memory checks at home/).uncheck()
    return 'start disabled until the first consent switch is on'
  })

  await step('Recorded check in English, scored on the device', () => recordedCheck(page, 'en'))
  await step('Recorded check in Arabic, scored on the device', () => recordedCheck(page, 'ar'))

  await step('Packet to closed referral, with the Malaffi message and FHIR file', async () => {
    await page.goto(`${BASE}/#/clinician/decline`)
    await page.getByRole('button', { name: 'Approve and invite the person to a visit' }).click()
    await page.getByRole('button', { name: /Record: result given in person/ }).click()
    await page.getByRole('button', { name: 'Record: specialist appointment attended' }).click()
    const clock = await page.locator('.card', { hasText: 'working days used' }).innerText()
    expect(/Closed/.test(clock), `referral not closed: ${clock}`)
    const hl7 = await page.locator('pre.hl7').innerText()
    expect(hl7.startsWith('MSH|') && /REF\^I12/.test(hl7), 'HL7 message is not a REF^I12')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download FHIR bundle (synthetic)' }).click()])
    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    const b = JSON.parse(readFileSync(path, 'utf8'))
    expect(b.resourceType === 'Bundle' && b.entry?.some((e: { resource: { resourceType: string } }) => e.resource.resourceType === 'ServiceRequest'), 'FHIR bundle has no referral')
    const log = await page.locator('h2:has-text("Decision log") + ol li').count()
    expect(log >= 3, `decision log has ${log} entries`)
    return `${clock.split('.')[0]}; HL7 REF^I12; FHIR bundle with ${b.entry.length} resources; ${log} logged decisions`
  })

  const clip = page.video()
  await context.close()
  if (clip) console.log(`screen video: ${await clip.path()}`)
  await browser.close()
  const out = { url: BASE, ranAt: new Date().toISOString(), passed: steps.filter((s) => s.ok).length, total: steps.length, steps }
  if (process.env.LIVE_CHECK_NO_WRITE !== '1') writeFileSync(new URL('../src/data/live-check.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
  console.log(`${out.passed} of ${out.total} steps passed`)
  if (out.passed !== out.total) process.exit(1)
}

main()
