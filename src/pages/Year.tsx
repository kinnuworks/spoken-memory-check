import { Link, useParams } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import TrajectoryChart from './TrajectoryChart'

const LABEL: Record<string, string> = { 'building-baseline': 'Setting the baseline', 'usual-range': 'Within usual range', watch: 'Lower once', flag: 'Lower twice in a row', urgent: 'Very large fall' }

export default function Year() {
  const { id } = useParams()
  const person = PERSONAS.find((p) => p.id === id) ?? PERSONAS[2]
  const traj = evaluate(person.checks)
  const flagged = traj.results.find((r) => r.status === 'flag')
  return (
    <>
      <h1>A year of checks</h1>
      <p><span className="tag syn">Synthetic people, not real data</span></p>
      <div className="row">
        {PERSONAS.map((p) => (
          <Link key={p.id} className="btn" style={{ padding: '6px 10px', fontSize: 15, fontWeight: p.id === person.id ? 700 : 400 }} to={`/year/${p.id}`}>{p.name}</Link>
        ))}
      </div>
      <p>{person.story}</p>
      <div className="card">
        <TrajectoryChart checks={person.checks} traj={traj} />
        <p className="muted">Each dot is one check (total of words said back, words recalled later and animals named). The thick bar is the range from the two recognisers. The dashed line is this person's own baseline, the mean of their first three checks, and the shaded band is normal variation. Hollow dots are days the person reported as off days. A dash is a missed check.</p>
      </div>
      <h2>What the rule said, check by check</h2>
      <table>
        <thead><tr><th>Date</th><th>Score</th><th>Against baseline</th><th>Result</th></tr></thead>
        <tbody>
          {traj.results.map((r) => {
            const c = person.checks[r.index]
            return (
              <tr key={r.index}>
                <td>{r.date}</td>
                <td>{c.low === null ? 'missed' : c.low === c.high ? c.high : `${c.low} to ${c.high}`}</td>
                <td>{r.change === null ? '' : `${r.change > 0 ? '+' : ''}${r.change.toFixed(1)} (z ${(r.z as number).toFixed(2)}, p below ${(r.pBelow as number).toFixed(2)})`}</td>
                <td className={`status-${r.status}`}><strong>{r.scored ? LABEL[r.status] : 'Not scored'}</strong><br /><span className="muted">{r.note}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="note">
        <strong>What the person sees.</strong> After every check, on the same fixed day each week: "Check received. Thank you." and their own trend. Nothing abnormal is ever shown in the app. {flagged ? 'For this person, the physician is asked first.' : 'For this person nothing went to a physician.'}
      </div>
      <div className="stack">
        {flagged && <Link className="btn primary" to="/clinician">Open the physician's packet for Person C</Link>}
        <Link className="btn" to={`/me/${person.id}`}>See this person's own screen</Link>
        <Link className="btn" to="/try">Try it with your voice</Link>
      </div>
      <p className="muted">A personal baseline cannot show impairment that was already present when the person enrolled. The clinic test at the screening visit covers that.</p>
    </>
  )
}
