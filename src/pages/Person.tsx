import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { loadConsent, saveConsent } from '../engine/consent'
import { PERSONAS } from '../engine/histories'
import { improvable } from '../engine/prevention'
import TrajectoryChart from './TrajectoryChart'

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
      <div className="row">
        {PERSONAS.map((p) => (
          <Link key={p.id} className="btn" style={{ padding: '6px 10px', fontSize: 15, fontWeight: p.id === person.id ? 700 : 400 }} to={`/me/${p.id}`}>{p.name}</Link>
        ))}
      </div>

      <h2>Your checks</h2>
      <p>{scored} checks received this year. Your next check is due in about six weeks. We will remind you.</p>
      <div className="card"><TrajectoryChart checks={person.checks} traj={traj} plain /></div>
      <p className="muted">The dashed line is your own usual level. Scores go up and down from day to day. One low day does not mean anything on its own.</p>
      <div className="note">The same screen is shown whatever the checks say. If your physician wants to talk about your checks, your clinic invites you to a visit. Results are discussed in person, never in the app.</div>

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
      <p><label><input type="checkbox" checked={consent.takeChecks} onChange={(e) => set({ takeChecks: e.target.checked })} /> Take memory checks at home and keep my scores on this device</label></p>
      <p><label><input type="checkbox" checked={consent.sharePhysician} onChange={(e) => set({ sharePhysician: e.target.checked })} /> If my scores stay lower than usual, tell the physician at my screening clinic</label></p>
      <p><label><input type="checkbox" disabled={!consent.sharePhysician} checked={consent.keepClips} onChange={(e) => set({ keepClips: e.target.checked })} /> Let that physician listen to a recording when the check was unsure what I said</label></p>
      {consent.updated && (
        <div className="card">
          <strong>Your receipt</strong>
          <p className="muted">Last changed {consent.updated.slice(0, 16).replace('T', ' ')} UTC. Home checks: {consent.takeChecks ? 'yes' : 'no'}. Tell my physician: {consent.sharePhysician ? 'yes' : 'no'}. Recordings for my physician: {consent.keepClips ? 'yes' : 'no'}. Kept on this device in this prototype.</p>
        </div>
      )}
      <div className="stack"><Link className="btn" to={`/year/${person.id}`}>See what the rule said about these checks</Link></div>
    </>
  )
}
