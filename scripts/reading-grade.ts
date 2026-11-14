// Reading grade of everything the person reads or hears, in English, from the running site.
// Flesch-Kincaid grade with a vowel-group syllable count: a rough measure, English only.
// Arabic has no readability formula we could validate, so Arabic text is not graded.
//
// Usage: npx tsx scripts/reading-grade.ts [url]      writes src/data/reading-grade.json
import { writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'

const BASE = (process.argv[2] ?? process.env.LIVE_URL ?? 'https://spoken-memory-check.vercel.app').replace(/\/$/, '')
/** Plain-language guidance for patient material asks for grade 6 to 8; we hold every screen to 8 or under. */
export const TARGET = 8

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length)
}

export function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?:])\s+(?=[A-Z0-9"“])/).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s))
}

/** Labels and buttons under four words are left out, so they cannot pull a screen's grade down. */
export function grade(text: string): { words: number; sentences: number; grade: number } {
  const ss = sentences(text).filter((s) => s.split(/\s+/).length >= 4)
  const words = ss.flatMap((s) => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)))
  if (!words.length) return { words: 0, sentences: 0, grade: 0 }
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  return { words: words.length, sentences: ss.length, grade: Math.round((0.39 * (words.length / ss.length) + 11.8 * (syl / words.length) - 15.59) * 10) / 10 }
}

/** Text the person sees on a screen: the main column, without the judge-facing notes. */
async function screenText(page: Page, route: string, prep?: (p: Page) => Promise<void>): Promise<string> {
  await page.goto(`${BASE}/#${route}`)
  await page.waitForTimeout(600)
  if (prep) await prep(page)
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const clone = main.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-for-judges], .demo-only, nav, table, pre, [lang="ar"], [dir="rtl"]').forEach((e) => e.remove())
    return Array.from(clone.querySelectorAll('h1, h2, h3, p, li, label, button, .note')).map((e) => (e as HTMLElement).innerText.trim()).filter(Boolean).map((t) => /[.!?:]$/.test(t) ? t : `${t}.`).join(' ')
  })
}

const SCREENS: { name: string; route: string; prep?: (p: Page) => Promise<void> }[] = [
  { name: 'Start of the full check', route: '/check' },
  { name: 'Hearing check', route: '/hearing' },
  { name: 'Choices and consent', route: '/me' },
  { name: 'Result after a check (lower twice)', route: '/me/decline' },
  { name: 'Result after a very large fall', route: '/me/urgent' },
]

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const rows: { name: string; route: string; words: number; sentences: number; grade: number; hardest: { text: string; grade: number }[] }[] = []
  for (const s of SCREENS) {
    const text = await screenText(page, s.route, s.prep)
    const g = grade(text)
    const hardest = sentences(text).map((t) => ({ text: t, grade: grade(t).grade })).sort((a, b) => b.grade - a.grade).slice(0, 3)
    rows.push({ name: s.name, route: s.route, ...g, hardest })
  }
  // The spoken prompts, as the recorded check shows them.
  await page.goto(`${BASE}/#/recorded-check`)
  await page.waitForTimeout(600)
  const prompts = (await page.locator('p.muted span[lang="en"]').allInnerTexts()).join(' ')
  const pg = grade(prompts)
  rows.push({ name: 'Spoken prompts', route: '/recorded-check', ...pg, hardest: sentences(prompts).map((t) => ({ text: t, grade: grade(t).grade })).sort((a, b) => b.grade - a.grade).slice(0, 3) })
  await browser.close()

  const all = rows.reduce((a, r) => ({ words: a.words + r.words, sentences: a.sentences + r.sentences }), { words: 0, sentences: 0 })
  const out = { url: BASE, ranAt: new Date().toISOString(), target: TARGET, measure: 'Flesch-Kincaid grade, English only', screens: rows.map(({ hardest, ...r }) => ({ ...r, hardest })), words: all.words }
  writeFileSync(new URL('../src/data/reading-grade.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
  for (const r of rows) {
    console.log(`${r.grade.toFixed(1).padStart(5)}  ${r.name} (${r.words} words, ${r.sentences} sentences)`)
    for (const h of r.hardest) console.log(`        ${h.grade.toFixed(1)}  ${h.text.slice(0, 150)}`)
  }
}

if (process.argv[1]?.endsWith('reading-grade.ts')) main()
