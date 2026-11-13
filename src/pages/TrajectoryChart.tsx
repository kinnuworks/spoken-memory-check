import type { Check, Trajectory } from '../engine/change'
import { DEFAULT_PARAMS } from '../engine/change'

const COLOUR: Record<string, string> = { 'building-baseline': '#857B6E', 'usual-range': '#1F7A3D', watch: '#9A6200', review: '#A1411F', flag: '#A1411F', urgent: '#A1411F' }
const CALM = '#6D6459'
const TEXT = '#6D6459'
const STATUS_WORDS: Record<string, string> = { 'building-baseline': 'building a baseline', 'usual-range': 'in the usual range', watch: 'watch', review: 'review', flag: 'flagged', urgent: 'urgent' }

/** Text summary of the chart for screen readers. The plain view leaves out scores and status, as the picture does. */
function summary(checks: Check[], traj: Trajectory, plain: boolean) {
  if (checks.length === 0) return 'No checks yet.'
  const scored = traj.results.filter((r) => r.mid !== null)
  const unscored = checks.length - scored.length
  const parts = [`Chart of ${checks.length} checks from ${checks[0].date} to ${checks[checks.length - 1].date}, ${scored.length} scored${unscored ? `, ${unscored} not scored` : ''}.`]
  if (plain) return parts.join(' ')
  if (traj.baseline !== null) parts.push(`Personal baseline ${traj.baseline.toFixed(1)}.`)
  const last = scored[scored.length - 1]
  if (last && last.mid !== null) parts.push(`Latest score ${last.mid.toFixed(1)} on ${last.date}, ${STATUS_WORDS[last.status] ?? last.status}.`)
  if (scored.length) parts.push(`Scores ranged from ${Math.min(...scored.map((r) => r.mid as number)).toFixed(1)} to ${Math.max(...scored.map((r) => r.mid as number)).toFixed(1)}.`)
  return parts.join(' ')
}

/** `plain` is the person's own view: one calm colour, so the chart never signals a result. */
export default function TrajectoryChart({ checks, traj, plain = false, compact = false }: { checks: Check[]; traj: Trajectory; plain?: boolean; compact?: boolean }) {
  const colour = (status: string) => (plain ? CALM : COLOUR[status])
  const W = 720, H = compact ? 220 : 260, L = 40, R = 12, T = 14, B = 34
  const vals = checks.flatMap((c) => (c.low === null ? [] : [c.low, c.high as number]))
  const lo = Math.min(...vals, (traj.baseline ?? 30) - 8) - 2, hi = Math.max(...vals, (traj.baseline ?? 30) + 8) + 2
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, checks.length - 1)
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo)
  // Band of normal variation around the baseline: where a single check does not count as low.
  const band = traj.baseline === null ? null : Math.abs(DEFAULT_PARAMS.flagZ) * DEFAULT_PARAMS.sem * Math.sqrt(4 / 3)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary(checks, traj, plain)} style={{ fontFamily: 'inherit' }}>
      {[lo + 2, (lo + hi) / 2, hi - 2].map((v) => <line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EBE3D7" />)}
      {band !== null && !plain && <rect x={L} y={y((traj.baseline as number) + band)} width={W - L - R} height={y((traj.baseline as number) - band) - y((traj.baseline as number) + band)} rx="6" fill="#1F7A3D" opacity="0.07" />}
      {traj.baseline !== null && <line x1={L} x2={W - R} y1={y(traj.baseline)} y2={y(traj.baseline)} stroke={plain ? '#C9BEAE' : '#1F7A3D'} strokeDasharray="5 5" strokeWidth="1.5" />}
      {[lo + 2, (lo + hi) / 2, hi - 2].map((v) => (
        <text key={v} x={L - 8} y={y(v) + 4} fontSize="12" textAnchor="end" fill={TEXT}>{Math.round(v)}</text>
      ))}
      {checks.map((c, i) => {
        const r = traj.results[i]
        if (c.low === null) return <text key={i} x={x(i)} y={H - B + 2} fontSize="13" textAnchor="middle" fill={TEXT}>–</text>
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.low)} y2={y(c.high as number)} stroke={colour(r.status)} strokeWidth="8" strokeLinecap="round" opacity="0.22" />
            <circle cx={x(i)} cy={y(r.mid as number)} r={c.offDay ? 4.5 : 6.5} fill={c.offDay ? '#FFFEFC' : colour(r.status)} stroke={colour(r.status)} strokeWidth="2" />
          </g>
        )
      })}
      {checks.map((c, i) => (i % 2 === 0 ? <text key={i} x={x(i)} y={H - 8} fontSize="11.5" textAnchor="middle" fill={TEXT}>{c.date.slice(5)}</text> : null))}
    </svg>
  )
}
