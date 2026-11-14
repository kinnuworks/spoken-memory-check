// Runs the flag benchmark on simulated people and writes the counts the app shows.
// Usage: npx tsx scripts/benchmark.ts [people-per-cell]
// Thresholds for the slow-decline route were fixed on TUNING_SEED before this was run;
// every number written here comes from REPORT_SEED (and 20261111 for the programme year).
import { writeFileSync } from 'node:fs'
import { DEFAULT_PARAMS } from '../src/engine/change'
import { programmeYear, REPORT_SEED, runBenchmark, TUNING_SEED } from '../src/engine/simulate'

const n = Number(process.argv[2] ?? 20000)
const prevalences = [0.01, 0.02, 0.04]
const burden = prevalences.map((p) => programmeYear(100000, p))
const burdenBefore = prevalences.map((p) => programmeYear(100000, p, undefined, 2, 'two-in-a-row'))
const trend = { trendZ: DEFAULT_PARAMS.trendZ, trendMinChecks: DEFAULT_PARAMS.trendMinChecks, trendRuns: DEFAULT_PARAMS.trendRuns, tuningSeed: TUNING_SEED, reportSeed: REPORT_SEED }
const out = { generated: new Date().toISOString().slice(0, 10), trend, ...runBenchmark(n), burden, burdenBefore }
writeFileSync(new URL('../src/data/benchmark.json', import.meta.url), JSON.stringify(out, null, 1))
const fmt = (x: number) => (x * 100).toFixed(1) + '%'
for (const r of out.rows) console.log(r.world.padEnd(66), r.rule.padEnd(13), 'FA/yr', fmt(r.falseAlarmYear).padStart(6), ' detected(1,2,3):', Object.values(r.detected).map(fmt).join(' '), ' median:', Object.values(r.medianChecksToFlag).join('/'))
for (const [name, list] of [['both routes', burden], ['two in a row only', burdenBefore]] as const)
  for (const b of list) console.log(`${name} prevalence ${b.prevalence}: packets/1000 ${b.packetsPer1000.toFixed(1)}, real ${b.realPer1000.toFixed(1)}, sens ${b.sensitivity.toFixed(3)} [${b.sensitivityCi.map((x) => x.toFixed(3))}], spec ${b.specificity.toFixed(4)}`)
