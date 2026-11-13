// Runs the official HL7 FHIR validator over the FHIR R4 resources the app builds.
// The resources come from the app's own builders (src/engine/fhir.ts) and the synthetic
// personas (src/engine/histories.ts), the same way the clinician screen makes its download.
//
// Needs Java 17+ and the validator jar in external/fhir-validator/validator_cli.jar
// (https://github.com/hapifhir/org.hl7.fhir.core/releases). See docs/FHIR_VALIDATION.md.
//
//   npx tsx scripts/fhir-validate.ts            # uses the public terminology server
//   npx tsx scripts/fhir-validate.ts --no-tx    # offline: skips terminology checks (-tx n/a)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { bundle, checkObservation, referralRequest } from '../src/engine/fhir'
import { PERSONAS } from '../src/engine/histories'

const JAR = resolve('external/fhir-validator/validator_cli.jar')
if (!existsSync(JAR)) {
  console.error(`Validator jar not found at ${JAR}`)
  process.exit(2)
}

const persona = (id: string) => {
  const p = PERSONAS.find((x) => x.id === id)
  if (!p) throw new Error(`no persona ${id}`)
  return p
}
const patientRef = (id: string) => `Patient/synthetic-${id}`

const stable = persona('stable')
const hearing = persona('hearing')
const decline = persona('decline')
const scored = stable.checks.find((c) => c.low !== null && !c.offDay)!
const offDay = stable.checks.find((c) => c.offDay)!
const missed = stable.checks.find((c) => c.low === null)!
const held = hearing.checks.find((c) => c.hearingLimited)!

const resources: Record<string, object> = {
  'observation-scored.json': checkObservation(patientRef('stable'), scored),
  'observation-scored-parts.json': checkObservation(patientRef('stable'), scored, { repeat: [8, 9], recall: [5, 6], animals: [16, 17] }),
  'observation-off-day.json': checkObservation(patientRef('stable'), offDay),
  'observation-missed.json': checkObservation(patientRef('stable'), missed),
  'observation-held-hearing.json': checkObservation(patientRef('hearing'), held),
  'servicerequest-neurology.json': referralRequest(patientRef('decline'), 'Practitioner/ordering', '2026-08-01', '2026-08-22', 'neurology'),
  'servicerequest-geriatrics.json': referralRequest(patientRef('decline'), 'Practitioner/ordering', '2026-08-01', '2026-08-22', 'geriatrics'),
  'servicerequest-ent.json': referralRequest(patientRef('hearing'), 'Practitioner/ordering', '2026-07-01', '2026-07-22', 'ent', 'urgent'),
  // Built exactly as the clinician screen builds its download.
  'bundle-decline.json': bundle([
    ...decline.checks.map((c) => checkObservation(patientRef('decline'), c)),
    referralRequest(patientRef('decline'), 'Practitioner/ordering', '2026-08-01', '2026-08-22', 'neurology'),
  ]),
  'bundle-hearing.json': bundle([
    ...hearing.checks.map((c) => checkObservation(patientRef('hearing'), c)),
    referralRequest(patientRef('hearing'), 'Practitioner/ordering', '2026-07-01', '2026-07-22', 'ent'),
  ]),
}

const dir = mkdtempSync(join(tmpdir(), 'fhir-validate-'))
const files = Object.entries(resources).map(([name, r]) => {
  const f = join(dir, name)
  writeFileSync(f, JSON.stringify(r, null, 2))
  return f
})

const args = ['-jar', JAR, ...files, '-version', '4.0.1']
if (process.argv.includes('--no-tx')) args.push('-tx', 'n/a')
console.log(`Resources written to ${dir}`)
console.log(`java ${args.map((a) => (a.startsWith(dir) ? a.slice(dir.length + 1) : a)).join(' ')}\n`)

const run = spawnSync('java', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
// Print only the per-file results, not the validator's start-up log.
const start = out.search(/^(-- |\*FAILURE\*|Success)/m)
console.log(start >= 0 ? out.slice(start) : out)

let errors = 0
let warnings = 0
for (const m of out.matchAll(/(\d+) errors?, (\d+) warnings?, (\d+) notes?/g)) {
  errors += Number(m[1])
  warnings += Number(m[2])
}
console.log(`\nTotal over ${files.length} files: ${errors} errors, ${warnings} warnings`)
process.exit(errors > 0 || run.status === null ? 1 : 0)
