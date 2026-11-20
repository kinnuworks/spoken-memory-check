import { DEFAULT_PARAMS, PACKET_STATUSES, evaluate, type Check, type Status } from './change'
import { PERSONAS, type ScreeningRecord } from './histories'
import { libra } from './libra'
import { riskContext } from './packet'

// The rule's safety promises, checked on random histories. Each promise is something the site
// and the submission say the rule does; a random history that breaks one is a counterexample.
// The same code runs in the test suite, in scripts/safety-check.ts (a million histories) and in
// the browser on the Evidence page, against the rule the site itself uses.

export interface Promise_ { id: string; text: string }

export const PROMISES: Promise_[] = [
  { id: 'same', text: 'The same checks always give the same answer.' },
  { id: 'missing', text: 'A missed or held check is never scored as low: it never sends a new packet.' },
  { id: 'tasks', text: 'A "yes" to the everyday-tasks question always reaches a physician, scored or not.' },
  { id: 'offday', text: 'A check on a day reported as an off day is never sent on because of its score.' },
  { id: 'twochecks', text: 'The two-checks route never fires on one check: it needs an earlier scored check and their average at z of −2.6 or lower.' },
  { id: 'urgent', text: 'Urgent assessment only follows a very large fall from the previous check (about 20 points) to below the usual range.' },
  { id: 'baseline', text: 'Before three checks set the baseline, nothing is sent on scores; only a reported change in everyday tasks goes on.' },
  { id: 'higher', text: 'A higher score on a check never makes the answer at that check worse.' },
  { id: 'context', text: 'Risk context, family history and genome results never change the decision.' },
]

const SENT: readonly Status[] = [...PACKET_STATUSES, 'urgent']

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A random history: any length, missed and held checks, off days, wide ranges, slow falls and sudden crashes. */
export function randomHistory(r: () => number): Check[] {
  const n = 3 + Math.floor(r() * 12)
  const level = 5 + r() * 40
  const slope = r() < 0.5 ? 0 : -r() * 4
  const crashAt = r() < 0.15 ? 3 + Math.floor(r() * n) : -1
  const crash = 8 + r() * 25
  const out: Check[] = []
  for (let i = 0; i < n; i++) {
    const date = `c${i}`
    const fn = r() < 0.04 ? { functionChange: true } : {}
    const u = r()
    if (u < 0.05) { out.push({ date, low: null, high: null, ...fn }); continue }
    if (u < 0.08) { out.push({ date, low: null, high: null, hearingLimited: true, ...fn }); continue }
    const noise = (r() + r() + r() + r() - 2) * 6
    const v = Math.max(0, Math.round(level + slope * i - (crashAt >= 0 && i >= crashAt ? crash : 0) + noise))
    const w = r() < 0.6 ? 0 : Math.floor(r() * 7)
    out.push({ date, low: Math.max(0, v - w), high: v, ...(r() < 0.08 ? { offDay: true } : {}), ...fn })
  }
  return out
}

function randomRecord(r: () => number): ScreeningRecord {
  const base = PERSONAS[Math.floor(r() * PERSONAS.length)].record
  return {
    ...base,
    systolic: 100 + Math.round(r() * 80), bmi: 18 + Math.round(r() * 22), ldl: Math.round((1.5 + r() * 4) * 10) / 10,
    hba1c: Math.round((4.8 + r() * 5) * 10) / 10, phq9: Math.floor(r() * 27), smoker: r() < 0.3, activeMinutesWeek: Math.floor(r() * 400),
    apoeE4Copies: r() < 0.3 ? null : (Math.floor(r() * 3) as 0 | 1 | 2),
    sleep: r() < 0.2 ? undefined : { hoursPerNight: 3 + Math.floor(r() * 7), snoringOrPauses: r() < 0.3 },
  }
}

export interface Report {
  histories: number
  checks: number
  seed: number
  violations: Record<string, number>
  /** The first history that broke each promise, to reproduce it. */
  examples: Record<string, Check[]>
}

/** Checks every promise on n random histories. Calls onProgress every 1,000 histories when given. */
export function checkPromises(n: number, seed = 20261120, onProgress?: (done: number) => void): Report {
  const r = rng(seed)
  const violations: Record<string, number> = Object.fromEntries(PROMISES.map((p) => [p.id, 0]))
  const examples: Record<string, Check[]> = {}
  let checks = 0
  const fail = (id: string, h: Check[]) => { violations[id]++; if (!examples[id]) examples[id] = h }
  const pz = DEFAULT_PARAMS.pairZ, bigFall = DEFAULT_PARAMS.urgentZ * DEFAULT_PARAMS.sem * Math.SQRT2
  for (let k = 0; k < n; k++) {
    const h = randomHistory(r)
    checks += h.length
    const t = evaluate(h)
    if (JSON.stringify(evaluate(h.map((c) => ({ ...c })))) !== JSON.stringify(t)) fail('same', h)
    let scoredSoFar = 0
    let prevMid: number | null = null
    t.results.forEach((res, i) => {
      const c = h[i]
      if (!res.scored) {
        // A missed check may carry an earlier answer forward; it may never start a new one.
        if (SENT.includes(res.status) && !c.functionChange && !t.results.slice(0, i).some((x) => x.status === res.status)) fail('missing', h)
      } else scoredSoFar++
      if (c.functionChange && !SENT.includes(res.status)) fail('tasks', h)
      if (res.scored && c.offDay && (res.status === 'flag' || res.status === 'trend' || res.status === 'urgent')) fail('offday', h)
      if (res.scored && res.status === 'flag' && (res.pairZ === null || res.pairZ > pz)) fail('twochecks', h)
      if (res.scored && res.status === 'urgent' && !(prevMid !== null && (res.mid as number) - prevMid <= bigFall + 1e-9 && (res.z as number) <= DEFAULT_PARAMS.flagZ)) fail('urgent', h)
      if (scoredSoFar < 3 || (res.scored && t.baselineChecks.includes(i))) {
        if (res.status === 'flag' || res.status === 'trend' || res.status === 'urgent') fail('baseline', h)
        if (res.status === 'review' && !h.slice(0, i + 1).some((x) => x.functionChange)) fail('baseline', h)
      }
      if (res.scored) prevMid = res.mid
    })
    // Raise one later scored check and look at the answer at that same check.
    const later = t.results.filter((x) => x.scored && !h[x.index].offDay && !t.baselineChecks.includes(x.index)).map((x) => x.index)
    if (later.length) {
      const i = later[Math.floor(r() * later.length)]
      const up = 1 + Math.floor(r() * 10)
      const h2 = h.map((c, j) => (j === i ? { ...c, low: (c.low as number) + up, high: (c.high as number) + up } : c))
      const was = t.results[i].status, now = evaluate(h2).results[i].status
      if (SENT.includes(now) && !SENT.includes(was)) fail('higher', h)
    }
    // Context is computed from a random record and both consents; the decision must not move.
    const rec = randomRecord(r)
    riskContext(rec, { familyHistory: true, genome: true }, h)
    libra(rec)
    if (JSON.stringify(evaluate(h)) !== JSON.stringify(t)) fail('context', h)
    if (onProgress && (k + 1) % 1000 === 0) onProgress(k + 1)
  }
  return { histories: n, checks, seed, violations, examples }
}
