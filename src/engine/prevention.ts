import type { ScreeningRecord } from './histories'

// What a person's own screening record shows they can act on. Fixed wording, offered to
// the public health centre for approval; nothing here is generated. There is no single
// risk score: population figures do not translate into one person's risk.
export interface Step { topic: string; found: string; action: string }

export function improvable(r: ScreeningRecord): Step[] {
  const out: Step[] = []
  if (r.hearing === 'reduced') out.push({ topic: 'Hearing', found: 'Your hearing test showed reduced hearing.', action: 'Ask your clinic about a hearing assessment. Hearing well also makes this check fairer.' })
  if (r.systolic >= 140) out.push({ topic: 'Blood pressure', found: `Your blood pressure was ${r.systolic}.`, action: 'Talk to your physician about bringing it down.' })
  if (r.hba1c >= 6.5) out.push({ topic: 'Blood sugar', found: `Your HbA1c was ${r.hba1c}%.`, action: 'Keep your diabetes follow-up appointments.' })
  if (r.ldl >= 3.4) out.push({ topic: 'Cholesterol', found: `Your LDL cholesterol was ${r.ldl}.`, action: 'Ask your physician whether treatment would help.' })
  if (r.activeMinutesWeek < 150) out.push({ topic: 'Movement', found: `You reported about ${r.activeMinutesWeek} active minutes a week.`, action: 'Build up towards 150 minutes a week, a little at a time.' })
  if (r.smoker) out.push({ topic: 'Smoking', found: 'You reported smoking.', action: 'Your clinic can help you stop.' })
  if (r.phq9 >= 10) out.push({ topic: 'Mood', found: 'Your answers suggested low mood.', action: 'Talk to your physician. Mood is treatable and affects memory.' })
  if (r.vision === 'reduced') out.push({ topic: 'Eyesight', found: 'Your eye test showed reduced vision.', action: 'Ask about an eye assessment.' })
  if (r.bmi >= 30) out.push({ topic: 'Weight', found: `Your BMI was ${r.bmi}.`, action: 'Your clinic can help with a plan.' })
  return out
}
