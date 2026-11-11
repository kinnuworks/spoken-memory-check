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
  /** The person (or family) reported that everyday tasks have become harder. Unasked or unclear stays undefined. */
  functionChange?: boolean
  /** The sound check failed, so the check was held: a spoken test cannot be read when hearing is in doubt. */
  hearingLimited?: boolean
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
  sem: 4.0,
  practiceGain: 1.0,
  practiceTau: 1,
  flagZ: -1.645,
  urgentZ: -3.5,
  basis: {
    sem: 'Built from published retest studies, none of them of this exact check. Animal naming 3.2: Duff et al. (62 older adults, one week, https://pmc.ncbi.nlm.nih.gov/articles/PMC3789513) and Gavett et al. (4,217 adults aged 50 and over, one year, r 0.67). Word recall 2.2: Health and Retirement Study SDs for immediate and delayed recall (17,913 people, https://pmc.ncbi.nlm.nih.gov/articles/PMC4542644) with phone retest of the pair at 0.66 (Lachman et al., https://midus.wisc.edu/wp-content/uploads/2024/04/1338.pdf). Combined as independent gives 3.9; a shared bad-day error would give about 4.3. We use 4.0 and show 3.5 and 4.5 as bounds. Our own volunteer retest will replace it.',
    practiceGain: 'Animal naming gains about 0.6 at one week (Duff et al.). No published gain exists for single-hearing word lists that change each time; 0.4 is our ASSUMPTION. Total 1.0.',
    practiceTau: 'ASSUMPTION: most of the gain arrives by the second check.',
    flagZ: 'One-sided 5% per check; asking for two checks in a row lowers the false-alarm rate (measured on the benchmark page).',
    urgentZ: 'ASSUMPTION, set far from normal variation so that only a very large fall between two neighbouring checks triggers it. Slow decline goes through the routine flag instead.',
  },
}

export type Status = 'building-baseline' | 'usual-range' | 'watch' | 'review' | 'flag' | 'urgent'

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
      const note = c.hearingLimited
        ? 'Held: the sound check failed, so this check was not scored. A missing score is never treated as a low score. If it happens again the person is pointed to a hearing assessment.'
        : 'Not scored. Nothing is assumed from a missing check; the next one is compared as usual.'
      results.push({ index: i, date: c.date, scored: false, mid: null, change: null, sd: null, z: null, pBelow: null, status: overall, note })
      return
    }
    nScored += 1
    const m = mid(c)
    const last = prevMid
    prevMid = m
    if (!haveBaseline || baseIdx.includes(i)) {
      // Function overrides the number: a reported change in everyday tasks goes to a physician even before a baseline exists.
      const st: Status = c.functionChange ? 'review' : 'building-baseline'
      if (c.functionChange) overall = 'review'
      results.push({ index: i, date: c.date, scored: true, mid: m, change: null, sd: null, z: null, pBelow: null, status: st, note: c.functionChange ? 'The person reported that everyday tasks have become harder. That goes to the physician whatever the scores say.' : `Baseline check ${Math.min(nScored, 3)} of 3.` })
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
    if (c.functionChange && status !== 'flag' && status !== 'urgent') {
      status = 'review'
      note = 'The person reported that everyday tasks have become harder. That goes to the physician whatever the scores say.'
    }
    if (!c.offDay) prevBelow = below
    overall = status
    results.push({ index: i, date: c.date, scored: true, mid: m, change, sd, z, pBelow: phi(-z), status, note })
  })
  return { baseline, baselineChecks: baseIdx, results, status: overall }
}
