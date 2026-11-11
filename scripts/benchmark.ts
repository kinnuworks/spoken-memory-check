// Runs the flag benchmark on simulated people and writes the counts the app shows.
// Usage: npx tsx scripts/benchmark.ts [people-per-cell]
import { writeFileSync } from 'node:fs'
import { programmeYear, runBenchmark } from '../src/engine/simulate'

const n = Number(process.argv[2] ?? 20000)
const burden = [0.01, 0.02, 0.04].map((p) => programmeYear(100000, p))
const out = { generated: new Date().toISOString().slice(0, 10), ...runBenchmark(n), burden }
writeFileSync(new URL('../src/data/benchmark.json', import.meta.url), JSON.stringify(out, null, 1))
for (const r of out.rows) console.log(r.world.padEnd(60), r.rule.padEnd(13), 'FA/yr', (r.falseAlarmYear * 100).toFixed(1).padStart(5) + '%', ' detected(1,2,3):', Object.values(r.detected).map((d) => (d * 100).toFixed(0) + '%').join(' '))
for (const b of burden) console.log(`prevalence ${b.prevalence}: packets/1000 ${b.packetsPer1000.toFixed(1)}, real ${b.realPer1000.toFixed(1)}, sens ${b.sensitivity.toFixed(3)} [${b.sensitivityCi.map((x) => x.toFixed(3))}], spec ${b.specificity.toFixed(4)}`)
