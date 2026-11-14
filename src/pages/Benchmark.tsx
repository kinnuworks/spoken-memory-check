import data from '../data/benchmark.json'
import SurveyChart from './SurveyChart'
import { OlderSpeakers, RuleChecks } from './EvidenceExtra'

const RULE: Record<string, string> = {
  ours: 'This check: two low checks in a row, or a slowly falling line',
  'two-in-a-row': 'Before the slow-decline route: two low checks in a row only',
  'single-low': 'Simpler rule: one low check',
  'fixed-cutoff': 'Simpler rule: one cutoff for everyone',
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export default function Benchmark() {
  const b2 = data.burden.find((b) => b.prevalence === 0.02)!
  const worlds = [...new Set(data.rows.map((r) => r.world))]
  const row = (world: string, rule: string) => data.rows.find((r) => r.world.includes(world) && r.rule === rule)!
  const det = (r: (typeof data.rows)[number], s: string) => (r.detected as Record<string, number>)[s]
  const now = row('As assumed', 'ours'), before = row('As assumed', 'two-in-a-row')
  const upNow = row('upper bound', 'ours'), upBefore = row('upper bound', 'two-in-a-row')
  return (
    <>
      <h1>How the flag was tested</h1>
      <p><span className="tag syn">Simulated people, not patients</span></p>
      <p>The flag is the step that carries the safety decision, so it is the step we measured. Each cell below is {data.n.toLocaleString()} simulated people followed for eleven checks in a year. Run on {data.generated}; anyone can rerun it with <code>npx tsx scripts/benchmark.ts</code>.</p>

      <h2>Slow decline: before and after the second route</h2>
      <p>The first version of the rule only raised a packet when two checks in a row fell well below the person's baseline. That misses slow decline: a loss of one point per check was caught within the year in {pct(det(before, '1'))} of simulated people. A second route now draws a straight line through every scored check, after the practice adjustment, and raises a packet when the line falls by more than measurement error explains on two scored checks in a row.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Before and after the slow-decline route"><table>
        <thead><tr><th>Measure (simulated)</th><th>Before: two in a row only</th><th>Now: both routes</th></tr></thead>
        <tbody>
          <tr><th scope="row">Caught within the year, losing 1 point per check</th><td>{pct(det(before, '1'))}</td><td>{pct(det(now, '1'))}</td></tr>
          <tr><th scope="row">Caught within the year, losing 2 points per check</th><td>{pct(det(before, '2'))}</td><td>{pct(det(now, '2'))}</td></tr>
          <tr><th scope="row">Caught within the year, losing 3 points per check</th><td>{pct(det(before, '3'))}</td><td>{pct(det(now, '3'))}</td></tr>
          <tr><th scope="row">Median checks from start of decline to packet (1 / 2 / 3 points)</th><td>{['1', '2', '3'].map((s) => (before.medianChecksToFlag as Record<string, number | null>)[s] ?? '–').join(' / ')}</td><td>{['1', '2', '3'].map((s) => (now.medianChecksToFlag as Record<string, number | null>)[s] ?? '–').join(' / ')}</td></tr>
          <tr><th scope="row">False alarms in a year, stable people</th><td>{pct(before.falseAlarmYear)}</td><td>{pct(now.falseAlarmYear)}</td></tr>
          <tr><th scope="row">False alarms if each check varies by 4.5 points, not 4.0</th><td>{pct(upBefore.falseAlarmYear)}</td><td>{pct(upNow.falseAlarmYear)}</td></tr>
          {data.burden.map((b, i) => <tr key={b.prevalence}><th scope="row">Packets per 1,000 a year with {pct(b.prevalence)} in real decline (real ones)</th><td>{data.burdenBefore[i].packetsPer1000.toFixed(0)} ({data.burdenBefore[i].realPer1000.toFixed(0)})</td><td>{b.packetsPer1000.toFixed(0)} ({b.realPer1000.toFixed(0)})</td></tr>)}
        </tbody>
      </table></div>
      <p className="muted">The cut-offs for the new route were fixed before these numbers were run: the line's slope over its error at or below {data.trend.trendZ}, from {data.trend.trendMinChecks} scored checks on (baseline included), on {data.trend.trendRuns} scored checks in a row. They were chosen on a separate set of simulated people (seed {data.trend.tuningSeed}) as the loosest setting that kept false alarms under 5% a year with both routes together; the numbers on this page come from seed {data.trend.reportSeed}. The price is real: about {(b2.packetsPer1000 - data.burdenBefore[1].packetsPer1000).toFixed(0)} more packets per 1,000 members a year, of which about {(b2.realPer1000 - data.burdenBefore[1].realPer1000).toFixed(0)} are real. A slow loss of one point per check is still missed within the year in more than half of simulated people.</p>

      <h2>Six measures, as a validation dashboard</h2>
      <div className="tiles">
        <div className="card"><p className="muted">Completion</p><p className="big small-big">Pending</p><p className="muted">Needs real volunteers. Not measured yet.</p></div>
        <div className="card"><p className="muted">Retest reliability</p><p className="big small-big">Pending</p><p className="muted">Needs volunteers taking the check twice. The rule uses 4.0 points from published studies until then.</p></div>
        <div className="card"><p className="muted">Sensitivity (decline of 2 points a check)</p><p className="big small-big">{pct(b2.sensitivity)}</p><p className="muted">95% interval {pct(b2.sensitivityCi[0])} to {pct(b2.sensitivityCi[1])}. Simulated.</p></div>
        <div className="card"><p className="muted">Specificity over a year (1 minus false alarms)</p><p className="big small-big">{pct(b2.specificity)}</p><p className="muted">95% interval {pct(b2.specificityCi[0])} to {pct(b2.specificityCi[1])}. Simulated.</p></div>
        <div className="card"><p className="muted">Packets per 1,000 members a year</p><p className="big small-big">{b2.packetsPer1000.toFixed(0)}</p><p className="muted">Of which real: {b2.realPer1000.toFixed(0)}. Assumes {pct(b2.prevalence)} of members in real decline. Simulated.</p></div>
        <div className="card"><p className="muted">Time to assessment</p><p className="big small-big">Target 15</p><p className="muted">Working days from the visit, tracked per referral in the physician's view. No pilot data yet.</p></div>
      </div>

      <h3>Confusion matrix, simulated year, {b2.members.toLocaleString()} members</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Confusion matrix"><table>
        <thead><tr><th><span className="sr-only">Group</span></th><th>Packet sent</th><th>No packet</th></tr></thead>
        <tbody>
          <tr><th scope="row">In real decline</th><td>{b2.tp.toLocaleString()}</td><td>{b2.fn.toLocaleString()}</td></tr>
          <tr><th scope="row">Stable</th><td>{b2.fp.toLocaleString()}</td><td>{b2.tn.toLocaleString()}</td></tr>
        </tbody>
      </table></div>

      <h3>Workload for physicians, by how common real decline is</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Workload for physicians"><table>
        <thead><tr><th>Members in real decline (assumed)</th><th>Packets per 1,000 a year</th><th>Real ones</th><th>Share of packets that are real</th></tr></thead>
        <tbody>{data.burden.map((b) => <tr key={b.prevalence}><td>{pct(b.prevalence)}</td><td>{b.packetsPer1000.toFixed(0)}</td><td>{b.realPer1000.toFixed(0)}</td><td>{pct(b.realPer1000 / b.packetsPer1000)}</td></tr>)}</tbody>
      </table></div>
      <p className="muted">All six measures and the tables below use the same "as assumed" settings: 4.0 points of variation, 1.0 point of practice gain, no recogniser misses. Each packet is a short review by the ordering physician, not a referral: the physician can dismiss it with a reason. Splits by language, age and schooling need real volunteer data and are not shown until it exists. Groups smaller than five people will be suppressed.</p>

      <h2>What to take from it</h2>
      <ul>
        <li>Both routes together keep false alarms in stable people to {pct(now.falseAlarmYear)} a year, against {pct(row('As assumed', 'single-low').falseAlarmYear)} for one low check and {pct(row('As assumed', 'fixed-cutoff').falseAlarmYear)} for one cutoff applied to everyone.</li>
        <li>Slow change is still the weak spot. A loss of one point per check is caught within the year in {pct(det(now, '1'))} of people ({pct(det(before, '1'))} before the trend route). A loss of two points per check is caught in {pct(det(now, '2'))}.</li>
        <li>If each check really varies by 4.5 points where the rule assumes 4.0, false alarms rise to {pct(upNow.falseAlarmYear)} a year. The 4.0 comes from published retest studies of similar tasks, not of this check, which is why our own volunteer retest matters.</li>
        <li>If there is no practice gain at all, false alarms rise to {pct(row('No practice', 'ours').falseAlarmYear)}: the rule then reads the missing gain as a small fall.</li>
        <li>Words missed by the recognisers make the rule more cautious, not more alarming, because the misses also lower the baseline.</li>
      </ul>

      {worlds.map((w) => (
        <div key={w}>
          <h3>{w}</h3>
          <div className="scroll" tabIndex={0} role="region" aria-label={w}><table>
            <thead><tr><th>Rule</th><th>False alarms in a year (stable people)</th><th>Caught within the year, losing 1 / 2 / 3 points per check</th><th>Median checks to flag</th></tr></thead>
            <tbody>
              {data.rows.filter((r) => r.world === w).map((r) => (
                <tr key={r.rule}>
                  <td>{RULE[r.rule]}</td>
                  <td>{pct(r.falseAlarmYear)}</td>
                  <td>{['1', '2', '3'].map((s) => pct((r.detected as Record<string, number>)[s])).join(' / ')}</td>
                  <td>{['1', '2', '3'].map((s) => (r.medianChecksToFlag as Record<string, number | null>)[s] ?? '–').join(' / ')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}

      <h2>Settings and limits</h2>
      <p className="muted">Simulated scores are totals with a mean of 33 and a spread between people of 6 points. One check varies within a person by 4.0 points (from published retest studies of animal naming and phone word recall; 3.5 and 4.5 are shown as bounds) and practice adds up to 1.0 point (0.6 published for animal naming, the rest assumed). Decline starts at the fifth check. A flag raised before decline starts is counted as a false alarm, not a detection. Recogniser misses are set at 8% and 15% as illustrations; the measured rates will replace them once the two-recogniser benchmark has run. A simulation shows how the rule behaves under stated assumptions. It does not show that the check detects disease.</p>

      <RuleChecks />

      <OlderSpeakers />

      <h2>Real data we have</h2>
      <SurveyChart />
    </>
  )
}
