import data from '../data/benchmark.json'
import SurveyChart from './SurveyChart'

const RULE: Record<string, string> = {
  ours: 'This check: two low checks in a row',
  'single-low': 'Simpler rule: one low check',
  'fixed-cutoff': 'Simpler rule: one cutoff for everyone',
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export default function Benchmark() {
  const worlds = [...new Set(data.rows.map((r) => r.world))]
  return (
    <>
      <h1>How the flag was tested</h1>
      <p><span className="tag syn">Simulated people, not patients</span></p>
      <p>The flag is the step that carries the safety decision, so it is the step we measured. Each cell below is {data.n.toLocaleString()} simulated people followed for eleven checks in a year. Run on {data.generated}; anyone can rerun it with <code>npx tsx scripts/benchmark.ts</code>.</p>

      <h2>What to take from it</h2>
      <ul>
        <li>Asking for two low checks in a row keeps false alarms in stable people to {pct(data.rows[0].falseAlarmYear)} a year, against {pct(data.rows[1].falseAlarmYear)} for one low check and {pct(data.rows[2].falseAlarmYear)} for one cutoff applied to everyone.</li>
        <li>The price is speed and sensitivity to slow change. A loss of one point per check is caught within the year in only {pct(data.rows[0].detected['1'])} of people. A loss of two points per check is caught in {pct(data.rows[0].detected['2'])}.</li>
        <li>If our measurement-error figure is too small, false alarms rise to {pct(data.rows.find((r) => r.world.startsWith('True measurement') && r.rule === 'ours')!.falseAlarmYear)} a year. That figure is still an assumption, which is why the volunteer retest matters.</li>
        <li>Words missed by the recognisers make the rule more cautious, not more alarming, because the misses also lower the baseline.</li>
      </ul>

      {worlds.map((w) => (
        <div key={w}>
          <h3>{w}</h3>
          <table>
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
          </table>
        </div>
      ))}

      <h2>Settings and limits</h2>
      <p className="muted">Simulated scores are totals with a mean of 33 and a spread between people of 6 points. One check varies within a person by 3.5 points and practice adds up to 1.5 points; both are assumptions until our volunteer data replaces them. Decline starts at the fifth check. A flag raised before decline starts is counted as a false alarm, not a detection. Recogniser misses are set at 8% and 15% as illustrations; the measured rates will replace them once the two-recogniser benchmark has run. A simulation shows how the rule behaves under stated assumptions. It does not show that the check detects disease.</p>

      <h2>Real data we have</h2>
      <SurveyChart />
    </>
  )
}
