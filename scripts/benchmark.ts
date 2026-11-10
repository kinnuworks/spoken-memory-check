// Runs the flag benchmark on simulated people and writes the counts the app shows.
// Usage: npx tsx scripts/benchmark.ts [people-per-cell]
import { writeFileSync } from 'node:fs'
import { runBenchmark } from '../src/engine/simulate'

const n = Number(process.argv[2] ?? 20000)
const out = { generated: new Date().toISOString().slice(0, 10), ...runBenchmark(n) }
writeFileSync(new URL('../src/data/benchmark.json', import.meta.url), JSON.stringify(out, null, 1))
for (const r of out.rows) console.log(r.world.padEnd(52), r.rule.padEnd(13), 'FA/yr', (r.falseAlarmYear * 100).toFixed(1).padStart(5) + '%', ' detected(1,2,3):', Object.values(r.detected).map((d) => (d * 100).toFixed(0) + '%').join(' '), ' median checks:', Object.values(r.medianChecksToFlag).join(' '))
