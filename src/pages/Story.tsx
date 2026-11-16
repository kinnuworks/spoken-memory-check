import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PACKET_STATUSES, STATUS_LABEL, evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import { addWorkingDays, treatableContributors } from '../engine/packet'
import { SPECIALTY } from '../engine/fhir'
import { refMessage } from '../engine/hl7'
import TrajectoryChart from './TrajectoryChart'

// One synthetic case, told step by step: what the person sees on their phone and what the
// clinic sees, side by side. Every number comes from the same rule the rest of the app uses.
const person = PERSONAS.find((p) => p.id === 'decline')!
const traj = evaluate(person.checks)
const flag = traj.results.find((r) => PACKET_STATUSES.includes(r.status))!
const scoredSoFar = traj.results.filter((r) => r.scored && r.index <= flag.index).length
const approvedOn = addWorkingDays(flag.date, 2)
const visitOn = addWorkingDays(approvedOn, 5)
const seenOn = addWorkingDays(visitOn, 12)
const contributors = treatableContributors(person.record).slice(0, 3)

interface Step {
  title: string
  upTo: number // checks shown on the chart
  phone: { head: string; body: string; ticks?: boolean }
  clinic: { head: string; body: string; extra?: 'packet' | 'ref' | 'closed' }
}

const STEPS: Step[] = [
  {
    title: 'Screening visit',
    upTo: 1,
    phone: { head: 'Welcome', body: 'You agreed to home memory checks at your screening visit. Each part of that agreement can be turned off at any time.' },
    clinic: { head: `${person.name} enrolled`, body: `Hearing and dementia screening package at the visit. Clinic MoCA ${person.record.mocaAtVisit}. Hearing check passed, so spoken scores can be trusted. First check done.` },
  },
  {
    title: 'Two more checks at home',
    upTo: 3,
    phone: { head: 'Check received. Thank you.', body: 'Your next check is in about six weeks. We will remind you.', ticks: true },
    clinic: { head: `Baseline set: ${(traj.baseline as number).toFixed(1)}`, body: 'The mean of the first three scored checks. From now on each check is compared with this, after the expected practice gain and normal day-to-day variation.' },
  },
  {
    title: 'Months of ordinary checks',
    upTo: 6,
    phone: { head: 'Check received. Thank you.', body: 'The person sees the same thank-you after every check. No scores, no trend.', ticks: true },
    clinic: { head: 'Within the usual range', body: 'Scores drift a little, as they do. Nothing goes to a physician.' },
  },
  {
    title: 'One low check',
    upTo: 7,
    phone: { head: 'Check received. Thank you.', body: 'One low day means little on its own, so nothing changes for the person.', ticks: true },
    clinic: { head: 'Lower once: watch', body: `${person.checks[6].date}: well below baseline. The rule waits for the next check before anyone is told.` },
  },
  {
    title: 'Low again: a packet for the physician',
    upTo: 8,
    phone: { head: 'Check received. Thank you.', body: 'Still nothing alarming at home. The physician decides first.', ticks: true },
    clinic: flag.status === 'trend'
      ? { head: STATUS_LABEL.trend, body: `On ${flag.date}: ${Math.abs(flag.change as number).toFixed(1)} points below baseline after practice. Across all ${scoredSoFar} checks the score has fallen about ${Math.abs(flag.slope as number).toFixed(1)} points a check, more than measurement error explains. A packet goes to the ordering physician.`, extra: 'packet' }
      : { head: STATUS_LABEL.flag, body: `On ${flag.date}: ${Math.abs(flag.change as number).toFixed(1)} points below baseline after practice. This check and the one before, taken together, are ${Math.abs(flag.pairZ as number).toFixed(1)} times the measurement error below baseline. A packet goes to the ordering physician.`, extra: 'packet' },
  },
  {
    title: 'The physician approves',
    upTo: 8,
    phone: { head: 'A message from your clinic', body: 'Your screening clinic would like to see you to talk about your memory checks. This is a routine follow-up visit.' },
    clinic: { head: `Approved on ${approvedOn}`, body: 'The app sends this one invitation and nothing else. The result will be given in person.' },
  },
  {
    title: 'Visit and referral',
    upTo: 8,
    phone: { head: 'Appointment booked', body: `Seen at the clinic on ${visitOn}. The physician explained the results and arranged a specialist appointment.` },
    clinic: { head: 'Referral sent to Malaffi', body: `Referral to ${SPECIALTY.neurology.display}, coded in SNOMED CT, as the HL7 v2 message Malaffi asks for. The 15-working-day clock starts.`, extra: 'ref' },
  },
  {
    title: 'Loop closed',
    upTo: 8,
    phone: { head: 'Specialist appointment attended', body: 'Home checks continue on the plan the specialist sets.' },
    clinic: { head: 'Closed in 12 of 15 working days', body: `Specialist seen on ${seenOn}. The case leaves the open list in the programme view.`, extra: 'closed' },
  },
]

export default function Story() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const shown = person.checks.slice(0, s.upTo)
  const shownTraj = evaluate(shown)
  return (
    <>
      <h1>One case, both screens</h1>
      <p><span className="tag syn">Synthetic person; dates are illustrative</span></p>
      <p className="lead-p">What {person.name} sees at home, beside what the clinic sees, from the screening visit to a closed referral. Step through it.</p>

      <ol className="story-steps" aria-label="Steps">
        {STEPS.map((st, k) => (
          <li key={st.title}><button className={`story-dot${k === i ? ' on' : ''}${k < i ? ' done' : ''}`} aria-current={k === i ? 'step' : undefined} aria-label={`Step ${k + 1}: ${st.title}`} onClick={() => setI(k)} /></li>
        ))}
      </ol>
      <h2 className="story-title">{i + 1}. {s.title}</h2>

      <div className="story">
        <section className="story-phone" aria-label="The person's phone">
          <p className="eyebrow">At home</p>
          <div className="story-screen">
            <p className="story-head">{s.phone.head}</p>
            <p>{s.phone.body}</p>
            {s.phone.ticks && (
              <ul className="ticks">{shown.map((c) => <li key={c.date} className="tick">{c.date.slice(5)}</li>)}</ul>
            )}
          </div>
        </section>
        <section className="story-clinic" aria-label="The clinic's screen">
          <p className="eyebrow">At the clinic</p>
          <div className="card story-card">
            <p className="story-head">{s.clinic.head}</p>
            <p>{s.clinic.body}</p>
            <TrajectoryChart checks={shown} traj={shownTraj} compact />
            {s.clinic.extra === 'packet' && (
              <ul className="story-list">{contributors.map((c) => <li key={c.name}><strong>{c.name}</strong>: {c.action}</li>)}</ul>
            )}
            {s.clinic.extra === 'ref' && (
              <pre className="hl7" tabIndex={0} aria-label="HL7 v2 referral message">{refMessage({ messageId: 'msg-story', sentAt: `${visitOn}T09:00:00`, patientId: `synthetic-${person.id}`, referralId: 'ref-story', referredOn: visitOn, specialty: 'neurology', priority: 'routine', reason: 'Sustained fall from personal baseline; packet approved by ordering physician', orderingFacility: 'FACILITY1' }).split('\r').join('\n')}</pre>
            )}
            {s.clinic.extra === 'closed' && <div className="meter" aria-label="12 of 15 working days used"><i style={{ width: '80%' }} /></div>}
          </div>
        </section>
      </div>

      <div className="story-nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        {i < STEPS.length - 1
          ? <button className="primary" onClick={() => setI(i + 1)}>Next: {STEPS[i + 1].title}</button>
          : <Link className="btn primary" to={`/clinician/${person.id}`}>Open the full packet</Link>}
      </div>
      <p className="muted">The chart is the real rule run on a synthetic history. Messages are fixed templates offered to the public health centre for approval.</p>
    </>
  )
}
