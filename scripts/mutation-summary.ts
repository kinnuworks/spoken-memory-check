// Turns the mutation-testing report (npx stryker run, config in stryker.config.json) into the small
// summary the app shows. A mutant is a small deliberate bug (a flipped comparison, a changed number,
// an emptied branch) put into the decision rules one at a time; the score is the share the tests catch.
//   npx tsx scripts/mutation-summary.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const report = JSON.parse(readFileSync(join(ROOT, 'external/mutation/mutation.json'), 'utf8'))
const ROLE: Record<string, string> = {
  'change.ts': 'Flag rule: baseline, two checks together, slow decline, urgent, held and off-day checks',
  'score.ts': 'Scoring ranges from the listeners',
  'match.ts': 'Word matching, Arabic folding and near misses',
  'din.ts': 'Hearing check threshold and referral',
  'consent.ts': 'Consent parts',
  'packet.ts': 'Physician packet: risk factors, treatable causes, referral clock',
  'rescore.ts': 'Blind re-scoring',
}
const files = Object.entries(report.files as Record<string, { mutants: { status: string }[] }>).map(([path, f]) => {
  const count = (s: string) => f.mutants.filter((m) => m.status === s).length
  const killed = count('Killed') + count('Timeout')
  const survived = count('Survived') + count('NoCoverage')
  const name = path.split('/').pop() as string
  return { file: name, role: ROLE[name] ?? '', mutants: killed + survived, caught: killed, score: Math.round((killed / (killed + survived)) * 1000) / 1000 }
})
const caught = files.reduce((a, f) => a + f.caught, 0), all = files.reduce((a, f) => a + f.mutants, 0)
const out = {
  generated: new Date().toISOString().slice(0, 10),
  tool: 'StrykerJS 10.1 with the Vitest runner',
  mutants: all, caught, score: Math.round((caught / all) * 1000) / 1000,
  note: 'Most bugs the tests miss are changes to wording shown to people, not to the decision itself.',
  files,
}
writeFileSync(join(ROOT, 'src/data/mutation-summary.json'), JSON.stringify(out, null, 1) + '\n')
console.log(out.caught, '/', out.mutants, out.score)
