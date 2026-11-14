// Line and branch coverage of the decision engine (src/engine), from Vitest's v8 coverage.
// Usage: npx tsx scripts/coverage-summary.ts      writes src/data/coverage-summary.json
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

/** The files that decide what happens to a person, as named on the evidence page. */
const RULES: Record<string, string> = {
  'change.ts': 'Flag, slow-decline and urgent rules',
  'score.ts': 'Scoring and the two-listener range',
  'match.ts': 'Matching what was heard to the list',
  'din.ts': 'Hearing check',
  'consent.ts': 'Consent switches',
  'packet.ts': 'Physician packet and referral clock',
}

execSync("npx vitest run --coverage --coverage.include='src/engine/**' --coverage.exclude='src/engine/**/*.test.ts' --coverage.reporter=json-summary --coverage.reportsDirectory=coverage", { stdio: 'ignore' })
const raw = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')) as Record<string, { lines: { total: number; covered: number }; branches: { total: number; covered: number } }>
const pick = (k: string) => ({ lines: raw[k].lines.covered / raw[k].lines.total, branches: raw[k].branches.total ? raw[k].branches.covered / raw[k].branches.total : 1 })
const files = Object.keys(raw).filter((k) => k !== 'total')
const rules = Object.entries(RULES).map(([f, role]) => ({ file: f, role, ...pick(files.find((k) => k.endsWith(`/engine/${f}`)) as string) }))
const out = {
  generated: new Date().toISOString().slice(0, 10),
  tool: 'Vitest v8 coverage',
  engine: { files: files.length, linesCovered: raw.total.lines.covered, linesTotal: raw.total.lines.total, ...pick('total') },
  rules,
}
writeFileSync('src/data/coverage-summary.json', JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify(out, null, 1))
