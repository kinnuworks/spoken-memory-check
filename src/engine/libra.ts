import type { ScreeningRecord } from './histories'

// LIBRA (LIfestyle for BRAin health): a published index of twelve modifiable factors, weighted
// from meta-analyses of each factor's link with dementia. Higher means more modifiable risk.
// Factors: Deckers et al. 2015 (doi 10.1002/gps.4245); index: Schiepers et al. 2018
// (doi 10.1002/gps.4700). The weights here are as reprinted in Stubs et al. 2025, Table 1
// (doi 10.1016/j.tjpad.2025.100326); they add up to the published range of −5.9 to +12.7
// (Rosenau et al. 2024, doi 10.3233/JAD-240666). In the English Longitudinal Study of Ageing
// each point raised dementia risk by 13% (HR 1.13, 95% CI 1.09 to 1.16, C-statistic 0.68), and in
// midlife (the CAIDE cohort, 30 years) by 27% (HR 1.27, 1.13 to 1.43, C 0.67). It ranks
// modifiable risk; it does not tell one person what will happen, and it is not a diagnosis.

export interface LibraFactor {
  name: string
  weight: number
  /** true present, false absent, null when the screening record has no field for it. */
  present: boolean | null
  basis: string
}

export interface Libra {
  factors: LibraFactor[]
  /** Points from the factors the record knows. */
  known: number
  knownCount: number
  /** The score once the unknown factors are allowed for: every unknown protective factor present, or every unknown risk factor present. */
  low: number
  high: number
  /** Present risk factors, heaviest first: where prevention is likely to count most. */
  ranked: LibraFactor[]
}

export const LIBRA_RANGE = { min: -5.9, max: 12.7 }

export function libra(r: ScreeningRecord): Libra {
  const factors: LibraFactor[] = [
    { name: 'Depression', weight: 2.1, present: r.phq9 >= 10, basis: `PHQ-9 ${r.phq9} (10 or more)` },
    { name: 'Hypertension', weight: 1.6, present: r.systolic >= 140, basis: `systolic ${r.systolic} mmHg (140 or more)` },
    { name: 'Obesity', weight: 1.6, present: r.bmi >= 30, basis: `BMI ${r.bmi} (30 or more)` },
    { name: 'Smoking', weight: 1.5, present: r.smoker, basis: r.smoker ? 'smokes' : 'does not smoke' },
    { name: 'High cholesterol', weight: 1.4, present: r.ldl >= 3.4, basis: `LDL ${r.ldl} mmol/L (3.4 or more)` },
    { name: 'Diabetes', weight: 1.3, present: r.hba1c >= 6.5, basis: `HbA1c ${r.hba1c}% (6.5 or more)` },
    { name: 'Physical inactivity', weight: 1.1, present: r.activeMinutesWeek < 150, basis: `${r.activeMinutesWeek} active minutes a week (under 150)` },
    { name: 'Chronic kidney disease', weight: 1.1, present: null, basis: 'not in the screening record' },
    { name: 'Coronary heart disease', weight: 1.0, present: null, basis: 'not in the screening record' },
    { name: 'Low to moderate alcohol', weight: -1.0, present: null, basis: 'not in the screening record' },
    { name: 'Mediterranean-style diet', weight: -1.7, present: null, basis: 'not in the screening record' },
    { name: 'High cognitive activity', weight: -3.2, present: null, basis: 'not in the screening record' },
  ]
  const round = (x: number) => Math.round(x * 10) / 10
  const known = round(factors.reduce((s, f) => s + (f.present ? f.weight : 0), 0))
  const unknown = factors.filter((f) => f.present === null)
  const low = round(known + unknown.reduce((s, f) => s + Math.min(0, f.weight), 0))
  const high = round(known + unknown.reduce((s, f) => s + Math.max(0, f.weight), 0))
  const ranked = factors.filter((f) => f.present === true && f.weight > 0).sort((a, b) => b.weight - a.weight)
  return { factors, known, knownCount: factors.length - unknown.length, low, high, ranked }
}
