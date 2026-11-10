// The rule of record. Deterministic: the same checks always give the same answer.
// Baseline is the mean of the first three scored checks. A later check is compared with
// that baseline after taking off the expected practice gain, and the difference is set
// against measurement error. Only a drop that persists across two scored checks is flagged.

export interface Check {
  date: string
  /** Range from the two recognisers; null when the session was not scored or was missed. */
  low: number | null
  high: number | null
  /** The person said they slept badly or felt unwell: kept, shown, and not used to flag. */
  offDay?: boolean
}

export interface RuleParams {
  /** Within-person SD of one check's total score, in points. */
  sem: number
  /** Total practice gain a person reaches after many repeats, in points. */
  practiceGain: number
  /** How many checks it takes to reach about two thirds of that gain. */
  practiceTau: number
  /** z at or below this on two scored checks in a row raises a flag. */
  flagZ: number
  /** A fall from the previous scored check this many errors deep asks for urgent assessment. */
  urgentZ: number
  basis: Record<string, string>
}

export const DEFAULT_PARAMS: RuleParams = {
  sem: 3.5,
  practiceGain: 1.5,
  practiceTau: 2,
  flagZ: -1.645,
  urgentZ: -3.5,
  basis: {
    sem: 'ASSUMPTION until our volunteer retest is in. Animal naming part: SD 5.0 in our survey analysis and a published one-year retest correlation of 0.67 give about 2.9; word recall part assumed 1.8; combined as independent.',
    practiceGain: 'ASSUMPTION. Published first-retest gains are large for a single task; averaging three baseline checks absorbs most of it.',
    flagZ: 'One-sided 5% per check; requiring two checks in a row lowers the false-alarm rate further (measured by simulation on the benchmark page).',
    urgentZ: 'ASSUMPTION, set far from normal variation so that only a very large fall between two neighbouring checks triggers it. Slow decline goes through the routine flag instead.',
  },
}

export type Status = 'building-baseline' | 'usual-range' | 'watch' | 'flag' | 'urgent'

export interface CheckResult {
  index: number
  date: string
  scored: boolean
  mid: number | null
  /** Later score minus baseline, after the practice adjustment. */
  change: number | null
  sd: number | null
  z: number | null
  /** Probability the person's true score is below their baseline, given this check alone. */
  pBelow: number | null
  status: Status
  note: string
}

export interface Trajectory {
  baseline: number | null
  baselineChecks: number[]
  results: CheckResult[]
  status: Status
}

function phi(z: number): number {
  // Abramowitz and Stegun 7.1.26, absolute error under 1.5e-7.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

/** Expected gain at the nth scored check (n from 1) over a first-ever check. */
export function expectedPractice(n: number, p: RuleParams): number {
  return p.practiceGain * (1 - Math.exp(-(n - 1) / p.practiceTau))
}

export function evaluate(checks: Check[], p: RuleParams = DEFAULT_PARAMS): Trajectory {
  const isScored = (c: Check) => c.low !== null && c.high !== null
  const scoredIdx = checks.map((c, i) => (isScored(c) ? i : -1)).filter((i) => i >= 0)
  const baseIdx = scoredIdx.slice(0, 3)
  const haveBaseline = baseIdx.length === 3
  const mid = (c: Check) => ((c.low as number) + (c.high as number)) / 2
  // A range is treated as uniform between its ends, so it adds width squared over twelve.
  const rangeVar = (c: Check) => ((c.high as number) - (c.low as number)) ** 2 / 12
  const baseline = haveBaseline ? baseIdx.reduce((s, i) => s + mid(checks[i]), 0) / 3 : null
  const basePractice = haveBaseline ? [1, 2, 3].reduce((s, n) => s + expectedPractice(n, p), 0) / 3 : 0
  const baseVar = haveBaseline ? (p.sem ** 2 * 3 + baseIdx.reduce((s, i) => s + rangeVar(checks[i]), 0)) / 9 : 0

  const results: CheckResult[] = []
  let nScored = 0
  let prevBelow = false
  let prevMid: number | null = null
  let overall: Status = haveBaseline ? 'usual-range' : 'building-baseline'
  checks.forEach((c, i) => {
    if (!isScored(c)) {
      results.push({ index: i, date: c.date, scored: false, mid: null, change: null, sd: null, z: null, pBelow: null, status: overall, note: 'Not scored. Nothing is assumed from a missing check; the next one is compared as usual.' })
      return
    }
    nScored += 1
    const m = mid(c)
    const last = prevMid
    prevMid = m
    if (!haveBaseline || baseIdx.includes(i)) {
      results.push({ index: i, date: c.date, scored: true, mid: m, change: null, sd: null, z: null, pBelow: null, status: 'building-baseline', note: `Baseline check ${Math.min(nScored, 3)} of 3.` })
      return
    }
    const change = m - (expectedPractice(nScored, p) - basePractice) - (baseline as number)
    const sd = Math.sqrt(p.sem ** 2 + rangeVar(c) + baseVar)
    const z = change / sd
    const below = z <= p.flagZ
    let status: Status = 'usual-range'
    let note = 'Within the usual range for this person.'
    if (c.offDay) {
      note = below ? 'Lower than usual on a day reported as an off day. Not counted towards a flag.' : note
      status = below ? 'watch' : 'usual-range'
    } else if (below && last !== null && (m - last) / (p.sem * Math.SQRT2) <= p.urgentZ) {
      status = 'urgent'
      note = 'A very large fall since the last check. The person is told to seek urgent assessment.'
    } else if (below && prevBelow) {
      status = 'flag'
      note = 'Lower than usual on two checks in a row. A packet goes to the ordering physician.'
    } else if (below) {
      status = 'watch'
      note = 'Lower than usual once. One check is not enough; the next check decides.'
    }
    if (!c.offDay) prevBelow = below
    overall = status
    results.push({ index: i, date: c.date, scored: true, mid: m, change, sd, z, pBelow: phi(-z), status, note })
  })
  return { baseline, baselineChecks: baseIdx, results, status: overall }
}
