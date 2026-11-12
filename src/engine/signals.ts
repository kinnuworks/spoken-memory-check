import { rng } from './simulate'

// The "lost signals" audit: every abnormal brain-relevant result from the screening visit,
// and whether anyone acted on it in time. In a programme this reads the screening record
// and the referral log. Here it runs on a simulated programme year; the settings below are
// assumptions for the demonstration, stated on the page, not observations.

export interface SignalRule {
  id: string
  signal: string
  abnormal: string
  action: string
  targetDays: number
  /** Simulation settings: share of members with the abnormal result, share acted on in time, late, never. */
  setting: { abnormal: number; inTime: number; late: number }
}

export const SIGNALS: SignalRule[] = [
  { id: 'moca', signal: 'Memory test at the visit', abnormal: 'MoCA below 26', action: 'Physician review and a repeat test', targetDays: 30, setting: { abnormal: 0.12, inTime: 0.55, late: 0.2 } },
  { id: 'hearing', signal: 'Hearing screen', abnormal: 'Reduced', action: 'Audiology referral', targetDays: 30, setting: { abnormal: 0.15, inTime: 0.4, late: 0.2 } },
  { id: 'mood', signal: 'PHQ-9', abnormal: '10 or more', action: 'Assessment for depression', targetDays: 14, setting: { abnormal: 0.06, inTime: 0.5, late: 0.2 } },
  { id: 'hba1c', signal: 'HbA1c', abnormal: '6.5% or more', action: 'Diabetes care plan', targetDays: 30, setting: { abnormal: 0.18, inTime: 0.65, late: 0.15 } },
  { id: 'bp', signal: 'Blood pressure', abnormal: 'Systolic 140 or more', action: 'Repeat reading and treatment plan', targetDays: 30, setting: { abnormal: 0.22, inTime: 0.6, late: 0.15 } },
  { id: 'vision', signal: 'Vision screen', abnormal: 'Reduced', action: 'Eye referral', targetDays: 60, setting: { abnormal: 0.1, inTime: 0.5, late: 0.2 } },
]

export interface SignalRow {
  id: string
  signal: string
  abnormal: string
  action: string
  targetDays: number
  flagged: number
  inTime: number
  late: number
  noAction: number
  noActionPer1000: number
}

export interface Audit { members: number; rows: SignalRow[]; peopleWithAny: number; peopleWithAnyPer1000: number }

/** Simulated year for `members` people. Each abnormal result is acted on in time, late, or never. */
export function lostSignals(members = 1405, seed = 11): Audit {
  const r = rng(seed)
  const rows: SignalRow[] = SIGNALS.map((s) => ({ id: s.id, signal: s.signal, abnormal: s.abnormal, action: s.action, targetDays: s.targetDays, flagged: 0, inTime: 0, late: 0, noAction: 0, noActionPer1000: 0 }))
  let peopleWithAny = 0
  for (let i = 0; i < members; i++) {
    let any = false
    SIGNALS.forEach((s, k) => {
      if (r() >= s.setting.abnormal) return
      rows[k].flagged++
      const u = r()
      if (u < s.setting.inTime) rows[k].inTime++
      else if (u < s.setting.inTime + s.setting.late) rows[k].late++
      else { rows[k].noAction++; any = true }
    })
    if (any) peopleWithAny++
  }
  for (const row of rows) row.noActionPer1000 = Math.round((row.noAction / members) * 1000)
  return { members, rows, peopleWithAny, peopleWithAnyPer1000: Math.round((peopleWithAny / members) * 1000) }
}

// The hearing pathway, from the home hearing check to an aid that is still worn.
// Simulated: every share below is a setting for the demonstration, stated on the page.
export const HEARING_SETTINGS = { checked: 0.7, refer: 0.18, seen: 0.7, fitted: 0.55, wearing: 0.6 }

export interface HearingStep { step: string; count: number }

export function hearingPathway(members = 1405, seed = 13): HearingStep[] {
  const r = rng(seed)
  const s = HEARING_SETTINGS
  const c = { checked: 0, refer: 0, seen: 0, fitted: 0, wearing: 0 }
  for (let i = 0; i < members; i++) {
    if (r() >= s.checked) continue
    c.checked++
    if (r() >= s.refer) continue
    c.refer++
    if (r() >= s.seen) continue
    c.seen++
    if (r() >= s.fitted) continue
    c.fitted++
    if (r() < s.wearing) c.wearing++
  }
  return [
    { step: 'Did the home hearing check', count: c.checked },
    { step: 'Hearing test suggested', count: c.refer },
    { step: 'Seen by audiology', count: c.seen },
    { step: 'Hearing aid fitted', count: c.fitted },
    { step: 'Still wearing it at 3 months', count: c.wearing },
  ]
}
