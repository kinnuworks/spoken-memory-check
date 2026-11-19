import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import sada from '../data/sada-bench.json'
import coverage from '../data/coverage-summary.json'
import mutation from '../data/mutation-summary.json'
import live from '../data/live-check.json'
import phone from '../data/phone-check.json'
import mic from '../data/mic-check.json'
import SurveyChart from './SurveyChart'
import { BuiltToBeChecked, OlderSpeakers, RuleChecks, ValidationTable } from './EvidenceExtra'

const RULE: Record<string, string> = {
  ours: 'This check: the last two checks together well below baseline, or a slowly falling line',
  previous: 'Previous rule: each of two checks in a row low, or a line falling on two checks in a row',
  'two-in-a-row': 'First rule: two low checks in a row only',
  'single-low': 'Simpler rule: one low check',
  'fixed-cutoff': 'Simpler rule: one cutoff for everyone',
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const gb = (mb: number) => (mb / 1024).toFixed(1)
const phoneRows = (lang: string) => phone.rows.filter((r) => r.lang === lang)
const phoneRange = (lang: string) => { const m = phoneRows(lang).map((r) => r.addedMemoryMB); return `${gb(Math.min(...m))} to ${gb(Math.max(...m))} GB` }

export default function Benchmark() {
  const b2 = data.burden.find((b) => b.prevalence === 0.02)!
  const worlds = [...new Set(data.rows.map((r) => r.world))]
  const row = (world: string, rule: string) => data.rows.find((r) => r.world.includes(world) && r.rule === rule)!
  const det = (r: (typeof data.rows)[number], s: string) => (r.detected as Record<string, number>)[s]
  const now = row('As assumed', 'ours'), prev = row('As assumed', 'previous'), before = row('As assumed', 'two-in-a-row')
  const upNow = row('upper bound', 'ours'), upPrev = row('upper bound', 'previous'), upBefore = row('upper bound', 'two-in-a-row')
  const sudden = (rule: string) => data.sudden.find((x) => x.rule === rule)!
  const cols = [{ r: before, s: sudden('two-in-a-row'), b: data.burdenBefore, up: upBefore }, { r: prev, s: sudden('previous'), b: data.burdenPrevious, up: upPrev }, { r: now, s: sudden('ours'), b: data.burden, up: upNow }]
  const med = (m: Record<string, number | null>, keys: string[]) => keys.map((k) => m[k] ?? '–').join(' / ')
  const b2prev = data.burdenPrevious.find((b) => b.prevalence === 0.02)!
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
          <tr><th scope="row">Does it run on phones?</th><td>In the browser engines of iPhone and Android phones, run on a laptop with phone screen sizes: {phone.rows.every((r) => r.ran) ? 'yes' : 'not in every case'}, scoring {phoneRows('en')[0].animals} of 20 English and {phoneRows('ar')[0].animals} of 20 Arabic animals, as on a laptop. The page needs about {phoneRange('en')} more memory for English and {phoneRange('ar')} for Arabic while the model runs; whether a given phone allows that is only known on the phone. If it does not, the page says so next time and offers the browser's speech service or typing. Tried once on one real phone, the team's own (19 Nov): the English and Arabic recorded checks both scored on the device. Its model and browser were not written down</td><td>Phone engines, and one real phone</td></tr>
          <tr><th scope="row">Does it work through a microphone?</th><td>{mic.rows.filter((r) => r.lang !== 'silence').every((r) => r.ok) ? 'Yes' : 'Not in every case'}, with a computer voice fed in as the browser's microphone: "Try it with your voice" passed the sound check and credited {mic.rows.filter((r) => r.lang !== 'silence').map((r) => (r.detail.match(/(\d+) animals? credited/) ?? [])[1] ?? '?').join(' (English) and ')} (Arabic) animals in 20 seconds, each one the voice said. With silence as the microphone the sound check failed and nothing was scored. Not yet tried with a person</td><td>Our own test, computer voice</td></tr>
          <tr><th scope="row">Is the code tested?</th><td>{coverage.engine.linesCovered} of {coverage.engine.linesTotal} lines run by the tests; {Math.round(mutation.score * 100)}% of {mutation.mutants} deliberate bugs caught; live site {live.passed} of {live.total} end to end</td><td>Code</td></tr>
          <tr><th scope="row">Does it work in patients?</th><td>Not measured. No patients, no older Emirati volunteers and no retest yet</td><td>Pending</td></tr>
        </tbody>
      </table></div>

      <ValidationTable />

      <h2>How the flag was tested</h2>
      <p><span className="tag syn">Simulated people, not patients</span></p>
      <p>The flag is the step that carries the safety decision, so it is the step we measured. Each cell below is {data.n.toLocaleString()} simulated people followed for eleven checks in a year. Run on {data.generated}; anyone can rerun it with <code>npx tsx scripts/benchmark.ts</code>.</p>

      <h2>Slow decline: what changed and what it cost</h2>
      <p>The first rule raised a packet only when each of two checks in a row fell well below the person's baseline. Within the year it caught {pct(det(before, '1'))} of simulated people losing one point a check. A second route then drew a straight line through every scored check and raised a packet when the line fell more than measurement error explains on two checks in a row: {pct(det(prev, '1'))}. In this version two things changed. The rule now tests the last two checks by their average, so one very low check and one a little low count as much as two moderately low ones. And the line raises a packet the first time it falls far enough, since it already uses every check. That catches {pct(det(now, '1'))}.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Three versions of the rule compared"><table>
        <thead><tr><th>Measure (simulated)</th><th>First rule: two in a row only</th><th>Previous rule</th><th>Now</th></tr></thead>
        <tbody>
          {['1', '2', '3'].map((k) => <tr key={k}><th scope="row">Caught within the year, losing {k} point{k === '1' ? '' : 's'} per check</th>{cols.map((c, i) => <td key={i}>{pct(det(c.r, k))}</td>)}</tr>)}
          <tr><th scope="row">Median checks from start of decline to packet (1 / 2 / 3 points)</th>{cols.map((c, i) => <td key={i}>{med(c.r.medianChecksToFlag as Record<string, number | null>, ['1', '2', '3'])}</td>)}</tr>
          <tr><th scope="row">Caught within the year, sudden lasting drop of 6 / 8 / 10 points</th>{cols.map((c, i) => <td key={i}>{['6', '8', '10'].map((k) => pct((c.s.detected as Record<string, number>)[k])).join(' / ')}</td>)}</tr>
          <tr><th scope="row">Median checks to packet after a sudden drop (6 / 8 / 10 points)</th>{cols.map((c, i) => <td key={i}>{med(c.s.medianChecksToFlag as Record<string, number | null>, ['6', '8', '10'])}</td>)}</tr>
          <tr><th scope="row">False alarms in a year, stable people</th>{cols.map((c, i) => <td key={i}>{pct(c.r.falseAlarmYear)}</td>)}</tr>
          <tr><th scope="row">False alarms if each check varies by 4.5 points, not 4.0</th>{cols.map((c, i) => <td key={i}>{pct(c.up.falseAlarmYear)}</td>)}</tr>
          {data.burden.map((b, j) => <tr key={b.prevalence}><th scope="row">Packets per 1,000 a year with {pct(b.prevalence)} in real decline (real ones)</th>{cols.map((c, i) => <td key={i}>{c.b[j].packetsPer1000.toFixed(0)} ({c.b[j].realPer1000.toFixed(0)})</td>)}</tr>)}
        </tbody>
      </table></div>
      <p className="muted">The cut-offs were fixed before these numbers were run, on a separate set of simulated people (seed {data.trend.tuningSeed}): the average of the last two checks at z {data.trend.pairZ} or lower, and the line's slope over its error at {data.trend.trendZ} or lower, from {data.trend.trendMinChecks} scored checks on (baseline included). They were the setting that caught the most one-point decline while keeping false alarms at or under 5% a year (4.9% on the tuning seed) and catching sudden drops no later than the previous rule. On the seed behind this page ({data.trend.reportSeed}) false alarms came out at {pct(now.falseAlarmYear)}, a little over 5%; we report that rather than tune again on these numbers. The price against the previous rule is about {(b2.packetsPer1000 - b2prev.packetsPer1000).toFixed(0)} more packets per 1,000 members a year, of which about {(b2.realPer1000 - b2prev.realPer1000).toFixed(0)} is real. A slow loss of one point per check is still missed within the year in about half of simulated people.</p>
      <p><strong>Why one point a check is still often missed.</strong> On the tuning seed we also tried adding up small drops check by check, which caught less, and earlier a rule that looks for the point where a stable line starts to fall, which caught no more. The limit is the check's own noise: about 4 points either way on a single day, measured about every six weeks, so one point a check is a quarter of the day-to-day wobble. A second short task or more frequent checks would help more than a cleverer rule.</p>

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
        <li>Slow change is still the weak spot. A loss of one point per check is caught within the year in {pct(det(now, '1'))} of people ({pct(det(prev, '1'))} with the previous rule, {pct(det(before, '1'))} with the first rule). A loss of two points per check is caught in {pct(det(now, '2'))}.</li>
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
