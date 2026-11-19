// The rule of record. Deterministic: the same checks always give the same answer.
// Baseline is the mean of the first three scored checks. A later check is compared with
// that baseline after taking off the expected practice gain, and the difference is set
// against measurement error. A packet needs the last two scored checks together to sit well
// below baseline, so one bad day is never enough. A second, separate route looks for slow
// decline: a straight line through every scored check so far, after the practice adjustment,
// whose slope is reliably below zero.

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
  /** z at or below this on one check marks it as lower than usual (shown, never sent on by itself). */
  flagZ: number
  /** How two neighbouring scored checks are tested: 'mean' tests their average against baseline; 'each' (the previous rule) needs each one at or below flagZ. */
  pairMode: 'mean' | 'each'
  /** In 'mean' mode, z of the average of the last two scored checks at or below this raises a flag. */
  pairZ: number
  /** A fall from the previous scored check this many errors deep asks for urgent assessment. */
  urgentZ: number
  /** The slope of the line through all scored checks, over its error, at or below this counts as a falling trend. */
  trendZ: number
  /** Scored checks (baseline included, off days left out) needed before the trend is tested. */
  trendMinChecks: number
  /** How many scored checks in a row the falling trend must hold before it raises a packet. */
  trendRuns: number
  basis: Record<string, string>
}

export const DEFAULT_PARAMS: RuleParams = {
  sem: 4.0,
  practiceGain: 1.0,
  practiceTau: 1,
  flagZ: -1.645,
  pairMode: 'mean',
  pairZ: -2.6,
  urgentZ: -3.5,
  trendZ: -2.1,
  trendMinChecks: 8,
  trendRuns: 1,
  basis: {
    sem: 'Built from published retest studies, none of them of this exact check. Animal naming 3.2: Duff et al. (62 older adults, one week, https://pmc.ncbi.nlm.nih.gov/articles/PMC3789513) and Gavett et al. (4,217 adults aged 50 and over, one year, r 0.67). Word recall 2.2: Health and Retirement Study SDs for immediate and delayed recall (17,913 people, https://pmc.ncbi.nlm.nih.gov/articles/PMC4542644) with phone retest of the pair at 0.66 (Lachman et al., https://midus.wisc.edu/wp-content/uploads/2024/04/1338.pdf). Combined as independent gives 3.9; a shared bad-day error would give about 4.3. We use 4.0 and show 3.5 and 4.5 as bounds. Our own volunteer retest will replace it.',
    practiceGain: 'Animal naming gains about 0.6 at one week (Duff et al.). No published gain exists for single-hearing word lists that change each time; 0.4 is our ASSUMPTION. Total 1.0.',
    practiceTau: 'ASSUMPTION: most of the gain arrives by the second check.',
    flagZ: 'One-sided 5% for a single check. A single low check is shown to the person and the physician view as lower than usual, and is never sent on by itself.',
    pairMode: 'Changed in this version. Testing the average of two neighbouring checks uses both checks fully; asking each of them to fall below a cut-off throws away how far each one fell. On the tuning seed it caught more slow decline and more sudden drops, no later, at the same false-alarm rate.',
    pairZ: 'Fixed with trendZ on the tuning seed (1, 20,000 simulated people per group), kept apart from the seed behind the reported numbers (20261110). In steps of 0.1, the setting that caught the most people losing one point a check while keeping false alarms in stable people at or under 5% a year and catching sudden drops of 6, 8 and 10 points no later (median checks to a packet) than the rule it replaced. The next stricter step, -2.7, caught slightly more slow decline but caught an 8-point drop one check later.',
    urgentZ: 'ASSUMPTION, set far from normal variation so that only a very large fall between two neighbouring checks triggers it. Slow decline goes through the routine flag or the trend route instead.',
    trendZ: 'Fixed with pairZ before the reported run, on the tuning seed: for each pairZ, the loosest cut-off in steps of 0.05 at which both routes together kept false alarms in stable people at or under 5% a year in the as-assumed world (4.9% on the tuning seed). About 1 in 55 for a single test, but the trend is tested at every check from the eighth, so the year-long rate is what was tuned.',
    trendMinChecks: 'Fixed on the tuning seed: eight scored checks, the three baseline checks included. From four to seven checks caught less slow decline at the same false-alarm rate; nine caught slightly more but caught a 6-point drop later.',
    trendRuns: 'Fixed on the tuning seed: one check with the stricter cut-off caught more slow decline than two checks in a row with a looser one (the previous setting) at the same false-alarm rate. The line already uses every check, so asking it to hold twice added delay more than safety.',
  },
}

/** The previous rule: each of two checks in a row low, plus a trend that had to hold twice. Kept for comparison. */
export const PREVIOUS_PARAMS: RuleParams = { ...DEFAULT_PARAMS, pairMode: 'each', trendZ: -1.9, trendMinChecks: 8, trendRuns: 2 }

/** The first rule, before the trend route: two low checks in a row, urgent and review only. Kept for comparison. */
export const TWO_IN_A_ROW_ONLY: RuleParams = { ...PREVIOUS_PARAMS, trendZ: Number.NEGATIVE_INFINITY }

export type Status = 'building-baseline' | 'usual-range' | 'watch' | 'review' | 'flag' | 'trend' | 'urgent'

/** Plain words for each status, for tester and physician views. */
export const STATUS_LABEL: Record<Status, string> = {
  'building-baseline': 'Setting the baseline',
  'usual-range': 'Within the usual range',
  watch: 'Lower once',
  review: 'Reported change in everyday tasks',
  flag: 'Lower across two checks',
  trend: 'Slowly falling',
  urgent: 'Very large fall',
}

/** Statuses that send a packet to the ordering physician (urgent goes to urgent assessment instead). */
export const PACKET_STATUSES: readonly Status[] = ['flag', 'trend', 'review']

/** One sentence for the physician packet when the trend route raised it. */
export const TREND_PACKET_NOTE = 'Raised by the slow-decline route: across all scored checks the practice-adjusted score has fallen steadily, by more than measurement error can explain, even though the two-checks-together route did not send a packet on its own.'

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
  /** z of the average of this check and the previous scored one, against baseline; null when there is no previous one. */
  pairZ: number | null
  /** Practice-adjusted points per check from a straight line through all scored checks so far; null until there are enough. */
  slope: number | null
  slopeSd: number | null
  slopeZ: number | null
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

interface Point { x: number; y: number; v: number }

/** Least-squares slope through the points, with its error from the known per-check variances. */
export function trendLine(pts: Point[]): { slope: number; sd: number; z: number } | null {
  if (pts.length < 3) return null
  const xbar = pts.reduce((s, q) => s + q.x, 0) / pts.length
  const ybar = pts.reduce((s, q) => s + q.y, 0) / pts.length
  const sxx = pts.reduce((s, q) => s + (q.x - xbar) ** 2, 0)
  if (sxx === 0) return null
  const slope = pts.reduce((s, q) => s + (q.x - xbar) * (q.y - ybar), 0) / sxx
  const sd = Math.sqrt(pts.reduce((s, q) => s + ((q.x - xbar) / sxx) ** 2 * q.v, 0))
  return { slope, sd, z: slope / sd }
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
  let prevChange: number | null = null
  let prevRangeVar = 0
  let trendRun = 0
  const pts: Point[] = []
  let prevMid: number | null = null
  let overall: Status = haveBaseline ? 'usual-range' : 'building-baseline'
  checks.forEach((c, i) => {
    if (!isScored(c)) {
      const prevHeld = i > 0 && checks[i - 1].hearingLimited
      const note = c.hearingLimited
        ? prevHeld
          ? 'Held again: the sound check failed twice in a row. Not scored. The person is pointed to a hearing test.'
          : 'Held: the sound check failed, so this check was not scored. A missing score is never treated as a low score. If it happens again the person is pointed to a hearing test.'
        : 'Not scored. Nothing is assumed from a missing check; the next one is compared as usual.'
      results.push({ index: i, date: c.date, scored: false, mid: null, change: null, sd: null, z: null, pBelow: null, pairZ: null, slope: null, slopeSd: null, slopeZ: null, status: overall, note })
      return
    }
    nScored += 1
    const m = mid(c)
    const last = prevMid
    prevMid = m
    // Off days are kept and shown but left out of the trend, as they are left out of the flag.
    if (!c.offDay) pts.push({ x: i, y: m - expectedPractice(nScored, p), v: p.sem ** 2 + rangeVar(c) })
    if (!haveBaseline || baseIdx.includes(i)) {
      // Function overrides the number: a reported change in everyday tasks goes to a physician even before a baseline exists.
      const st: Status = c.functionChange ? 'review' : 'building-baseline'
      if (c.functionChange) overall = 'review'
      results.push({ index: i, date: c.date, scored: true, mid: m, change: null, sd: null, z: null, pBelow: null, pairZ: null, slope: null, slopeSd: null, slopeZ: null, status: st, note: c.functionChange ? 'The person reported that everyday tasks have become harder. That goes to the physician whatever the scores say.' : `Baseline check ${Math.min(nScored, 3)} of 3.` })
      return
    }
    const change = m - (expectedPractice(nScored, p) - basePractice) - (baseline as number)
    const sd = Math.sqrt(p.sem ** 2 + rangeVar(c) + baseVar)
    const z = change / sd
    const below = z <= p.flagZ
    // The last two scored checks, off days left out: their average against baseline, which shares one baseline error.
    const pz = prevChange === null ? null : ((prevChange + change) / 2) / Math.sqrt(p.sem ** 2 / 2 + (prevRangeVar + rangeVar(c)) / 4 + baseVar)
    const pairLow = p.pairMode === 'each' ? below && prevBelow : pz !== null && pz <= p.pairZ
    let status: Status = 'usual-range'
    let note = 'Within the usual range for this person.'
    if (c.offDay) {
      note = below ? 'Lower than usual on a day reported as an off day. Not counted towards a flag.' : note
      status = below ? 'watch' : 'usual-range'
    } else if (below && last !== null && (m - last) / (p.sem * Math.SQRT2) <= p.urgentZ) {
      status = 'urgent'
      note = 'A very large fall since the last check. The person is told to seek urgent assessment.'
    } else if (pairLow) {
      status = 'flag'
      note = p.pairMode === 'each'
        ? 'Lower than usual on two checks in a row. A packet goes to the ordering physician.'
        : 'Lower than usual across the last two checks together, by more than measurement error explains. A packet goes to the ordering physician.'
    } else if (below) {
      status = 'watch'
      note = 'Lower than usual once. One check is not enough; the next check decides.'
    }
    // Slow-decline route: the line through every scored check so far must fall reliably
    // (on trendRuns scored checks in a row) before it raises anything.
    const line = !c.offDay && pts.length >= p.trendMinChecks ? trendLine(pts) : null
    const trendBelow = line !== null && line.z <= p.trendZ
    const run = c.offDay ? trendRun : trendBelow ? trendRun + 1 : 0
    if (trendBelow && run >= p.trendRuns && status !== 'flag' && status !== 'urgent') {
      status = 'trend'
      note = `Falling slowly: about ${Math.abs(line.slope).toFixed(1)} points per check across all scored checks, more than measurement error explains. A packet goes to the ordering physician.`
    } else if (trendBelow && status === 'usual-range') {
      note = 'Within the usual range, but the line through all checks is falling. The next check decides whether it holds.'
    }
    if (c.functionChange && status !== 'flag' && status !== 'urgent') {
      note = status === 'trend'
        ? `${note} The person also reported that everyday tasks have become harder.`
        : 'The person reported that everyday tasks have become harder. That goes to the physician whatever the scores say.'
      if (status !== 'trend') status = 'review'
    }
    if (!c.offDay) { prevBelow = below; prevChange = change; prevRangeVar = rangeVar(c); trendRun = run }
    overall = status
    results.push({ index: i, date: c.date, scored: true, mid: m, change, sd, z, pBelow: phi(-z), pairZ: pz, slope: line?.slope ?? null, slopeSd: line?.sd ?? null, slopeZ: line?.z ?? null, status, note })
  })
  return { baseline, baselineChecks: baseIdx, results, status: overall }
}
