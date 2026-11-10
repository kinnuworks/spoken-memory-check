import { DEFAULT_PARAMS, evaluate, expectedPractice, type Check, type RuleParams } from './change'

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

export const BASE_WORLD: World = { sem: 3.5, practiceGain: 1.5, miss: 0, slope: 0, betweenSd: 6, checks: 11, declineFrom: 4 }
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

export type RuleName = 'ours' | 'single-low' | 'fixed-cutoff'

/** Index of the first check at which the rule raises a flag, or -1. */
export function firstFlag(rule: RuleName, checks: Check[], p: RuleParams = DEFAULT_PARAMS): number {
  if (rule === 'ours') return evaluate(checks, p).results.findIndex((x) => x.status === 'flag' || x.status === 'urgent')
  if (rule === 'single-low') return evaluate(checks, p).results.findIndex((x) => x.z !== null && x.z <= p.flagZ)
  // One cutoff for everyone: the 5th percentile of a first-ever score in this simulated population.
  const cut = POP_MEAN - 1.645 * Math.sqrt(BASE_WORLD.betweenSd ** 2 + p.sem ** 2)
  return checks.findIndex((c, i) => i >= 3 && ((c.low as number) + (c.high as number)) / 2 - expectedPractice(i + 1, p) < cut)
}

export interface Row { world: string; rule: RuleName; falseAlarmYear: number; detected: Record<string, number>; medianChecksToFlag: Record<string, number | null> }

export function runBenchmark(n: number, seed = 20261110): { n: number; rows: Row[] } {
  const worlds: { name: string; w: Partial<World> }[] = [
    { name: 'As assumed', w: {} },
    { name: 'Each recogniser misses 8% of words', w: { miss: 0.08 } },
    { name: 'Each recogniser misses 15% of words', w: { miss: 0.15 } },
    { name: 'True measurement error larger (4.5, rule assumes 3.5)', w: { sem: 4.5 } },
    { name: 'True practice gain larger (3.0, rule assumes 1.5)', w: { practiceGain: 3 } },
    { name: 'No practice gain at all (rule assumes 1.5)', w: { practiceGain: 0 } },
  ]
  const slopes = [1, 2, 3]
  const rows: Row[] = []
  for (const { name, w } of worlds) {
    for (const rule of ['ours', 'single-low', 'fixed-cutoff'] as RuleName[]) {
      const r = rng(seed)
      let fa = 0
      for (let i = 0; i < n; i++) if (firstFlag(rule, simulatePerson({ ...BASE_WORLD, ...w, slope: 0 }, r)) >= 0) fa++
      const detected: Record<string, number> = {}
      const median: Record<string, number | null> = {}
      for (const s of slopes) {
        const world = { ...BASE_WORLD, ...w, slope: s }
        const delays: number[] = []
        for (let i = 0; i < n; i++) {
          const f = firstFlag(rule, simulatePerson(world, r))
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
  return { n, rows }
}
