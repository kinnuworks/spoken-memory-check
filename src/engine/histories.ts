import type { Check } from './change'

// Seeded synthetic people for the demo. None of this is real data; every screen that
// shows it says so. Scores are totals of the full check: words said back (0 to 10),
// words recalled later (0 to 10) and animals named in a minute.

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(r: () => number) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
}

export interface ScreeningRecord {
  // Fields a screening visit already records, used to fill the packet. Synthetic.
  age: number
  sex: 'F' | 'M'
  mocaAtVisit: number
  hba1c: number
  onMetformin: boolean
  systolic: number
  ldl: number
  bmi: number
  smoker: boolean
  hearing: 'normal' | 'reduced'
  vision: 'normal' | 'reduced'
  phq9: number
  activeMinutesWeek: number
  schoolingYears: number
  /** Dementia in a parent or sibling, as recorded at the screening visit. */
  familyDementia: { relative: 'mother' | 'father' | 'sibling' | 'none' | 'unknown'; ageAtDiagnosis?: number }
  /** APOE e4 copies from the Emirati Genome Programme result, if the person has one. */
  apoeE4Copies: 0 | 1 | 2 | null
}

/** What the person agreed to share with the physician beyond the scores. Off unless agreed. */
export interface SharedContext { familyHistory: boolean; genome: boolean }

export interface Persona {
  id: string
  name: string
  /** Which route through the rule this case shows. */
  path: string
  story: string
  record: ScreeningRecord
  shared: SharedContext
  checks: Check[]
}

function series(seed: number, start: number, slopePerCheck: number, declineFrom: number, opts: { missed?: number[]; off?: number[]; wide?: number[]; stopAfter?: number; held?: number[]; fn?: number[]; crashAt?: number; practice?: number; dip?: Record<number, number> } = {}): Check[] {
  const r = rng(seed)
  const out: Check[] = []
  // Three baseline checks in the first two weeks, then one about every six weeks.
  const days = [0, 5, 12, 54, 96, 138, 180, 222, 264, 306, 348]
  days.slice(0, opts.stopAfter ?? days.length).forEach((d, i) => {
    const date = new Date(Date.UTC(2026, 0, 12 + d)).toISOString().slice(0, 10)
    if (opts.held?.includes(i)) return out.push({ date, low: null, high: null, hearingLimited: true })
    if (opts.missed?.includes(i)) return out.push({ date, low: null, high: null })
    const practice = (opts.practice ?? 1) * (1 - Math.exp(-i))
    const drop = (i >= declineFrom ? slopePerCheck * (i - declineFrom + 1) : 0) + (opts.crashAt !== undefined && i >= opts.crashAt ? 22 : 0) + (opts.dip?.[i] ?? 0)
    const v = Math.max(0, Math.round(start + practice - drop + normal(r) * 2.2))
    const w = opts.wide?.includes(i) ? 3 : r() < 0.3 ? 1 : 0
    out.push({ date, low: v - w, high: v, offDay: opts.off?.includes(i), ...(opts.fn?.includes(i) ? { functionChange: true } : {}) })
  })
  return out
}

export const PERSONAS: Persona[] = [
  {
    id: 'stable',
    name: 'A, 58',
    path: 'No flag',
    story: 'Stable. One clearly low check on a day reported as a bad night does not count, and one check was missed; nothing is flagged.',
    record: { age: 58, sex: 'F', mocaAtVisit: 25, hba1c: 5.6, onMetformin: false, systolic: 124, ldl: 2.9, bmi: 27, smoker: false, hearing: 'normal', vision: 'normal', phq9: 3, activeMinutesWeek: 160, schoolingYears: 6, familyDementia: { relative: 'none' }, apoeE4Copies: null },
    shared: { familyHistory: false, genome: false },
    checks: series(11, 31, 0, 99, { off: [6], missed: [8], dip: { 6: 11 } }),
  },
  {
    id: 'practice',
    name: 'B, 63',
    path: 'No flag',
    story: 'Scores rise with practice over the first checks, more than the rule expects. Rising scores never raise a flag.',
    record: { age: 63, sex: 'M', mocaAtVisit: 27, hba1c: 6.1, onMetformin: false, systolic: 136, ldl: 3.4, bmi: 30, smoker: true, hearing: 'normal', vision: 'reduced', phq9: 2, activeMinutesWeek: 60, schoolingYears: 12, familyDementia: { relative: 'father', ageAtDiagnosis: 81 }, apoeE4Copies: 0 },
    shared: { familyHistory: true, genome: false },
    checks: series(23, 31, 0, 99, { wide: [4], practice: 4 }),
  },
  {
    id: 'decline',
    name: 'C, 61',
    path: 'Flag, then physician',
    story: 'A steady drop from the fifth check on. It is flagged when it persists, and the packet points to treatable contributors first.',
    record: { age: 61, sex: 'F', mocaAtVisit: 26, hba1c: 7.4, onMetformin: true, systolic: 148, ldl: 3.9, bmi: 32, smoker: false, hearing: 'reduced', vision: 'normal', phq9: 11, activeMinutesWeek: 30, schoolingYears: 9, familyDementia: { relative: 'mother', ageAtDiagnosis: 74 }, apoeE4Copies: 1 },
    shared: { familyHistory: true, genome: true },
    // The history stops where the packet is sent: what happens next is the physician's call.
    checks: series(37, 33, 2.4, 4, { stopAfter: 8 }),
  },
  {
    id: 'hearing',
    name: 'D, 62',
    path: 'Held for hearing',
    story: 'The sound check fails twice in a row. Those checks are held, not scored as low, and the person is pointed to a hearing assessment.',
    record: { age: 62, sex: 'M', mocaAtVisit: 24, hba1c: 5.9, onMetformin: false, systolic: 132, ldl: 3.1, bmi: 26, smoker: false, hearing: 'reduced', vision: 'normal', phq9: 4, activeMinutesWeek: 120, schoolingYears: 4, familyDementia: { relative: 'unknown' }, apoeE4Copies: null },
    shared: { familyHistory: false, genome: false },
    checks: series(51, 27, 0, 99, { held: [5, 6], stopAfter: 9 }),
  },
  {
    id: 'function',
    name: 'E, 64',
    path: 'Review on reported change',
    story: 'Scores stay in the usual range, but the person says everyday tasks have become harder. That goes to the physician whatever the scores say.',
    record: { age: 64, sex: 'F', mocaAtVisit: 23, hba1c: 6.0, onMetformin: false, systolic: 138, ldl: 3.0, bmi: 28, smoker: false, hearing: 'normal', vision: 'normal', phq9: 6, activeMinutesWeek: 90, schoolingYears: 0, familyDementia: { relative: 'sibling', ageAtDiagnosis: 69 }, apoeE4Copies: 1 },
    shared: { familyHistory: true, genome: false },
    checks: series(64, 24, 0, 99, { fn: [6], stopAfter: 7 }),
  },
  {
    id: 'urgent',
    name: 'F, 59',
    path: 'Urgent route',
    story: 'A very large fall between two neighbouring checks. The routine flow is bypassed and the person is told to seek urgent assessment.',
    record: { age: 59, sex: 'M', mocaAtVisit: 26, hba1c: 6.8, onMetformin: true, systolic: 156, ldl: 3.6, bmi: 29, smoker: true, hearing: 'normal', vision: 'normal', phq9: 3, activeMinutesWeek: 100, schoolingYears: 8, familyDementia: { relative: 'none' }, apoeE4Copies: 0 },
    shared: { familyHistory: false, genome: false },
    checks: series(78, 32, 0, 99, { crashAt: 6, stopAfter: 7 }),
  },
]
