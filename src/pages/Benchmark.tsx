import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import sada from '../data/sada-bench.json'
import coverage from '../data/coverage-summary.json'
import mutation from '../data/mutation-summary.json'
import live from '../data/live-check.json'
import SurveyChart from './SurveyChart'
import { BuiltToBeChecked, OlderSpeakers, RuleChecks, ValidationTable } from './EvidenceExtra'

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
      <h1>Evidence</h1>
      <h2>At a glance</h2>
      <div className="scroll" tabIndex={0} role="region" aria-label="Evidence at a glance"><table>
        <thead><tr><th>Question</th><th>What we found</th><th>Kind</th></tr></thead>
        <tbody>
          <tr><th scope="row">Does it hear Arabic words?</th><td>{Math.round(own.union.rate * 100)}% of {own.union.n} real single words from {own.speakers} adults, on the device, with the speaker's own voice as the answer key</td><td>Real recordings</td></tr>
          <tr><th scope="row">Does it hear older Gulf speakers worse?</th><td>No sign of it: word error {Math.round(sada.results.jaisAsr['Older, Gulf (Khaliji)'].wer * 100)}% for older against {Math.round(sada.results.jaisAsr['Adult, Gulf (Khaliji)'].wer * 100)}% for adult Gulf speakers (Jais-ASR); the on-device model also did no worse</td><td>Real recordings, public TV speech</td></tr>
          <tr><th scope="row">Is one cutoff fair?</th><td>No: it flags 48% of healthy adults with under 9 years of school against 16% of graduates</td><td>Real survey, US</td></tr>
          <tr><th scope="row">Does the flag avoid false alarms?</th><td>{pct(data.rows.find((r) => r.world === 'As assumed' && r.rule === 'ours')!.falseAlarmYear)} a year in stable people; {pct(det(now, '2'))} of people losing 2 points a check flagged within the year, {pct(det(now, '1'))} at 1 point</td><td>Simulated</td></tr>
          <tr><th scope="row">Is the code tested?</th><td>{coverage.engine.linesCovered} of {coverage.engine.linesTotal} lines run by the tests; {Math.round(mutation.score * 100)}% of {mutation.mutants} deliberate bugs caught; live site {live.passed} of {live.total} end to end</td><td>Code</td></tr>
          <tr><th scope="row">Does it work in patients?</th><td>Not measured. No patients, no older Emirati volunteers and no retest yet</td><td>Pending</td></tr>
        </tbody>
      </table></div>

      <ValidationTable />

      <h2>How the flag was tested</h2>
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
      <p><strong>Why one point a check is still often missed.</strong> We tried two other ways to catch it on the tuning seed. A rule that looks for the point where a stable line starts to fall caught the same share as the straight line at the same false-alarm rate. Adding one extra check a month later for anyone whose line starts to fall lifted it only to about half, for nearly one extra check per person. The limit is the check's own noise, about 4 points either way on a single day, measured four times a year; a second short task or more frequent checks would help more than a cleverer rule.</p>

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
      <BuiltToBeChecked />

      <OlderSpeakers />

      <h2>Real data we have</h2>
      <SurveyChart />
    </>
  )
}
