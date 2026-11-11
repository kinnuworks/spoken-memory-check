import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DEFAULT_PARAMS, evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import { REFERRAL_TARGET_WORKING_DAYS, addWorkingDays, riskFactors, treatableContributors, workingDaysBetween } from '../engine/packet'
import { bundle, checkObservation, referralRequest } from '../engine/fhir'
import TrajectoryChart from './TrajectoryChart'

type Decision = 'pending' | 'approved' | 'dismissed'

const INVITE = 'Your screening clinic would like to see you to talk about your memory checks. This is a routine follow-up visit. Please book an appointment with your physician.'

// A decision belongs to one case: switching case mounts a fresh packet.
export default function ClinicianRoute() {
  const { id } = useParams()
  return <Clinician key={id ?? 'first'} id={id} />
}

function Clinician({ id }: { id?: string }) {
  const candidates = PERSONAS.filter((p) => evaluate(p.checks).results.some((r) => r.status === 'flag' || r.status === 'review'))
  const person = candidates.find((p) => p.id === id) ?? candidates[0]
  const traj = evaluate(person.checks)
  const flag = traj.results.find((r) => r.status === 'flag' || r.status === 'review')!
  const byReport = flag.status === 'review'
  const base = traj.baseline as number
  const factors = riskFactors(person.record)
  const contributors = treatableContributors(person.record)
  const [decision, setDecision] = useState<Decision>('pending')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [referredOn, setReferredOn] = useState<string | null>(null)
  const [seenOn, setSeenOn] = useState<string | null>(null)
  const [invite, setInvite] = useState(INVITE)

  // Illustrative dates on working days: approval two working days after the flag, the visit five after that.
  const approvedOn = addWorkingDays(flag.date, 2)
  const visitOn = addWorkingDays(approvedOn, 5)
  const addDays = (iso: string, n: number) => addWorkingDays(iso, n)
  const used = referredOn ? workingDaysBetween(visitOn, seenOn ?? referredOn) : 0

  const trace = [
    { step: 'Consent on file (given at the screening visit, can be withdrawn)', ok: true },
    { step: 'Three scored checks set the baseline', ok: true, detail: `baseline ${base.toFixed(1)}` },
    byReport
      ? { step: 'Person reported that everyday tasks have become harder (this overrides the scores)', ok: true, detail: flag.date }
      : { step: 'Lower than usual on two scored checks in a row', ok: true, detail: `${flag.date}, z ${(flag.z as number).toFixed(2)}` },
    { step: byReport ? 'Scores themselves are within the usual range' : 'Neither low check was reported as an off day', ok: true },
    { step: 'Not a very large single drop (that goes to urgent assessment)', ok: true },
    { step: 'Physician decision', ok: decision !== 'pending', detail: decision === 'pending' ? 'held: waiting for you' : decision },
    { step: 'Result given in person at a visit', ok: decision === 'approved' && !!referredOn, detail: decision === 'approved' ? (referredOn ? `visit ${visitOn}` : 'held: visit not yet recorded') : 'held' },
    { step: 'Referral closed', ok: !!seenOn, detail: seenOn ? `seen ${seenOn}` : 'held' },
  ]

  return (
    <>
      <h1>Physician's packet</h1>
      <p><span className="tag syn">Synthetic patient; dates are illustrative</span> <span className="tag">Decision support. You decide.</span></p>
      <div className="row">
        {candidates.map((p) => <Link key={p.id} className="btn" style={{ padding: '6px 10px', fontSize: 15, fontWeight: p.id === person.id ? 700 : 400 }} to={`/clinician/${p.id}`}>{p.name}: {p.path}</Link>)}
      </div>
      <p><strong>{person.name}</strong>, {person.record.sex === 'F' ? 'female' : 'male'}. Clinic MoCA at the screening visit: {person.record.mocaAtVisit}. Home checks since {person.checks[0].date}.</p>

      <h2>1. What was observed</h2>
      <div className="card"><TrajectoryChart checks={person.checks} traj={traj} /></div>
      <p>Scores are totals from a spoken check at home. Each is a range from two speech recognisers.</p>

      <h2>2. What was calculated</h2>
      {byReport
        ? <p>Baseline {base.toFixed(1)} (mean of the first three checks). On {flag.date} the score was {(flag.mid as number).toFixed(1)}, within this person's usual range (z {(flag.z as number).toFixed(2)}). The packet was raised because the person said everyday tasks such as money, medicines or appointments have become harder. A reported change in daily life goes to you whatever the scores say.</p>
        : <p>Baseline {base.toFixed(1)} (mean of the first three checks). On {flag.date} the score was {(flag.mid as number).toFixed(1)}, which is {Math.abs(flag.change as number).toFixed(1)} points below baseline after the expected practice gain, {Math.abs(flag.z as number).toFixed(1)} times the measurement error. The check before it was also low.</p>}
      <div className="card">
        <p className="muted">The rule, in full. Fixed in code; no language model takes part.</p>
        <p><code>change = score − baseline − expected practice gain</code><br />
        <code>error = √( {DEFAULT_PARAMS.sem.toFixed(1)}² × (1 + 1/3) + range² / 12 )</code><br />
        <code>z = change ÷ error</code>; lower than usual when <code>z ≤ {DEFAULT_PARAMS.flagZ}</code>; flagged only on two scored checks in a row.</p>
        <p className="muted">{DEFAULT_PARAMS.sem.toFixed(1)} points is how much one check varies within a person, taken from published retest studies of similar tasks and not yet from this check. "Range" is the gap between what both listeners heard and what either heard. A score in the usual range does not rule out impairment, and this is a change from the person's own baseline, not a diagnosis.</p>
      </div>

      <h2>3. Treatable contributors to check first</h2>
      <div className="scroll"><table>
        <thead><tr><th>Check</th><th>Why for this person</th><th>Suggested action</th></tr></thead>
        <tbody>{contributors.map((c) => <tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.why}</td><td>{c.action}</td></tr>)}</tbody>
      </table></div>

      <h2>4. Risk factors already in the screening record</h2>
      <p className="muted">Ten of the fourteen modifiable risk factors in the 2024 Lancet Commission report have a matching field in the screening record. Four do not.</p>
      <div className="scroll"><table>
        <thead><tr><th>Factor</th><th>Screening field</th><th>Value</th><th></th></tr></thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.name}>
              <td>{f.name}</td><td>{f.field ?? <span className="muted">no matching field</span>}</td><td>{f.value ?? ''}</td>
              <td>{f.field ? (f.present ? <strong className="status-watch">present</strong> : 'not present') : ''}{f.note ? <><br /><span className="muted">{f.note}</span></> : null}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <h2>5. Your decision</h2>
      {decision === 'pending' && (
        <>
          <p>Until you decide, the person sees only "Check received". If you approve, the app sends the invitation below and nothing else. You give the result in person.</p>
          <div className="card"><p className="muted">Invitation wording. The template is offered to the public health centre for approval; you may edit it for this person before sending.</p><textarea value={invite} onChange={(e) => setInvite(e.target.value)} style={{ minHeight: 80 }} /></div>
          <p><label>Your note for the record (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label></p>
          <div className="stack">
            <button className="primary" onClick={() => setDecision('approved')}>Approve and invite the person to a visit</button>
            <p><label>Reason for dismissing<textarea style={{ minHeight: 60 }} value={reason} onChange={(e) => setReason(e.target.value)} /></label></p>
            <button disabled={!reason.trim()} onClick={() => setDecision('dismissed')}>Dismiss with this reason</button>
          </div>
        </>
      )}
      {decision === 'dismissed' && <div className="note">Dismissed. Reason recorded: "{reason}". Home checks continue and the person is not contacted.</div>}
      {decision === 'approved' && (
        <>
          <div className="note">Approved on {approvedOn}{invite !== INVITE ? ' with edited wording' : ''}. The person received this invitation and nothing else: "{invite}"</div>
          <h2>6. Follow-up clock</h2>
          <p>Target: referral to a neurologist or geriatrician completed within {REFERRAL_TARGET_WORKING_DAYS} working days of the visit. The number is borrowed from the screening programme's own referral indicator.</p>
          <div className="stack">
            {!referredOn && <button className="primary" onClick={() => setReferredOn(visitOn)}>Record: result given in person on {visitOn}, referral made the same day</button>}
            {referredOn && !seenOn && <button className="primary" onClick={() => setSeenOn(addWorkingDays(visitOn, 12))}>Record: specialist appointment attended</button>}
          </div>
          {referredOn && (
            <div className="card">
              <p><strong>{seenOn ? 'Closed' : 'Open'}</strong>: {used} of {REFERRAL_TARGET_WORKING_DAYS} working days used{seenOn ? '' : ' so far'}.</p>
              <p className="muted">Visit {visitOn}. Referral made {referredOn}.{seenOn ? ` Seen ${seenOn}.` : ' Waiting for the appointment.'} Owner: the ordering physician at the screening provider.</p>
            </div>
          )}
        </>
      )}

      <h2>Hand-off to other systems</h2>
      <p className="muted">The checks and the referral as FHIR R4 resources, for an exchange or a record system to take in.</p>
      <button className="small" onClick={() => {
        const res = [...person.checks.map((c) => checkObservation(`Patient/synthetic-${person.id}`, c)), ...(referredOn ? [referralRequest(`Patient/synthetic-${person.id}`, 'Practitioner/ordering', referredOn, addDays(visitOn, 21))] : [])]
        const url = URL.createObjectURL(new Blob([JSON.stringify(bundle(res), null, 2)], { type: 'application/fhir+json' }))
        Object.assign(document.createElement('a'), { href: url, download: `synthetic-${person.id}.fhir.json` }).click()
        URL.revokeObjectURL(url)
      }}>Download FHIR bundle (synthetic)</button>

      <h2>Step trace</h2>
      <ol className="trace">{trace.map((t) => <li key={t.step}><strong className={t.ok ? 'status-usual-range' : 'status-watch'}>{t.ok ? 'Passed' : 'Held'}</strong>: {t.step}{t.detail ? ` (${t.detail})` : ''}</li>)}</ol>
      <div className="stack"><Link className="btn" to={`/year/${person.id}`}>Back to the year of checks</Link></div>
    </>
  )
}
