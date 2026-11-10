import type { ScreeningRecord } from './histories'

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
