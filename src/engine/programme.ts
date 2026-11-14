import { evaluate } from './change'
import { BASE_WORLD, rng, simulatePerson } from './simulate'
import { workingDaysBetween } from './packet'

// A simulated programme year for the public health centre's view. Every number on that
// page comes from here and is labelled simulated. Small groups are suppressed.
export const SMALL_CELL = 5

export interface FacilityRow {
  facility: string
  enrolled: number
  baselineDone: number
  held: number
  packets: number
  approved: number
  dismissed: number
  seenInTarget: number
  seenLate: number
  open: number
  lost: number
  urgent: number
}

const FACILITIES = ['Facility 1', 'Facility 2', 'Facility 3', 'Facility 4']

export function simulateProgramme(seed = 7): FacilityRow[] {
  const r = rng(seed)
  return FACILITIES.map((facility, k) => {
    const row: FacilityRow = { facility, enrolled: 0, baselineDone: 0, held: 0, packets: 0, approved: 0, dismissed: 0, seenInTarget: 0, seenLate: 0, open: 0, lost: 0, urgent: 0 }
    const n = [620, 410, 280, 95][k]
    for (let i = 0; i < n; i++) {
      row.enrolled++
      // Some people never finish three checks (set inside the published range of a third to three quarters); some have a failed sound check now and then.
      const keepsGoing = r() < 0.6
      const declining = r() < 0.02
      let checks = simulatePerson({ ...BASE_WORLD, miss: 0.08, slope: declining ? 2 : 0 }, r)
      if (!keepsGoing) checks = checks.slice(0, 1 + Math.floor(r() * 2))
      if (r() < 0.06) checks = checks.map((c, j) => (j === 4 ? { ...c, low: null, high: null, hearingLimited: true } : c))
      const t = evaluate(checks)
      if (t.baseline !== null) row.baselineDone++
      if (checks.some((c) => c.hearingLimited)) row.held++
      const raised = t.results.find((x) => x.status === 'flag' || x.status === 'trend' || x.status === 'review' || x.status === 'urgent')
      if (!raised) continue
      if (raised.status === 'urgent') { row.urgent++; continue }
      row.packets++
      if (r() < 0.3) { row.dismissed++; continue }
      row.approved++
      const u = r()
      if (u < 0.08) { row.lost++; continue }
      if (u < 0.16) { row.open++; continue }
      // Working days from the visit to the specialist appointment.
      const days = workingDaysBetween('2026-03-02', new Date(Date.UTC(2026, 2, 2 + Math.round(8 + r() * 20))).toISOString().slice(0, 10))
      if (days <= 15) row.seenInTarget++
      else row.seenLate++
    }
    return row
  })
}

/** Shows a count, or "<5" when it is small enough to identify someone. Zero is shown as zero. */
export function cell(n: number): string {
  return n > 0 && n < SMALL_CELL ? `<${SMALL_CELL}` : n.toLocaleString()
}
