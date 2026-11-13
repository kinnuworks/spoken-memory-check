import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { loadConsent, saveConsent } from '../engine/consent'
import { PERSONAS } from '../engine/histories'
import { improvable } from '../engine/prevention'
import { Check as Tick } from '../components/Icons'

export default function Person() {
  const { id } = useParams()
  const person = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
  const traj = evaluate(person.checks)
  const steps = improvable(person.record)
  const [consent, setConsent] = useState(loadConsent())
  const scored = person.checks.filter((c) => c.low !== null).length
  const set = (patch: Partial<typeof consent>) => setConsent(saveConsent({ ...consent, ...patch }))

  return (
    <>
      <h1>What the person sees</h1>
      <p><span className="tag syn">Synthetic person</span></p>
      <nav className="personas" aria-label="Synthetic people">
        {PERSONAS.map((p) => (
          <Link key={p.id} className="persona" aria-current={p.id === person.id} to={`/me/${p.id}`}><b>{p.name}</b><span>{p.path}</span></Link>
        ))}
      </nav>

      <h2>Your checks</h2>
      {traj.status === 'urgent' ? (
        <div className="note note-alert">
          <strong>Please see a doctor today.</strong> Your last check was very different from your earlier ones. This can have many causes, some of them simple to treat, and it is worth checking straight away. Call your screening clinic, or go to an urgent care centre. In a pilot, the clinic would be told at the same time; that alert is not built in this prototype.
        </div>
      ) : (
        <p>{person.checks.length} checks this year, {scored} of them scored. Thank you. Your next check is due in about six weeks; we will remind you.</p>
      )}
      <div className="ticks" aria-label="Checks received">
        {person.checks.map((c, i) => (
          <span key={i} className={`tick${c.low === null ? ' off' : ''}`} title={c.date}>{c.low !== null && <Tick />}{c.date.slice(5)}{c.low === null ? (c.hearingLimited ? ' · sound check' : ' · missed') : ''}</span>
        ))}
      </div>
      {person.checks.filter((c) => c.hearingLimited).length >= 2 && (
        <div className="note">Twice we could not hear you clearly enough to score the check. That is often about hearing, not memory. Please ask your clinic about a hearing test; it also makes these checks fairer.</div>
      )}
      <p className="muted">Scores are not shown here, because one score on one day says little and a falling number can worry people for no reason. Your physician sees your scores over time and will invite you to a visit if they want to talk about them. Results are discussed in person, never in the app.</p>

      <h2>What your screening visit shows you can work on</h2>
      {steps.length === 0 && <p>Nothing stood out at your last screening visit. Keeping active, sleeping well and staying in touch with people all help.</p>}
      {steps.map((s) => (
        <div className="card" key={s.topic}>
          <strong>{s.topic}</strong>
          <p>{s.found} {s.action}</p>
        </div>
      ))}
      <p className="muted">These come from your own screening record. There is no risk score here, because figures about whole populations do not say what will happen to one person. Wording is a fixed template offered to the public health centre for approval.</p>

      <h2>Your choices</h2>
      <p>Each one is off until you turn it on, and you can turn it off again at any time.</p>
      <label className="choice"><input className="switch" type="checkbox" checked={consent.takeChecks} onChange={(e) => set({ takeChecks: e.target.checked })} /><span>Take memory checks at home and keep my scores on this device</span></label>
      <label className="choice"><input className="switch" type="checkbox" checked={consent.sharePhysician} onChange={(e) => set({ sharePhysician: e.target.checked })} /><span>If my scores stay lower than usual, tell the physician at my screening clinic</span></label>
      <label className="choice"><input className="switch" type="checkbox" disabled={!consent.sharePhysician} checked={consent.keepClips} onChange={(e) => set({ keepClips: e.target.checked })} /><span>Let that physician listen to a recording when the check was unsure what I said</span></label>
      <label className="choice"><input className="switch" type="checkbox" checked={consent.cloudListener} onChange={(e) => set({ cloudListener: e.target.checked })} /><span>Let a speech service hosted in the UAE also hear my checks, which has a Gulf Arabic model (not yet measured in this check). Recordings leave this device for this and are not kept.</span></label>
      {consent.updated && (
        <div className="card">
          <strong>Your receipt</strong>
          <p className="muted">Last changed {consent.updated.slice(0, 16).replace('T', ' ')} UTC. Home checks: {consent.takeChecks ? 'yes' : 'no'}. Tell my physician: {consent.sharePhysician ? 'yes' : 'no'}. Recordings for my physician: {consent.keepClips ? 'yes' : 'no'}. UAE speech service: {consent.cloudListener ? 'yes' : 'no'}. Kept on this device in this prototype.</p>
        </div>
      )}
      <div className="stack"><Link className="btn" to={`/year/${person.id}`}>See what the rule said about these checks</Link></div>
    </>
  )
}
