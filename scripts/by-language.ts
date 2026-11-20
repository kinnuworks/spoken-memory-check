// The flag by language, using the listening rates measured on real recordings.
// Usage: npx tsx scripts/by-language.ts [people-per-cell]
import { readFileSync, writeFileSync } from 'node:fs'
import { byLanguage, REPORT_SEED } from '../src/engine/simulate'

const n = Number(process.argv[2] ?? 20000)
const t = JSON.parse(readFileSync(new URL('../src/data/template-bench.json', import.meta.url), 'utf8'))
const u = t.unionWithWhisper
const row = (lang: string, o: { clips: number; speakers: number; union: { k: number; n: number; rate: number; wilson: [number, number] } }) =>
  ({ lang, heard: o.union.rate, heardLow: o.union.wilson[0], words: o.union.n, speakers: o.speakers })
const measured = [row('Arabic', u.arabic.own.overall), row('English', u.english.own.overall)]
const rows = byLanguage(n, measured)
writeFileSync(new URL('../src/data/by-language.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), n, seed: REPORT_SEED, rows }, null, 1) + '\n')
for (const r of rows) console.log(r.lang, 'heard', r.heard, 'miss', r.central.miss, 'FA/yr', r.central.falseAlarmYear.toFixed(3), 'det1', r.central.detected['1'].toFixed(3), 'det2', r.central.detected['2'].toFixed(3), '| pessimistic', r.pessimistic.falseAlarmYear.toFixed(3), r.pessimistic.detected['1'].toFixed(3), r.pessimistic.detected['2'].toFixed(3))
