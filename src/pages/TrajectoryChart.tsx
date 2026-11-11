import type { Check, Trajectory } from '../engine/change'
import { DEFAULT_PARAMS } from '../engine/change'

const COLOUR: Record<string, string> = { 'building-baseline': '#5b5b5b', 'usual-range': '#1f6f43', watch: '#9a6200', flag: '#a12a2a', urgent: '#a12a2a' }

/** `plain` is the person's own view: one calm colour, so the chart never signals a result. */
export default function TrajectoryChart({ checks, traj, plain = false }: { checks: Check[]; traj: Trajectory; plain?: boolean }) {
  const colour = (status: string) => (plain ? '#1d4f91' : COLOUR[status])
  const W = 720, H = 260, L = 40, R = 12, T = 12, B = 34
  const vals = checks.flatMap((c) => (c.low === null ? [] : [c.low, c.high as number]))
  const lo = Math.min(...vals, (traj.baseline ?? 30) - 8) - 2, hi = Math.max(...vals, (traj.baseline ?? 30) + 8) + 2
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, checks.length - 1)
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo)
  // Band of normal variation around the baseline: where a single check does not count as low.
  const band = traj.baseline === null ? null : Math.abs(DEFAULT_PARAMS.flagZ) * DEFAULT_PARAMS.sem * Math.sqrt(4 / 3)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Check scores over time against the personal baseline">
      {band !== null && !plain && <rect x={L} y={y((traj.baseline as number) + band)} width={W - L - R} height={y((traj.baseline as number) - band) - y((traj.baseline as number) + band)} fill="#eef3ee" />}
      {traj.baseline !== null && <line x1={L} x2={W - R} y1={y(traj.baseline)} y2={y(traj.baseline)} stroke="#1f6f43" strokeDasharray="5 4" />}
      {[lo + 2, (lo + hi) / 2, hi - 2].map((v) => (
        <text key={v} x={L - 6} y={y(v) + 4} fontSize="12" textAnchor="end" fill="#5b5b5b">{Math.round(v)}</text>
      ))}
      {checks.map((c, i) => {
        const r = traj.results[i]
        if (c.low === null) return <text key={i} x={x(i)} y={H - B + 2} fontSize="12" textAnchor="middle" fill="#5b5b5b">–</text>
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.low)} y2={y(c.high as number)} stroke={colour(r.status)} strokeWidth="6" strokeLinecap="round" opacity="0.35" />
            <circle cx={x(i)} cy={y(r.mid as number)} r={c.offDay ? 4 : 6} fill={c.offDay ? '#fff' : colour(r.status)} stroke={colour(r.status)} strokeWidth="2" />
          </g>
        )
      })}
      {checks.map((c, i) => (i % 2 === 0 ? <text key={i} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="#5b5b5b">{c.date.slice(5)}</text> : null))}
    </svg>
  )
}
