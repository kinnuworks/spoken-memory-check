import type { Check } from './change'
import type { ScreeningRecord, SharedContext } from './histories'

// Fourteen modifiable risk factors from the Lancet Commission on dementia (2024). Ten have
// a matching field in the adult screening record; four do not.
export interface Factor { name: string; field: string | null; value?: string; present?: boolean; note?: string }

export function riskFactors(r: ScreeningRecord): Factor[] {
  return [
    { name: 'Less education', field: 'Schooling', value: `${r.schoolingYears} years`, present: r.schoolingYears < 9, note: 'Cannot be changed now; shown because it affects how a single score should be read.' },
    { name: 'Hearing loss', field: 'Audiometry', value: r.hearing, present: r.hearing === 'reduced' },
    { name: 'High LDL cholesterol', field: 'Lipid panel', value: `${r.ldl} mmol/L`, present: r.ldl >= 3.4 },
    { name: 'Depression', field: 'PHQ-9', value: String(r.phq9), present: r.phq9 >= 10 },
    { name: 'Physical inactivity', field: 'Activity question', value: `${r.activeMinutesWeek} min/week`, present: r.activeMinutesWeek < 150 },
    { name: 'Diabetes', field: 'HbA1c', value: `${r.hba1c}%`, present: r.hba1c >= 6.5 },
    { name: 'Smoking', field: 'Tobacco question', value: r.smoker ? 'yes' : 'no', present: r.smoker },
    { name: 'Hypertension', field: 'Blood pressure', value: `${r.systolic} mmHg systolic`, present: r.systolic >= 140 },
    { name: 'Obesity', field: 'BMI', value: String(r.bmi), present: r.bmi >= 30 },
    { name: 'Vision loss', field: 'Vision screening', value: r.vision, present: r.vision === 'reduced' },
    { name: 'Excess alcohol', field: null },
    { name: 'Traumatic brain injury', field: null },
    { name: 'Social isolation', field: null },
    { name: 'Air pollution', field: null },
  ]
}

export interface Contributor { name: string; why: string; action: string; inScreening: boolean }

/** Treatable contributors to check before anyone concludes the change is degenerative. */
export function treatableContributors(r: ScreeningRecord): Contributor[] {
  const out: Contributor[] = []
  if (r.onMetformin) out.push({ name: 'Vitamin B12', why: 'On metformin, which is linked to lower B12.', action: 'Order serum B12. Not part of the screening package.', inScreening: false })
  else out.push({ name: 'Vitamin B12', why: 'Not measured at the screening visit.', action: 'Consider serum B12.', inScreening: false })
  out.push({ name: 'Thyroid', why: 'Not measured at the screening visit.', action: 'Order TSH. Not part of the screening package.', inScreening: false })
  if (r.phq9 >= 10) out.push({ name: 'Low mood', why: `PHQ-9 was ${r.phq9} at the screening visit.`, action: 'Assess and treat; repeat the check after treatment.', inScreening: true })
  if (r.hearing === 'reduced') out.push({ name: 'Hearing', why: 'Audiometry at the screening visit was reduced. A spoken check depends on hearing.', action: 'Refer to audiology; repeat the check with hearing corrected.', inScreening: true })
  if (r.sleep?.snoringOrPauses || r.bmi >= 30 || r.systolic >= 140) {
    const why = [r.sleep?.snoringOrPauses ? 'Loud snoring or pauses in breathing reported at the first home check' : '', r.bmi >= 30 || r.systolic >= 140 ? 'raised BMI or blood pressure' : ''].filter(Boolean).join('; ')
    out.push({ name: 'Sleep apnoea', why: `${why[0].toUpperCase()}${why.slice(1)}.`, action: 'Ask about daytime sleepiness; consider a sleep study.', inScreening: false })
  }
  out.push({ name: 'Medicines', why: 'Sedating and anticholinergic medicines can lower scores.', action: 'Review the medicine list.', inScreening: false })
  return out
}

/** Working days between two ISO dates, Monday to Friday (the UAE working week since 2022). */
export function workingDaysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z'), b = new Date(toIso + 'T00:00:00Z')
  let n = 0
  for (const d = new Date(a); d < b; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}

export const REFERRAL_TARGET_WORKING_DAYS = 15

/** The date n working days (Monday to Friday) after a date. */
export function addWorkingDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

export interface ContextRow { name: string; shared: boolean; value: string; note: string }

const COPIES = ['no copy', 'one copy', 'two copies']

/**
 * Family and genetic context for the physician, each part only if the person agreed to share it.
 * Context for the conversation only: the rule never reads it, and the flag does not change with it.
 */
export function contextRows(r: ScreeningRecord, shared: SharedContext): ContextRow[] {
  const f = r.familyDementia
  const family = !shared.familyHistory
    ? 'Not shared. The person has not agreed to share this.'
    : f.relative === 'none' ? 'No parent or sibling with dementia recorded.'
    : f.relative === 'unknown' ? 'Not known.'
    : `${f.relative[0].toUpperCase()}${f.relative.slice(1)} diagnosed with dementia${f.ageAtDiagnosis ? ` at ${f.ageAtDiagnosis}` : ''}, as recorded at the screening visit.`
  const genome = !shared.genome
    ? 'Not shared. The person has not agreed to share this.'
    : r.apoeE4Copies === null ? 'No genome programme result on file.'
    : `APOE e4: ${COPIES[r.apoeE4Copies]}, from the Emirati Genome Programme result.`
  return [
    { name: 'Family history of dementia', shared: shared.familyHistory, value: family, note: 'A parent or sibling with dementia raises average risk. It does not change what this person\'s own checks show.' },
    { name: 'Genome programme result', shared: shared.genome, value: genome, note: 'APOE e4 raises the average risk of Alzheimer\'s disease, but many carriers never develop it. If anti-amyloid treatment is ever considered, APOE e4 status also bears on the risk of side effects (ARIA).' },
  ]
}

/** The eight areas Statement 8 asks a solution to connect with cognitive findings. */
export type Area = 'Physical' | 'Metabolic' | 'Sleep' | 'Mental wellbeing' | 'Functional' | 'Lifestyle' | 'Family history' | 'Genomic'

export interface AreaRow {
  area: Area
  /** What the record or the person says, in plain words. */
  finding: string
  /** True when something in this area raises risk or needs a check. */
  concern: boolean
  source: string
  /** How it reached the physician: screening consent, its own consent, or not shared. */
  access: string
}

/**
 * Risk context in the statement's eight areas, each with where it came from and under which
 * consent. Context for the physician only: the change rule never reads it.
 */
export function riskContext(r: ScreeningRecord, shared: SharedContext, checks: Check[]): AreaRow[] {
  const screening = 'Screening visit record'
  const viaScreening = 'Screening consent'
  const fnYes = checks.filter((c) => c.functionChange)
  const asked = checks.filter((c) => c.low !== null).length
  const offDays = checks.filter((c) => c.offDay).length
  const ctx = contextRows(r, shared)
  const sleepFinding = r.sleep
    ? `${r.sleep.hoursPerNight} hours a night; ${r.sleep.snoringOrPauses ? 'loud snoring or pauses in breathing reported' : 'no loud snoring or pauses reported'}`
    : 'Not asked'
  return [
    { area: 'Physical', finding: `Blood pressure ${r.systolic} systolic; BMI ${r.bmi}; hearing ${r.hearing}; vision ${r.vision}`, concern: r.systolic >= 140 || r.bmi >= 30 || r.hearing === 'reduced' || r.vision === 'reduced', source: screening, access: viaScreening },
    { area: 'Metabolic', finding: `HbA1c ${r.hba1c}%; LDL ${r.ldl} mmol/L${r.onMetformin ? '; on metformin' : ''}`, concern: r.hba1c >= 6.5 || r.ldl >= 3.4, source: screening, access: viaScreening },
    { area: 'Sleep', finding: sleepFinding, concern: !!r.sleep && (r.sleep.snoringOrPauses || r.sleep.hoursPerNight < 6), source: 'Two questions at the first home check', access: 'Home-check consent' },
    { area: 'Mental wellbeing', finding: `PHQ-9 ${r.phq9}${r.phq9 >= 10 ? ' (suggests depression)' : ''}; ${offDays} check${offDays === 1 ? '' : 's'} on a day reported as an off day`, concern: r.phq9 >= 10, source: `${screening}; home checks`, access: viaScreening },
    { area: 'Functional', finding: fnYes.length ? `Everyday tasks reported harder on ${fnYes.map((c) => c.date).join(', ')}` : `No change in everyday tasks reported across ${asked} scored check${asked === 1 ? '' : 's'}`, concern: fnYes.length > 0, source: 'Last question of each home check', access: 'Home-check consent' },
    { area: 'Lifestyle', finding: `${r.activeMinutesWeek} active minutes a week; ${r.smoker ? 'smokes' : 'does not smoke'}; ${r.schoolingYears} years of school`, concern: r.activeMinutesWeek < 150 || r.smoker, source: screening, access: viaScreening },
    { area: 'Family history', finding: ctx[0].value, concern: shared.familyHistory && ['mother', 'father', 'sibling'].includes(r.familyDementia.relative), source: screening, access: shared.familyHistory ? 'Its own consent: shared' : 'Not shared' },
    { area: 'Genomic', finding: ctx[1].value, concern: shared.genome && (r.apoeE4Copies ?? 0) > 0, source: 'Emirati Genome Programme', access: shared.genome ? 'Its own consent: shared' : 'Not shared' },
  ]
}
