import type { Check, Trajectory } from '../engine/change'
import { DEFAULT_PARAMS } from '../engine/change'

// Colours come from the theme's chart tokens, so the chart follows the page's palette.
const COLOUR: Record<string, string> = { 'building-baseline': 'var(--chart-muted)', 'usual-range': 'var(--chart-ok)', watch: 'var(--chart-watch)', review: 'var(--chart-flag)', flag: 'var(--chart-flag)', trend: 'var(--chart-flag)', urgent: 'var(--chart-flag)' }
const CALM = 'var(--chart-calm)'
const TEXT = 'var(--chart-text)'
const STATUS_WORDS: Record<string, string> = { 'building-baseline': 'building a baseline', 'usual-range': 'in the usual range', watch: 'watch', review: 'review', flag: 'flagged', trend: 'slowly falling', urgent: 'urgent' }

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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`

export default function TrajectoryChart({ checks, traj, plain = false, compact = false, textSize }: { checks: Check[]; traj: Trajectory; plain?: boolean; compact?: boolean; textSize?: number }) {
  // Compact charts are drawn smaller, so their labels are larger in chart units to stay readable.
  const fs = textSize ?? (compact ? 19 : 13)
  const colour = (status: string) => (plain ? CALM : COLOUR[status])
  const W = 720, H = compact ? 230 : 260, L = 20 + fs * 1.6, R = 12, T = 14, B = 18 + fs * 1.3
  const vals = checks.flatMap((c) => (c.low === null ? [] : [c.low, c.high as number]))
  const lo = Math.min(...vals, (traj.baseline ?? 30) - 8) - 2, hi = Math.max(...vals, (traj.baseline ?? 30) + 8) + 2
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, checks.length - 1)
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo)
  // Band of normal variation around the baseline: where a single check does not count as low.
  const band = traj.baseline === null ? null : Math.abs(DEFAULT_PARAMS.flagZ) * DEFAULT_PARAMS.sem * Math.sqrt(4 / 3)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary(checks, traj, plain)} style={{ fontFamily: 'inherit' }}>
      {[lo + 2, (lo + hi) / 2, hi - 2].map((v) => <line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--chart-grid)' }} />)}
      {band !== null && !plain && <rect x={L} y={y((traj.baseline as number) + band)} width={W - L - R} height={y((traj.baseline as number) - band) - y((traj.baseline as number) + band)} rx="6" style={{ fill: 'var(--chart-ok)' }} opacity="0.07" />}
      {traj.baseline !== null && <line x1={L} x2={W - R} y1={y(traj.baseline)} y2={y(traj.baseline)} style={{ stroke: plain ? 'var(--chart-base-plain)' : 'var(--chart-ok)' }} strokeDasharray="5 5" strokeWidth="1.5" />}
      {[lo + 2, (lo + hi) / 2, hi - 2].map((v) => (
        <text key={v} x={L - 8} y={y(v) + fs / 3} fontSize={fs} textAnchor="end" style={{ fill: TEXT }}>{Math.round(v)}</text>
      ))}
      {checks.map((c, i) => {
        const r = traj.results[i]
        if (c.low === null) return <text key={i} x={x(i)} y={H - B + 2} fontSize={fs} textAnchor="middle" style={{ fill: TEXT }}>–</text>
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.low)} y2={y(c.high as number)} style={{ stroke: colour(r.status) }} strokeWidth="8" strokeLinecap="round" opacity="0.22" />
            <circle cx={x(i)} cy={y(r.mid as number)} r={c.offDay ? 4.5 : 6.5} style={{ fill: c.offDay ? 'var(--chart-hole)' : colour(r.status), stroke: colour(r.status) }} strokeWidth="2" />
          </g>
        )
      })}
      {checks.map((c, i) => (i % (compact ? 3 : 2) === 0 ? <text key={i} x={x(i)} y={H - 6} fontSize={fs} textAnchor="middle" style={{ fill: TEXT }}>{shortDate(c.date)}</text> : null))}
    </svg>
  )
}
