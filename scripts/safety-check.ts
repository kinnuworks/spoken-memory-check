// Checks the rule's safety promises on random histories and writes the result the site shows.
// Usage: npx tsx scripts/safety-check.ts [histories]   (default 1,000,000)
import { writeFileSync } from 'node:fs'
import { checkPromises, PROMISES } from '../src/engine/safety'

const n = Number(process.argv[2] ?? 1_000_000)
const t0 = Date.now()
const rep = checkPromises(n)
const seconds = Math.round((Date.now() - t0) / 1000)
for (const p of PROMISES) console.log(`${rep.violations[p.id] === 0 ? 'PASS' : 'FAIL'}  ${p.text}  (${rep.violations[p.id]} of ${n.toLocaleString('en')} histories broke it)`)
console.log(`${n.toLocaleString('en')} random histories, ${rep.checks.toLocaleString('en')} checks, seed ${rep.seed}, ${seconds} s`)
if (process.env.SAFETY_NO_WRITE !== '1') writeFileSync(new URL('../src/data/safety-check.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), seconds, histories: rep.histories, checks: rep.checks, seed: rep.seed, violations: rep.violations, examples: rep.examples }, null, 1) + '\n')
if (Object.values(rep.violations).some((v) => v > 0)) process.exit(1)
