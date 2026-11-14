import sada from '../data/sada-bench.json'
import mutation from '../data/mutation-summary.json'
import own from '../data/own-voice-summary.json'

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
