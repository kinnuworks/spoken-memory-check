// The flag by language, with each part of the check heard at the rates measured on real recordings.
// Animal naming has one listener (the on-device model); word recall has two (the model and
// own-voice matching). Animals are 14 of the 27 points in the recorded check, so 0.52.
// Usage: npx tsx scripts/by-language.ts [people-per-cell]
import { readFileSync, writeFileSync } from 'node:fs'
import { byLanguage, REPORT_SEED, type Listening } from '../src/engine/simulate'

const n = Number(process.argv[2] ?? 20000)
const ANIMAL_SHARE = 14 / 27
const t = JSON.parse(readFileSync(new URL('../src/data/template-bench.json', import.meta.url), 'utf8'))
type Rate = { rate: number; wilson: [number, number] }
const row = (lang: string, o: { speakers: number; whisperAlone: Rate; templatesAlone: Rate; union: Rate & { n: number } }) => {
  const both = o.whisperAlone.rate + o.templatesAlone.rate - o.union.rate
  const central: Listening = { animalsHeard: o.whisperAlone.rate, recallBoth: both, recallEither: o.union.rate, animalShare: ANIMAL_SHARE }
  const drop = o.union.rate - o.union.wilson[0]
  const pessimistic: Listening = { animalsHeard: o.whisperAlone.wilson[0], recallBoth: Math.max(0, both - drop), recallEither: o.union.wilson[0], animalShare: ANIMAL_SHARE }
  return { lang, central, pessimistic, words: o.union.n, speakers: o.speakers }
}
const u = t.unionWithWhisper
const rows = byLanguage(n, [row('Arabic', u.arabic.own.overall), row('English', u.english.own.overall)])
writeFileSync(new URL('../src/data/by-language.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), n, seed: REPORT_SEED, animalShare: ANIMAL_SHARE, rows }, null, 1) + '\n')
const f = (x: number) => (x * 100).toFixed(1) + '%'
for (const r of rows) console.log(r.lang.padEnd(8), 'FA/yr', f(r.central.falseAlarmYear), 'caught at 1 and 2 points:', f(r.central.detected['1']), f(r.central.detected['2']), '| low end of intervals:', f(r.pessimistic.falseAlarmYear), f(r.pessimistic.detected['1']), f(r.pessimistic.detected['2']))
