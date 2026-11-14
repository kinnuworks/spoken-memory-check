import { DEFAULT_PARAMS, TWO_IN_A_ROW_ONLY, evaluate, expectedPractice, type Check, type RuleParams } from './change'

// Simulated people for testing the flag. Nothing here is patient data. Every setting is
// stated so a reader can disagree with it and rerun.

export interface World {
  /** True within-person SD of one check. */
  sem: number
  /** True total practice gain. */
  practiceGain: number
  /** Chance one recogniser misses a word the person did say. */
  miss: number
  /** Points lost per check once decline starts (0 for a stable person). */
  slope: number
  /** SD of true scores between people, used only by the fixed-cutoff rule. */
  betweenSd: number
  checks: number
  declineFrom: number
}

export const BASE_WORLD: World = { sem: 4.0, practiceGain: 1.0, miss: 0, slope: 0, betweenSd: 6, checks: 11, declineFrom: 4 }
const POP_MEAN = 33

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
function binomial(n: number, p: number, r: () => number) { let k = 0; for (let i = 0; i < n; i++) if (r() < p) k++; return k }

export function simulatePerson(w: World, r: () => number): Check[] {
  const mu = POP_MEAN + normal(r) * w.betweenSd
  const out: Check[] = []
  for (let i = 0; i < w.checks; i++) {
    const gain = w.practiceGain * (1 - Math.exp(-i / DEFAULT_PARAMS.practiceTau))
    const drop = i >= w.declineFrom ? w.slope * (i - w.declineFrom + 1) : 0
    const said = Math.max(0, Math.round(mu + gain - drop + normal(r) * w.sem))
    // Each recogniser misses words independently: both heard, then heard by at least one.
    const both = binomial(said, (1 - w.miss) ** 2, r)
    const onlyOne = binomial(said - both, (2 * w.miss * (1 - w.miss)) / Math.max(1e-9, 1 - (1 - w.miss) ** 2), r)
    out.push({ date: `c${i}`, low: both, high: both + (w.miss > 0 ? onlyOne : 0) })
  }
  return out
}

/** 'ours' is the rule of record (both routes); 'two-in-a-row' is the rule before the trend route was added. */
export type RuleName = 'ours' | 'two-in-a-row' | 'single-low' | 'fixed-cutoff'
export const RULES: RuleName[] = ['ours', 'two-in-a-row', 'single-low', 'fixed-cutoff']

const RAISED = new Set(['flag', 'trend', 'urgent'])

/** Index of the first check at which the rule raises a flag, or -1. */
export function firstFlag(rule: RuleName, checks: Check[], p: RuleParams = DEFAULT_PARAMS): number {
  if (rule === 'ours') return evaluate(checks, p).results.findIndex((x) => RAISED.has(x.status))
  if (rule === 'two-in-a-row') return evaluate(checks, { ...p, trendZ: TWO_IN_A_ROW_ONLY.trendZ }).results.findIndex((x) => RAISED.has(x.status))
  if (rule === 'single-low') return evaluate(checks, p).results.findIndex((x) => x.z !== null && x.z <= p.flagZ)
  // One cutoff for everyone: the 5th percentile of a first-ever score in this simulated population.
  const cut = POP_MEAN - 1.645 * Math.sqrt(BASE_WORLD.betweenSd ** 2 + p.sem ** 2)
  return checks.findIndex((c, i) => i >= 3 && ((c.low as number) + (c.high as number)) / 2 - expectedPractice(i + 1, p) < cut)
}

export interface Row { world: string; rule: RuleName; falseAlarmYear: number; detected: Record<string, number>; medianChecksToFlag: Record<string, number | null> }

/** Seed behind every reported number. Thresholds were chosen on TUNING_SEED, never on this one. */
export const REPORT_SEED = 20261110
export const TUNING_SEED = 1

export function runBenchmark(n: number, seed = REPORT_SEED, rules: RuleName[] = RULES, p: RuleParams = DEFAULT_PARAMS): { n: number; seed: number; rows: Row[] } {
  const worlds: { name: string; w: Partial<World> }[] = [
    { name: 'As assumed', w: {} },
    { name: 'Each recogniser misses 8% of words', w: { miss: 0.08 } },
    { name: 'Each recogniser misses 15% of words', w: { miss: 0.15 } },
    { name: 'True measurement error at the upper bound (4.5, rule assumes 4.0)', w: { sem: 4.5 } },
    { name: 'True measurement error at the lower bound (3.5, rule assumes 4.0)', w: { sem: 3.5 } },
    { name: 'True practice gain larger (3.0, rule assumes 1.0)', w: { practiceGain: 3 } },
    { name: 'No practice gain at all (rule assumes 1.0)', w: { practiceGain: 0 } },
  ]
  const slopes = [1, 2, 3]
  const rows: Row[] = []
  for (const { name, w } of worlds) {
    for (const rule of rules) {
      const r = rng(seed)
      let fa = 0
      for (let i = 0; i < n; i++) if (firstFlag(rule, simulatePerson({ ...BASE_WORLD, ...w, slope: 0 }, r), p) >= 0) fa++
      const detected: Record<string, number> = {}
      const median: Record<string, number | null> = {}
      for (const s of slopes) {
        const world = { ...BASE_WORLD, ...w, slope: s }
        const delays: number[] = []
        for (let i = 0; i < n; i++) {
          const f = firstFlag(rule, simulatePerson(world, r), p)
          // A flag before decline starts is a false alarm, not a detection.
          if (f >= world.declineFrom) delays.push(f - world.declineFrom + 1)
        }
        delays.sort((a, b) => a - b)
        detected[String(s)] = delays.length / n
        median[String(s)] = delays.length ? delays[Math.floor(delays.length / 2)] : null
      }
      rows.push({ world: name, rule, falseAlarmYear: fa / n, detected, medianChecksToFlag: median })
    }
  }
  return { n, seed, rows }
}

/** Wilson score interval for a proportion, 95%. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1]
  const z = 1.96, p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}

export interface Burden {
  /** Share of enrolled members assumed to be in real decline during the year. ASSUMPTION, shown on screen. */
  prevalence: number
  members: number
  tp: number; fn: number; fp: number; tn: number
  sensitivity: number; sensitivityCi: [number, number]
  specificity: number; specificityCi: [number, number]
  packetsPer1000: number
  realPer1000: number
}

/**
 * A year for a simulated programme: some members in real decline (two points a check),
 * the rest stable. Counts packets sent and how many of them are real. Everything here is
 * simulated, and the share in decline is an assumption the page states.
 */
export function programmeYear(members: number, prevalence: number, seed = 20261111, slope = 2, rule: RuleName = 'ours'): Burden {
  const r = rng(seed)
  let tp = 0, fn = 0, fp = 0, tn = 0
  for (let i = 0; i < members; i++) {
    const declining = r() < prevalence
    const w = { ...BASE_WORLD, slope: declining ? slope : 0 }
    const f = firstFlag(rule, simulatePerson(w, r))
    if (declining) { if (f >= w.declineFrom) tp++; else fn++ }
    else { if (f >= 0) fp++; else tn++ }
  }
  const pos = tp + fn, neg = fp + tn
  return {
    prevalence, members, tp, fn, fp, tn,
    sensitivity: pos ? tp / pos : 0, sensitivityCi: wilson(tp, pos),
    specificity: neg ? tn / neg : 0, specificityCi: wilson(tn, neg),
    packetsPer1000: ((tp + fp) / members) * 1000,
    realPer1000: (tp / members) * 1000,
  }
}
