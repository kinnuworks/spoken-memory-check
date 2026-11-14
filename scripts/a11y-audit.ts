// Accessibility audit: runs axe-core (WCAG 2.0/2.1 A and AA, plus best-practice) on every
// screen, and checks 375 px width for horizontal overflow and tap targets under 44 px.
//
// Usage, with the dev server running (npm run dev -- --port 5183):
//   npx tsx scripts/a11y-audit.ts            uses Playwright if it is installed
//   npx tsx scripts/a11y-audit.ts --snippet  prints a script to run inside an open page of
//                                            the app (for a browser without Playwright);
//                                            it loads axe-core from the dev server and
//                                            returns the same JSON
// Set A11Y_URL to audit another host. Exit code 1 when any violation is found.
import { createRequire } from 'node:module'

const BASE = process.env.A11Y_URL ?? 'http://localhost:5183'

export { ROUTES } from './routes'
import { ROUTES } from './routes'

/** Runs in the page. Walks the hash routes, so the app loads once. */
async function auditInPage(routes: string[]) {
  type Axe = { version: string; run: (ctx: Document, opts: object) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> }
  const axe = (window as unknown as { axe: Axe }).axe
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  // Scroll-reveal sections start transparent; show them so contrast is measured on what people see.
  const style = document.createElement('style')
  style.textContent = '.reveal{opacity:1!important;transform:none!important;transition:none!important}'
  document.head.appendChild(style)
  const width = window.innerWidth
  const pages: Record<string, { violations: { id: string; impact: string; nodes: number; targets: string[] }[]; overflow: boolean; smallTargets: string[] }> = {}
  for (const route of routes) {
    location.hash = `#${route}`
    await wait(900)
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })
    const smallTargets: string[] = []
    if (width <= 400) {
      for (const el of document.querySelectorAll<HTMLElement>('a,button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')) {
        if (el.closest('[aria-hidden="true"]') || (el as HTMLButtonElement).disabled) continue
        const r = el.getBoundingClientRect()
        if (!r.width) continue
        // Links inside running text and controls wrapped in a larger label are exempt.
        if (getComputedStyle(el).display === 'inline' || el.closest('label')) continue
        if (r.width < 44 || r.height < 44) smallTargets.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
    pages[route] = {
      violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) })),
      overflow: document.documentElement.scrollWidth > width,
      smallTargets,
    }
  }
  return { axe: axe.version, width, pages }
}

function snippet() {
  // tsx keeps function names with a __name helper; give the page a stand-in.
  return `(async () => {
  window.__name ??= (f) => f
  if (!window.axe) await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = '/node_modules/axe-core/axe.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s) })
  return JSON.stringify(await (${auditInPage.toString()})(${JSON.stringify(ROUTES)}))
})()`
}

async function withPlaywright() {
  const require = createRequire(import.meta.url)
  let pw: { chromium: { launch: () => Promise<{ newPage: (o: object) => Promise<PwPage>; close: () => Promise<void> }> } }
  type PwPage = { goto: (u: string) => Promise<unknown>; addScriptTag: (o: { path: string }) => Promise<unknown>; evaluate: <T>(fn: (a: string[]) => Promise<T>, a: string[]) => Promise<T> }
  try {
    pw = await import('playwright' as string)
  } catch {
    console.error('Playwright is not installed. Run with --snippet and execute the output in a page of the app.')
    process.exit(2)
  }
  const axePath = require.resolve('axe-core/axe.min.js')
  const browser = await pw.chromium.launch()
  let failed = false
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 768, isMobile: viewport.width < 768 })
    await page.goto(`${BASE}/#/`)
    await page.evaluate(async () => { (window as unknown as { __name: unknown }).__name ??= (f: unknown) => f }, [])
    await page.addScriptTag({ path: axePath })
    const out = await page.evaluate(auditInPage, ROUTES)
    console.log(JSON.stringify(out, null, 1))
    failed ||= Object.values(out.pages).some((p) => p.violations.length > 0 || p.overflow || p.smallTargets.length > 0)
  }
  await browser.close()
  process.exit(failed ? 1 : 0)
}

if (process.argv.includes('--snippet')) console.log(snippet())
else await withPlaywright()
