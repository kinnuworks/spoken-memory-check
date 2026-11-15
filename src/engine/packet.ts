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
  if (r.bmi >= 30 || r.systolic >= 140) out.push({ name: 'Sleep apnoea', why: 'Raised BMI or blood pressure.', action: 'Ask about snoring and daytime sleepiness; consider a sleep study.', inScreening: false })
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
