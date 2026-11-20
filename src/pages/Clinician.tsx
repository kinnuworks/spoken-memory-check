import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DEFAULT_PARAMS, PACKET_STATUSES, TREND_PACKET_NOTE, evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import { REFERRAL_TARGET_WORKING_DAYS, addWorkingDays, contextRows, riskContext, riskFactors, treatableContributors, workingDaysBetween } from '../engine/packet'
import { apoeObservation, bundle, checkObservation, familyHistory, libraAssessment, referralRequest, SPECIALTY, type Specialty } from '../engine/fhir'
import { LIBRA_RANGE, libra } from '../engine/libra'
import { refMessage } from '../engine/hl7'
import { INVITE, appendAudit, loadAudit } from '../engine/audit'
import TrajectoryChart from './TrajectoryChart'

type Decision = 'pending' | 'approved' | 'dismissed'


// A decision belongs to one case: switching case mounts a fresh packet.
export default function ClinicianRoute() {
  const { id } = useParams()
  return <Clinician key={id ?? 'first'} id={id} />
}

function Clinician({ id }: { id?: string }) {
  const candidates = PERSONAS.filter((p) => evaluate(p.checks).results.some((r) => PACKET_STATUSES.includes(r.status)))
  const person = candidates.find((p) => p.id === id) ?? candidates[0]
  const traj = evaluate(person.checks)
  const flag = traj.results.find((r) => PACKET_STATUSES.includes(r.status))!
  const byReport = flag.status === 'review'
  const base = traj.baseline as number
  // For the slow-decline route: how far the last two checks together fell, to show why the two-checks route had not fired yet.
  const prevScored = traj.results.filter((r) => r.index < flag.index && r.change !== null && !person.checks[r.index].offDay).pop()
  const pairShort = flag.status === 'trend' && flag.pairZ !== null && prevScored ? -((flag.change as number) + (prevScored.change as number)) / 2 : null
  const factors = riskFactors(person.record)
  const contributors = treatableContributors(person.record)
  const context = contextRows(person.record, person.shared)
  const lib = libra(person.record)
  const areas = riskContext(person.record, person.shared, person.checks)
  const concernAreas = areas.filter((a) => a.concern).map((a) => a.area.toLowerCase())
  const finding = byReport ? 'a reported change in everyday tasks, with scores in the usual range' : flag.status === 'trend' ? 'a line through all the checks falling further than measurement error explains' : 'a lasting fall from this person\'s own baseline across two checks'
  const [decision, setDecision] = useState<Decision>('pending')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [referredOn, setReferredOn] = useState<string | null>(null)
  const [seenOn, setSeenOn] = useState<string | null>(null)
  const [invite, setInvite] = useState(INVITE)
  const [specialty, setSpecialty] = useState<Specialty>('neurology')
  const [log, setLog] = useState(() => loadAudit().filter((a) => a.case === person.id))
  const record = (action: Parameters<typeof appendAudit>[0]['action'], detail?: string) => setLog(appendAudit({ case: person.id, action, detail }).filter((a) => a.case === person.id))

  // Real dates: approval is the day the button is pressed; the visit and the specialist
  // appointment are the dates the physician enters. The clock counts working days between them.
  const today = new Date().toISOString().slice(0, 10)
  const [approvedOn, setApprovedOn] = useState(today)
  const [visitDate, setVisitDate] = useState(today)
  const [seenDate, setSeenDate] = useState(today)
  const visitOn = referredOn ?? visitDate
  const addDays = (iso: string, n: number) => addWorkingDays(iso, n)
  const used = referredOn ? workingDaysBetween(visitOn, seenOn ?? (today > visitOn ? today : visitOn)) : 0
  const seenTooEarly = seenDate < visitOn

  const trace = [
    { step: 'Consent on file (given at the screening visit, can be withdrawn)', ok: true },
    { step: 'Three scored checks set the baseline', ok: true, detail: `baseline ${base.toFixed(1)}` },
    byReport
      ? { step: 'Person reported that everyday tasks have become harder (this overrides the scores)', ok: true, detail: flag.date }
      : flag.status === 'trend'
        ? { step: 'The line through every scored check is falling (slow-decline route)', ok: true, detail: `${flag.date}, ${Math.abs(flag.slope as number).toFixed(1)} points a check, slope z ${(flag.slopeZ as number).toFixed(2)}` }
        : { step: 'The last two scored checks, taken together, lower than usual', ok: true, detail: `${flag.date}, z of the two ${(flag.pairZ as number).toFixed(2)}` },
    { step: byReport ? 'Scores themselves are within the usual range' : flag.status === 'trend' ? 'Off days left out of the line' : 'Neither low check was reported as an off day', ok: true },
    { step: 'Not a very large single drop (that goes to urgent assessment)', ok: true },
    { step: 'Physician decision', ok: decision !== 'pending', detail: decision === 'pending' ? 'held: waiting for you' : decision },
    { step: 'Result given in person at a visit', ok: decision === 'approved' && !!referredOn, detail: decision === 'approved' ? (referredOn ? `visit ${visitOn}` : 'held: visit not yet recorded') : 'held' },
    { step: 'Referral closed', ok: !!seenOn, detail: seenOn ? `seen ${seenOn}` : 'held' },
  ]

  return (
    <>
      <h1>Physician's packet</h1>
      <p><span className="tag syn">Synthetic patient and check dates; the referral dates are the ones you enter</span> <span className="tag">Decision support. You decide.</span></p>
      <nav className="personas" aria-label="Packets waiting">
        {candidates.map((p) => <Link key={p.id} className="persona" aria-current={p.id === person.id} to={`/clinician/${p.id}`}><b>{p.name}</b><span>{p.path}</span></Link>)}
      </nav>
      <p><strong>{person.name}</strong>, {person.record.sex === 'F' ? 'female' : 'male'}. Clinic MoCA at the screening visit: {person.record.mocaAtVisit}. Home checks since {person.checks[0].date}.</p>
      <div className="card" aria-label="Read together">
        <p><strong>Read together.</strong> The checks show {finding}. {concernAreas.length} of the 8 risk areas need attention{concernAreas.length ? `: ${concernAreas.join(', ')}` : ''}. Modifiable risk (LIBRA): {lib.known} from the record{lib.ranked.length ? `, mostly ${lib.ranked.slice(0, 2).map((f) => f.name.toLowerCase()).join(' and ')}` : ''}. Check first: {contributors.map((c) => c.name[0].toLowerCase() + c.name.slice(1)).join(', ')}. Then decide on a specialist referral.</p>
        <p className="muted">Risk context helps you read the change and plan prevention. It never raises or lowers the flag: the rule reads only the checks.</p>
      </div>

      <h2>1. What was observed</h2>
      <div className="card chart-card"><TrajectoryChart checks={person.checks} traj={traj} /></div>
      <p>Scores are totals from a spoken check at home. Each is a range from two speech recognisers.</p>

      <h2>2. What was calculated</h2>
      {flag.status === 'trend' && <p>{TREND_PACKET_NOTE}{pairShort !== null && ` Here the last two checks averaged ${pairShort.toFixed(1)} points below baseline after the practice gain, z ${(flag.pairZ as number).toFixed(2)}: just short of the z ${DEFAULT_PARAMS.pairZ} the two-checks route needs, so that route alone would have waited for the next check.`}</p>}
      {byReport
        ? <p>Baseline {base.toFixed(1)} (mean of the first three checks). On {flag.date} the score was {(flag.mid as number).toFixed(1)}, within this person's usual range (z {(flag.z as number).toFixed(2)}). The packet was raised because the person said everyday tasks such as money, medicines or appointments have become harder. A reported change in daily life goes to you whatever the scores say.</p>
        : <p>Baseline {base.toFixed(1)} (mean of the first three checks). On {flag.date} the score was {(flag.mid as number).toFixed(1)}, which is {Math.abs(flag.change as number).toFixed(1)} points below baseline after the expected practice gain, {Math.abs(flag.z as number).toFixed(1)} times the measurement error. The check before it was also low.</p>}
      <div className="card">
        <p className="muted">The rule, in full. Fixed in code; no language model takes part.</p>
        <p><code>change = score − baseline − expected practice gain</code><br />
        <code>error = √( {DEFAULT_PARAMS.sem.toFixed(1)}² × (1 + 1/3) + range² / 12 )</code><br />
        <code>z = change ÷ error</code>; one check is lower than usual when <code>z ≤ {DEFAULT_PARAMS.flagZ}</code>, and is never sent on alone. A packet needs the average of the last two scored checks at <code>z ≤ {DEFAULT_PARAMS.pairZ}</code>, or a line through every scored check, from the eighth, falling at <code>slope ÷ its error ≤ {DEFAULT_PARAMS.trendZ}</code>.</p>
        <p className="muted">{DEFAULT_PARAMS.sem.toFixed(1)} points is how much one check varies within a person, taken from published retest studies of similar tasks and not yet from this check. "Range" is the gap between what both listeners heard and what either heard. A score in the usual range does not rule out impairment, and this is a change from the person's own baseline, not a diagnosis.</p>
      </div>

      <h2>3. Treatable contributors to check first</h2>
      <div className="scroll" tabIndex={0} role="region" aria-label="Treatable contributors to check first"><table>
        <thead><tr><th>Check</th><th>Why for this person</th><th>Suggested action</th></tr></thead>
        <tbody>{contributors.map((c) => <tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.why}</td><td>{c.action}</td></tr>)}</tbody>
      </table></div>

      <h2>4. Risk context in the eight areas</h2>
      <p className="muted">The physical, metabolic, sleep, mental-wellbeing, functional, lifestyle, family-history and genomic areas Statement 8 names. Each row says where it came from and under which consent.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Risk context in the eight areas"><table>
        <thead><tr><th>Area</th><th>For this person</th><th>Source</th><th>Shared under</th></tr></thead>
        <tbody>{areas.map((a) => <tr key={a.area}><td><strong>{a.area}</strong>{a.concern ? <><br /><strong className="status-watch">needs attention</strong></> : null}</td><td>{a.access === 'Not shared' ? <span className="muted">{a.finding}</span> : a.finding}</td><td className="muted">{a.source}</td><td className="muted">{a.access}</td></tr>)}</tbody>
      </table></div>
      <p className="muted">{context.map((c) => c.shared ? `${c.name}: ${c.note}` : '').filter(Boolean).join(' ')}</p>

      <h2>5. Modifiable risk: the LIBRA index</h2>
      <p>LIBRA weighs twelve modifiable factors by how strongly each is tied to dementia in published meta-analyses. From the screening record: <strong>{lib.known}</strong>, from {lib.knownCount} of the 12 factors. The other {12 - lib.knownCount} are not in the record, so the full score lies between <strong>{lib.low}</strong> and <strong>{lib.high}</strong> (scale {LIBRA_RANGE.min} to +{LIBRA_RANGE.max}; higher means more modifiable risk).</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="LIBRA factors"><table>
        <thead><tr><th>Factor</th><th>Weight</th><th>For this person</th></tr></thead>
        <tbody>{lib.factors.map((f) => <tr key={f.name}><td>{f.name}</td><td>{f.weight > 0 ? `+${f.weight}` : f.weight}</td><td>{f.present === null ? <span className="muted">{f.basis}</span> : f.present ? <><strong className="status-watch">present</strong>: {f.basis}</> : <>not present: {f.basis}</>}</td></tr>)}</tbody>
      </table></div>
      <p className="muted">Factors: Deckers et al. 2015; index: Schiepers et al. 2018; weights as reprinted in Stubs et al. 2025. In the English Longitudinal Study of Ageing each point raised dementia risk by 13% (hazard ratio 1.13, C-statistic 0.68); in midlife, over 30 years, by 27% (1.27, C 0.67). It ranks what is worth working on; it does not predict this person's future, and the change rule never reads it. Not yet checked in Emirati adults.</p>

      <h2>6. Lancet Commission risk factors</h2>
      <details>
        <summary>Ten of the fourteen modifiable risk factors in the 2024 Lancet Commission report have a matching field in the screening record. Four do not.</summary>
        <div className="scroll" tabIndex={0} role="region" aria-label="Lancet Commission risk factors"><table>
          <thead><tr><th>Factor</th><th>Screening field</th><th>Value</th><th><span className="sr-only">Status</span></th></tr></thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td><td>{f.field ?? <span className="muted">no matching field</span>}</td><td>{f.value ?? ''}</td>
                <td>{f.field ? (f.present ? <strong className="status-watch">present</strong> : 'not present') : ''}{f.note ? <><br /><span className="muted">{f.note}</span></> : null}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </details>

      <h2>7. Your decision</h2>
      {decision === 'pending' && (
        <>
          <p>Until you decide, the person sees only "Check received". If you approve, the app sends the invitation below and nothing else. You give the result in person.</p>
          <div className="card"><p className="muted" id="invite-help">Invitation wording. The template is offered to the public health centre for approval; you may edit it for this person before sending.</p><textarea aria-label="Invitation wording" aria-describedby="invite-help" value={invite} onChange={(e) => setInvite(e.target.value)} style={{ minHeight: 80 }} /></div>
          <p><label>Your note for the record (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label></p>
          <div className="stack">
            <button className="primary" onClick={() => { setApprovedOn(new Date().toISOString().slice(0, 10)); setDecision('approved'); record('approved', invite !== INVITE ? `invitation edited: ${invite}` : undefined) }}>Approve and invite the person to a visit</button>
            <p><label>Reason for dismissing<textarea style={{ minHeight: 60 }} value={reason} onChange={(e) => setReason(e.target.value)} /></label></p>
            <button disabled={!reason.trim()} onClick={() => { setDecision('dismissed'); record('dismissed', reason) }}>Dismiss with this reason</button>
          </div>
        </>
      )}
      {decision === 'dismissed' && <div className="note">Dismissed. Reason recorded: "{reason}". Home checks continue and the person is not contacted.</div>}
      {decision === 'approved' && (
        <>
          <div className="note">Approved on {approvedOn} (today){invite !== INVITE ? ' with edited wording' : ''}. The person received this invitation and nothing else: "{invite}"</div>
          <h2>8. Follow-up clock</h2>
          <p>Target: referral to a neurologist or geriatrician completed within {REFERRAL_TARGET_WORKING_DAYS} working days of the visit. The number is borrowed from the screening programme's own referral indicator.</p>
          <div className="stack">
            {!referredOn && <>
              <p><label>Date of the visit where you gave the result <input type="date" value={visitDate} min={approvedOn} onChange={(e) => setVisitDate(e.target.value || today)} /></label></p>
              <button className="primary" disabled={visitDate < approvedOn} onClick={() => { setReferredOn(visitDate); record('result given in person', `visit ${visitDate}; referral to ${SPECIALTY[specialty].display}`) }}>Record: result given in person on {visitDate}, referral made the same day</button>
            </>}
            {referredOn && !seenOn && <>
              <p><label>Date the specialist saw the person <input type="date" value={seenDate} min={referredOn} onChange={(e) => setSeenDate(e.target.value || today)} /></label></p>
              <button className="primary" disabled={seenTooEarly} onClick={() => { setSeenOn(seenDate); record('specialist seen', `seen ${seenDate}`) }}>Record: specialist appointment attended</button>
              {seenTooEarly && <p className="muted">The appointment cannot be before the visit.</p>}
            </>}
          </div>
          {referredOn && (
            <div className="card">
              <p><strong>{seenOn ? 'Closed' : 'Open'}</strong>: {used} of {REFERRAL_TARGET_WORKING_DAYS} working days used{seenOn ? '' : ' so far, counted to today'}{used > REFERRAL_TARGET_WORKING_DAYS ? '. Over the target' : ''}. <span className="muted">Counted Monday to Friday between the dates you entered. In a pilot they come from the referral and visit records.</span></p>
              <p className="muted">Visit {visitOn}. Referral made {referredOn}.{seenOn ? ` Seen ${seenOn}.` : ' Waiting for the appointment.'} Owner: the ordering physician at the screening provider.</p>
            </div>
          )}
        </>
      )}

      {referredOn && (
        <>
          <h2>Referral to Malaffi</h2>
          <p>Abu Dhabi asks every referral to reach Malaffi as an HL7 v2 REF message with a priority and a SNOMED-coded specialty (DoH Circular 2026/144). The partner facility's record system sends it; this is the message it would carry.</p>
          <div className="segmented" role="group" aria-label="Specialty">
            {(['neurology', 'geriatrics'] as Specialty[]).map((k) => <button key={k} className="seg" aria-pressed={specialty === k} onClick={() => setSpecialty(k)}>{SPECIALTY[k].display}</button>)}
          </div>
          <pre className="hl7" tabIndex={0} role="region" aria-label="HL7 v2 referral message">{refMessage({ messageId: `msg-${person.id}`, sentAt: `${referredOn}T09:00:00`, patientId: `synthetic-${person.id}`, referralId: `ref-${person.id}`, referredOn, specialty, priority: 'routine', reason: byReport ? 'Reported change in everyday tasks; packet approved by ordering physician' : 'Sustained fall from personal baseline on spoken memory check; packet approved by ordering physician', orderingFacility: 'FACILITY1' }).split('\r').join('\n')}</pre>
          <p className="muted">Draft mapping: Malaffi's own REF profile is not public, so segment use follows HL7 v2.5. SNOMED CT {SPECIALTY[specialty].code} = {SPECIALTY[specialty].display}. Synthetic patient.</p>
        </>
      )}

      <h2>Hand-off to other systems</h2>
      <p className="muted">The checks and the referral as FHIR R4 resources, for an exchange or a record system to take in.</p>
      <button className="small" onClick={() => {
        const ref = `Patient/synthetic-${person.id}`
        // Family history and genome results go only if the person agreed to share each one.
        const ctx = [person.shared.familyHistory ? familyHistory(ref, person.record) : null, person.shared.genome ? apoeObservation(ref, person.record) : null, libraAssessment(ref, person.record, new Date().toISOString().slice(0, 10))].filter((x) => x !== null)
        const res = [...person.checks.map((c) => checkObservation(ref, c)), ...ctx, ...(referredOn ? [referralRequest(ref, 'Practitioner/ordering', referredOn, addDays(visitOn, 21), specialty)] : [])]
        const url = URL.createObjectURL(new Blob([JSON.stringify(bundle(res), null, 2)], { type: 'application/fhir+json' }))
        Object.assign(document.createElement('a'), { href: url, download: `synthetic-${person.id}.fhir.json` }).click()
        URL.revokeObjectURL(url)
      }}>Download FHIR bundle (synthetic)</button>

      <h2>Decision log</h2>
      {log.length === 0 ? <p className="muted">No decisions recorded for this case on this device yet.</p> : (
        <ol className="trace">{log.map((a, i) => <li key={i}><strong>{a.action}</strong>{a.detail ? `: ${a.detail}` : ''} <span className="muted">({a.at.slice(0, 16).replace('T', ' ')} UTC, app {a.appVersion})</span></li>)}</ol>
      )}
      <p className="muted">Times are when each button was pressed on this device; the case's own check dates are synthetic. Kept on this device in the prototype. In a pilot each entry goes to the facility's record system with the physician's identity.</p>

      <h2>Step trace</h2>
      <ol className="trace">{trace.map((t) => <li key={t.step}><strong className={t.ok ? 'status-usual-range' : 'status-watch'}>{t.ok ? 'Passed' : 'Held'}</strong>: {t.step}{t.detail ? ` (${t.detail})` : ''}</li>)}</ol>
      <div className="stack"><Link className="btn" to={`/year/${person.id}`}>Back to the year of checks</Link></div>
    </>
  )
}
