import { Link } from 'react-router-dom'
import { cell, simulateProgramme } from '../engine/programme'
import { HEARING_SETTINGS, hearingPathway, lostSignals } from '../engine/signals'

export default function Programme() {
  const rows = simulateProgramme()
  const hearing = hearingPathway(rows.reduce((n, r) => n + r.enrolled, 0))
  const audit = lostSignals(rows.reduce((n, r) => n + r.enrolled, 0))
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
      <p>For the public health centre: where every enrolled member is, so nobody is lost between the screening visit, the home check and the specialist. Counts under five are shown as "&lt;5" so no one can be identified.</p>

      <h2>Lost signals</h2>
      <p>Every abnormal brain-relevant result from the screening visit with no recorded action by its target date. This is the first thing a programme manager should look at: each row is a list of named people the facility can call.</p>
      <div className="lost-hero card">
        <p className="big">{audit.peopleWithAnyPer1000} <span className="big-unit">per 1,000 members</span></p>
        <p className="muted">have at least one abnormal result with no recorded action ({cell(audit.peopleWithAny)} of {audit.members.toLocaleString()} in this simulated year).</p>
      </div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Lost signals by signal"><table>
        <thead><tr><th>Signal</th><th>Abnormal when</th><th>Expected action</th><th>Target</th><th>Abnormal</th><th>Acted in time</th><th>Late</th><th>No action</th><th>No action per 1,000</th></tr></thead>
        <tbody>
          {audit.rows.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.signal}</strong></td><td>{s.abnormal}</td><td>{s.action}</td><td>{s.targetDays} days</td><td>{cell(s.flagged)}</td><td>{cell(s.inTime)}</td><td>{cell(s.late)}</td><td><strong className="status-flag">{cell(s.noAction)}</strong></td><td>{s.noActionPer1000}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="muted">Simulated. How often each result is abnormal and how often it is acted on are settings chosen for this demonstration, not figures from the programme. In use, the audit reads the screening record and the referral log; the rules and targets are offered to the public health centre to set.</p>

      <h2>Hearing, from check to an aid that is worn</h2>
      <p>Hearing loss is one of the two largest changeable risk factors for dementia in the 2024 Lancet Commission report. Most hearing care fails after the fitting, so the count that matters is the last one.</p>
      <div className="funnel">
        {hearing.map((h, i) => (
          <div key={h.step} className="funnel__row">
            <span>{h.step}</span>
            <div className="funnel__bar"><i style={{ width: `${(h.count / hearing[0].count) * 100}%` }} /></div>
            <strong>{cell(h.count)}</strong>
            {i > 0 && <em>{pct(h.count, hearing[i - 1].count)}</em>}
          </div>
        ))}
      </div>
      <p className="muted">Simulated. Settings: {Math.round(HEARING_SETTINGS.checked * 100)}% do the check, {Math.round(HEARING_SETTINGS.refer * 100)}% are referred, {Math.round(HEARING_SETTINGS.seen * 100)}% of those are seen, {Math.round(HEARING_SETTINGS.fitted * 100)}% of those fitted, {Math.round(HEARING_SETTINGS.wearing * 100)}% of those still wearing at three months. In use, the last step comes from the weekly one-tap question in the <Link to="/hearing">hearing check</Link>.</p>

      <h2>Home checks and referrals, by facility</h2>
      <div className="scroll" tabIndex={0} role="region" aria-label="Home checks and referrals, by facility"><table>
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
