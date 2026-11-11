import { Link } from 'react-router-dom'
import { cell, simulateProgramme } from '../engine/programme'

export default function Programme() {
  const rows = simulateProgramme()
  const total = rows.reduce((t, r) => {
    const out = { ...t }
    for (const k of Object.keys(r) as (keyof typeof r)[]) if (k !== 'facility') (out[k] as number) = ((t[k] as number) ?? 0) + (r[k] as number)
    return out
  }, { facility: 'All facilities' } as ReturnType<typeof simulateProgramme>[number])
  const all = [...rows, total]
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')
  return (
    <>
      <h1>Programme view</h1>
      <p><span className="tag syn">Simulated programme year, not real data</span></p>
      <p>For the public health centre: where every enrolled member is, so nobody is lost between the home check and the specialist. Counts under five are shown as "&lt;5" so no one can be identified.</p>
      <div className="scroll"><table>
        <thead><tr><th>Facility</th><th>Enrolled</th><th>Baseline done</th><th>Held for hearing</th><th>Packets</th><th>Approved</th><th>Dismissed with reason</th><th>Seen within 15 working days</th><th>Seen later</th><th>Still open</th><th>Lost to follow-up</th><th>Urgent route</th></tr></thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.facility} style={r.facility === 'All facilities' ? { fontWeight: 700 } : undefined}>
              <td>{r.facility}</td><td>{cell(r.enrolled)}</td><td>{cell(r.baselineDone)} ({pct(r.baselineDone, r.enrolled)})</td><td>{cell(r.held)}</td><td>{cell(r.packets)}</td><td>{cell(r.approved)}</td><td>{cell(r.dismissed)}</td><td>{cell(r.seenInTarget)}</td><td>{cell(r.seenLate)}</td><td>{cell(r.open)}</td><td>{cell(r.lost)}</td><td>{cell(r.urgent)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <h2>What the centre would watch</h2>
      <ul>
        <li><strong>Baseline completion</strong>: {pct(total.baselineDone, total.enrolled)} of enrolled members finished three checks in this simulation. Published remote studies range from about a third to three quarters; reminders matter.</li>
        <li><strong>Lost to follow-up</strong>: approved packets with no specialist visit. Each one is a named case the facility chases.</li>
        <li><strong>Time to assessment</strong>: the share seen within the 15-working-day target, borrowed from the programme's own referral indicator.</li>
        <li><strong>Held for hearing</strong>: members whose sound check failed; they are pointed to a hearing assessment, not scored as low.</li>
      </ul>
      <p className="muted">Simulated: who keeps checking, who declines, the share of packets dismissed, and visit timings are settings, not observations. The real version reads these from the check records and the referral clock already in the physician's view.</p>
      <div className="stack"><Link className="btn" to="/how">How it works, and what is real</Link></div>
    </>
  )
}
