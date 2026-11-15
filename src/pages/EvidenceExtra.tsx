import sada from '../data/sada-bench.json'
import mutation from '../data/mutation-summary.json'
import own from '../data/own-voice-summary.json'
import coverage from '../data/coverage-summary.json'
import live from '../data/live-check.json'
import reading from '../data/reading-grade.json'

type Stat = { clips: number; refWords: number; wer: number | null; werCi: (number | null)[] }
type Diff = { werDifference: number; ci: number[] } | null
type Results = Record<string, Stat> & { olderMinusAdult?: { gulf: Diff; all: Diff } }

const pts = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)
const signed = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}`
const GROUPS = ['Older, Gulf (Khaliji)', 'Adult, Gulf (Khaliji)', 'Older, other Saudi dialects', 'Adult, Najdi', 'Adult, Hijazi']
const LISTENERS: [string, string][] = [['jaisAsr', 'Jais-ASR (proposed UAE-hosted listener)'], ['appSetting', 'On-device model, as the app runs it']]

/** Word error by speaker age and dialect, on a public Saudi TV speech set. */
export function OlderSpeakers() {
  const res = sada.results as unknown as Record<string, Results>
  const jaisGulf = res.jaisAsr?.olderMinusAdult?.gulf
  return (
    <>
      <h2>Older and Gulf speakers</h2>
      <p><span className="tag">Real recordings, public data</span></p>
      <p>Before volunteers are recruited, we asked a narrower question with public data: do the listeners hear older speakers and Gulf speakers worse than other adults? SADA is a set of Saudi TV speech whose annotators labelled each clip with the speaker's age group and dialect. We took every clip labelled older ({res.jaisAsr?.['Older, all']?.clips ?? 0}, most of them Gulf) and seeded random samples of adults by dialect, and counted word errors against SADA's own transcripts.</p>
      {jaisGulf && <p><strong>Among Gulf speakers, Jais-ASR's word error was {signed(jaisGulf.werDifference)} points for older speakers against adults (95% interval {signed(jaisGulf.ci[0])} to {signed(jaisGulf.ci[1])}).</strong> No sign that it hears older Gulf speakers worse. Gulf speech was harder than Najdi or Hijazi speech at every age.</p>}
      <div className="scroll" tabIndex={0} role="region" aria-label="Word error by speaker group"><table>
        <thead><tr><th>Speakers (clips)</th>{LISTENERS.filter(([k]) => res[k]).map(([k, label]) => <th key={k}>{label}: word error</th>)}</tr></thead>
        <tbody>{GROUPS.map((g) => (
          <tr key={g}><th scope="row">{g} ({res.jaisAsr?.[g]?.clips ?? '–'})</th>{LISTENERS.filter(([k]) => res[k]).map(([k]) => {
            const s = res[k][g]
            return <td key={k}>{s && s.clips ? `${pts(s.wer)} (${pts(s.werCi[0])} to ${pts(s.werCi[1])})` : '–'}</td>
          })}</tr>
        ))}</tbody>
      </table></div>
      <p className="muted">What this does not show: these are TV programmes, not older adults doing a memory check, and sentences, not single recalled words. The on-device model makes far more errors on running speech than on the single words the check asks for (it heard {Math.round(own.whisperAlone.rate * 100)}% of real single Arabic words alone), which is why word recall is also matched against the person's own voice and a word needs two listeners to be confirmed. Age and dialect are annotators' labels; SADA gives no speaker ids, so several clips may come from one speaker and the intervals are too narrow. Licence CC BY-NC-SA 4.0, used here only to measure. Rerun with <code>scripts/sada-extract.py</code> and <code>npx tsx scripts/sada-bench.ts</code>.</p>
    </>
  )
}

/** Mutation testing of the decision rules. */
export function RuleChecks() {
  return (
    <>
      <h2>Are the rules coded the way they are written?</h2>
      <p>A test suite can pass and still miss bugs. Mutation testing checks the tests themselves: it puts one small deliberate bug at a time into the decision rules, such as a flipped comparison, a changed number or an emptied branch, and counts how many the tests catch. <strong>The tests caught {mutation.caught} of {mutation.mutants} ({Math.round(mutation.score * 100)}%).</strong></p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Mutation testing by file"><table>
        <thead><tr><th>Rule</th><th>Deliberate bugs</th><th>Caught</th></tr></thead>
        <tbody>{mutation.files.map((f) => <tr key={f.file}><th scope="row">{f.role} <span className="muted">({f.file})</span></th><td>{f.mutants}</td><td>{Math.round(f.score * 100)}%</td></tr>)}</tbody>
      </table></div>
      <p className="muted">{mutation.note} Some of the rest cannot change any result (for example, adding a constant to a sum that is always zero). Run on {mutation.generated} with {mutation.tool}; rerun with <code>npx stryker run</code>.</p>
    </>
  )
}

const pc = (x: number) => `${Math.round(x * 100)}%`

/** Coverage of the decision code, the end-to-end run on the live site, and reading grade. */
export function BuiltToBeChecked() {
  const hardest = reading.screens.flatMap((x) => x.hardest).reduce((a, b) => (b.grade > a.grade ? b : a))
  return (
    <>
      <h2>Checked end to end</h2>
      <p><strong>Every line of the decision code runs under the tests ({coverage.engine.linesCovered} of {coverage.engine.linesTotal} lines, {pc(coverage.engine.branches)} of branches), and the rules that decide what happens to a person are covered on every branch.</strong></p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Test coverage of the decision rules"><table>
        <thead><tr><th>Rule</th><th>Lines</th><th>Branches</th></tr></thead>
        <tbody>{coverage.rules.map((r) => <tr key={r.file}><th scope="row">{r.role} <span className="muted">({r.file})</span></th><td>{pc(r.lines)}</td><td>{pc(r.branches)}</td></tr>)}</tbody>
      </table></div>
      <p className="muted">{coverage.tool}, {coverage.generated}. Rerun with <code>npx tsx scripts/coverage-summary.ts</code>.</p>

      <h3>The live site, in a real browser, after every deploy</h3>
      <p>A script opens the deployed site in a headless browser and does what a judge would: it opens every screen, checks the full check stays locked until the person agrees, scores the recorded check in both languages on the device and checks it word by word against what the voice said, and takes one packet to a closed referral. <strong>{live.passed} of {live.total} steps passed on {live.ranAt.slice(0, 10)}.</strong></p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Live end-to-end run"><table>
        <thead><tr><th>Step</th><th>Result</th><th>Time</th></tr></thead>
        <tbody>{live.steps.map((x) => <tr key={x.name}><th scope="row">{x.name}</th><td>{x.ok ? 'Passed' : 'Failed'}: {x.detail}</td><td>{x.seconds} s</td></tr>)}</tbody>
      </table></div>
      <p className="muted">Headless Chromium through Playwright, against {live.url}. There is no microphone in this run, so the spoken check is scored from the recorded voice, not live speech. Rerun with <code>npx tsx scripts/live-check.ts</code>.</p>

      <h3>Can older people read it?</h3>
      <p>Plain-language guidance for patient material asks for a reading grade of 6 to 8. We measured every screen the person reads and every spoken prompt. <strong>Every one came in at grade {Math.ceil(Math.max(...reading.screens.map((x) => x.grade)))} or under</strong>; the hardest single sentence is grade {hardest.grade.toFixed(0)} ("{hardest.text}").</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Reading grade by screen"><table>
        <thead><tr><th>Screen</th><th>Words</th><th>Reading grade</th></tr></thead>
        <tbody>{reading.screens.map((x) => <tr key={x.name}><th scope="row">{x.name}</th><td>{x.words}</td><td>{x.grade.toFixed(1)}</td></tr>)}</tbody>
      </table></div>
      <p className="muted">{reading.measure}, with a rough syllable count. Arabic has no readability formula we could check, so the Arabic text is not graded; it still needs a native speaker's review. Rerun with <code>npx tsx scripts/reading-grade.ts</code>.</p>
    </>
  )
}
