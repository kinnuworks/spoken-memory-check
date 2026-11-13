import { Link, useParams } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import TrajectoryChart from './TrajectoryChart'

const LABEL: Record<string, string> = { 'building-baseline': 'Setting the baseline', 'usual-range': 'Within usual range', watch: 'Lower once', review: 'Reported change in everyday tasks', flag: 'Lower twice in a row', urgent: 'Very large fall' }

export default function Year() {
  const { id } = useParams()
  const person = PERSONAS.find((p) => p.id === id) ?? PERSONAS[2]
  const traj = evaluate(person.checks)
  const flagged = traj.results.find((r) => r.status === 'flag' || r.status === 'review')
  const urgent = traj.status === 'urgent'
  return (
    <>
      <h1>A year of checks</h1>
      <p><span className="tag syn">Synthetic people, not real data</span></p>
      <nav className="personas" aria-label="Synthetic people">
        {PERSONAS.map((p) => (
          <Link key={p.id} className="persona" aria-current={p.id === person.id} to={`/year/${p.id}`}><b>{p.name}</b><span>{p.path}</span></Link>
        ))}
      </nav>
      <p>{person.story}</p>
      <div className="card chart-card">
        <TrajectoryChart checks={person.checks} traj={traj} />
        <p className="muted">Each dot is one check (total of words said back, words recalled later and animals named). The thick bar is the range from the two recognisers. The dashed line is this person's own baseline, the mean of their first three checks, and the shaded band is normal variation. Hollow dots are days the person reported as off days. A dash is a missed check.</p>
      </div>
      <h2>What the rule said, check by check</h2>
      <div className="scroll" tabIndex={0} role="region" aria-label="What the rule said, check by check"><table>
        <thead><tr><th>Date</th><th>Score</th><th>Against baseline</th><th>Result</th></tr></thead>
        <tbody>
          {traj.results.map((r) => {
            const c = person.checks[r.index]
            return (
              <tr key={r.index}>
                <td>{r.date}</td>
                <td>{c.low === null ? 'missed' : c.low === c.high ? c.high : `${c.low} to ${c.high}`}</td>
                <td>{r.change === null ? '' : `${r.change > 0 ? '+' : ''}${r.change.toFixed(1)} (z ${(r.z as number).toFixed(2)}, p below ${(r.pBelow as number).toFixed(2)})`}</td>
                <td className={`status-${r.status}`}><strong>{r.scored ? (person.checks[r.index].offDay && r.status === 'watch' ? 'Off day, not counted' : LABEL[r.status]) : person.checks[r.index].hearingLimited ? 'Held' : 'Not scored'}</strong><br /><span className="muted">{r.note}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="note">
        <strong>What the person sees.</strong> After every check: "Check received. Thank you." and a dated tick. No scores, no trend, nothing abnormal. {urgent ? 'The one exception is this route: after a very large fall the app says "Please see a doctor today". In a pilot the clinic would be told at the same time; that alert is not built in this prototype.' : flagged ? 'For this person, the physician is asked first.' : 'For this person nothing went to a physician.'}
      </div>
      <div className="stack">
        {flagged && <Link className="btn primary" to={`/clinician/${person.id}`}>Open the physician's packet for {person.name}</Link>}
        <Link className="btn" to={`/me/${person.id}`}>See this person's own screen</Link>
        <Link className="btn" to="/try">Try it with your voice</Link>
      </div>
      <p className="muted">A personal baseline cannot show impairment that was already present when the person enrolled. The clinic test at the screening visit covers that.</p>
    </>
  )
}
