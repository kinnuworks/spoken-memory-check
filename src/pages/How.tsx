import { Link } from 'react-router-dom'
import { DEFAULT_PARAMS } from '../engine/change'

type L = 'working' | 'simulated' | 'proposed'
const Lbl = ({ l }: { l: L }) => <span className={`lbl ${l}`}>{l === 'working' ? 'Working' : l === 'simulated' ? 'Simulated' : 'Proposed'}</span>

const STEPS: { step: string; what: string; l: L; note: string }[] = [
  { step: '1. Screening visit', what: 'The person enrols at their adult screening visit and gives consent in four separate parts.', l: 'simulated', note: 'Consent screens work; enrolment at a real clinic is proposed.' },
  { step: '2. Spoken check at home', what: 'Four minutes by voice: sound check, ten words said back, a minute of animals, counting backwards, the words again, and one question about everyday tasks.', l: 'working', note: 'Runs in the browser today. Prompts use the device voice until native recordings exist.' },
  { step: '3. Listeners', what: "The browser's recogniser and an open model on the device hear the same speech. Each word is marked heard by both, one or neither.", l: 'working', note: 'On-device listener measured on 1,107 real recorded single words from public adult datasets: 62% right in English; in Arabic 40% with the first model, 82% with an Arabic-tuned model and near-miss matching. Browser listener not measured. On Saudi TV speech labelled by age and dialect, older Gulf speakers were heard no worse than adult Gulf speakers; no older volunteers doing the check yet.' },
  { step: '4. Personal baseline', what: 'The mean of the first three scored checks.', l: 'working', note: 'Fixed rule in code, tested.' },
  { step: '5. Meaningful change', what: `Practice-adjusted change against measurement error (${DEFAULT_PARAMS.sem} points). Flag only on two low checks in a row; reported change in everyday tasks goes to review whatever the score; a very large fall goes to urgent assessment; a failed sound check holds the check.`, l: 'working', note: 'Error figure from published studies of similar tasks; to be replaced by our own retest.' },
  { step: '6. Physician decides', what: 'The ordering physician approves, edits or dismisses a packet: trajectory, treatable contributors first, risk fields from the screening record.', l: 'simulated', note: 'Works with synthetic patients. No physician has reviewed it yet.' },
  { step: '7. In-person result', what: 'After approval the app only invites the person to a visit. Results are given in person.', l: 'simulated', note: 'Invitation template offered to the public health centre for approval.' },
  { step: '8. Referral closed', what: 'Referral to a neurologist or geriatrician tracked against a 15-working-day target, through to the appointment.', l: 'simulated', note: 'Clock works on synthetic dates.' },
  { step: '9. Programme view', what: 'Every member counted by facility: baselines done, held, packets, seen in target, lost to follow-up. Small groups suppressed.', l: 'simulated', note: 'Simulated programme year.' },
  { step: 'Own voice as the answer key', what: 'The person says each list word back once while learning it. Recall is matched against those recordings on the device (sound patterns, no transcription), in any language or dialect.', l: 'working', note: 'On 720 real single Arabic words from 30 adults: 82% right with the Arabic-tuned on-device model alone, 93% with own-voice matching added, 0.8% wrong words credited. Read words in one session, not real recall; no older speakers yet.' },
  { step: 'Jais-ASR listener (optional)', what: 'MBZUAI and Inception\'s open Arabic speech model, hosted in a UAE region and used only with consent, as a further listener beside the on-device ones.', l: 'proposed', note: 'Measured offline on 720 real single Arabic words from 30 adults: 97.1% right alone, 99.2% with own-voice matching (on-device today: 93.1%). Not deployed: it needs a GPU server in the UAE, about 1.30 US dollars an hour at list price.' },
  { step: 'Third listener (optional)', what: 'With the person\'s consent, a speech service with a Gulf Arabic model, the browser sends audio straight to the UAE North region with a short-lived token; nothing passes through or is kept on the servers of this site.', l: 'proposed', note: 'Built and switched off until a service key is added; not measured on any speaker yet.' },
  { step: 'Hearing check', what: 'Three-minute digits-in-noise test at home: three digits in noise, answered by tapping. A fail goes to the physician as an audiology referral; a weekly one-tap question tracks whether the aid is worn.', l: 'working', note: 'Digits recorded with a computer voice; the refer cut-off is a provisional setting, not validated.' },
  { step: 'Blind re-scoring', what: 'One recorded check in ten is scored again by a person who cannot see the machine score; agreement tracked by language.', l: 'working', note: 'Works on this device with the recorded clips; staff reviewers and the shared tally are proposed.' },
  { step: 'Lost signals audit', what: 'Every abnormal brain-relevant screening result with no recorded action by its target date, per 1,000 members, by signal.', l: 'simulated', note: 'Runs on a simulated programme year with stated settings.' },
  { step: '10. Hand-off', what: 'Checks and referral as FHIR R4 resources.', l: 'working', note: 'Exported as a file; a live connection to the emirate exchange is proposed.' },
]

const COMPARE: { what: string; clinic: string; tablet: string; ref: string; ours: string }[] = [
  { what: 'Where', clinic: 'Clinic', tablet: 'Clinic, tablet', ref: 'Clinic, clinician-led', ours: 'Home, by voice' },
  { what: 'How often', clinic: 'Every 1 to 3 years', tablet: 'At visits', ref: 'At visits', ours: 'Every 6 weeks or so' },
  { what: 'Needs reading or typing', clinic: 'Some items', tablet: 'Tapping images', ref: 'Tapping', ours: 'No' },
  { what: 'Compared with', clinic: 'A cutoff for everyone', tablet: 'Norms', ref: 'Own baseline', ours: 'Own baseline' },
  { what: 'Arabic', clinic: 'Arabic versions exist', tablet: 'Interface only', ref: 'Reports in Arabic', ours: 'Gulf Arabic speech, review pending' },
  { what: 'Says how sure it is', clinic: 'No', tablet: 'No', ref: 'z-score', ours: 'Range from two listeners, carried into the rule' },
  { what: 'Clinical validation', clinic: 'Yes, widely', tablet: 'Published studies', ref: 'Synthetic only', ours: 'None yet; US survey analysis and simulation' },
  { what: 'What happens after a flag', clinic: 'Referral within 15 working days', tablet: 'Clinician decides', ref: 'Clinician signs off', ours: 'Physician approves, in-person visit, referral tracked to closure' },
]

export default function How() {
  return (
    <>
      <h1>How it works, and what is real</h1>
      <p>Every part is labelled: <Lbl l="working" /> runs today, <Lbl l="simulated" /> runs on synthetic people or dates, <Lbl l="proposed" /> is planned.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="What each part does and whether it is real"><table>
        <thead><tr><th>Step</th><th>What happens</th><th>Status</th></tr></thead>
        <tbody>{STEPS.map((s) => <tr key={s.step}><td><strong>{s.step}</strong></td><td>{s.what}<br /><span className="muted">{s.note}</span></td><td><Lbl l={s.l} /></td></tr>)}</tbody>
      </table></div>
      <h2>Where a language model sits</h2>
      <p>Nowhere. Speech recognition turns sound into words. Everything after that, the matching, the scores, the flags, the routing, is fixed rules in code that give the same answer every time. Patient wording is fixed templates.</p>
      <h2>Next to what exists</h2>
      <p className="muted">"Clinic test" is the memory test at the screening visit; "tablet tests" are commercial cognitive tests used in clinics; "reference build" is the clinician-facing prototype shown in the organisers' session on 4 Nov. Filled in from public information, as fairly as we can.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Next to what exists"><table>
        <thead><tr><th><span className="sr-only">Feature</span></th><th>Clinic test</th><th>Tablet tests</th><th>Reference build</th><th>This check</th></tr></thead>
        <tbody>{COMPARE.map((c) => <tr key={c.what}><th scope="row"><strong>{c.what}</strong></th><td>{c.clinic}</td><td>{c.tablet}</td><td>{c.ref}</td><td>{c.ours}</td></tr>)}</tbody>
      </table></div>
      <p>This check does not replace the clinic test. It fills the years between clinic tests and cannot detect impairment already present at enrolment.</p>
      <h2>Path to a pilot</h2>
      <p>A 12-month feasibility pilot at one screening provider, after ethics approval. Members aged 50 to 64 are randomised at the screening visit to usual care, or usual care plus a check about every six weeks: 250 per arm, sized on baseline completion (55% expected, within 7 points). It also measures agreement with a human listener and retest, by language, age and schooling. True decline is too rare at 50 to 64 for one site to measure detection, so the pilot does not claim to.</p>
      <p>Stop and review if physicians dismiss more than half of packets over three months, if there is more than one distress complaint per 100 members, if any serious event shows a home check delayed care, or if more than 20% of checks cannot be scored. Full design in <code>docs/PILOT.md</code>.</p>
      <h2>Questions people ask</h2>
      <div className="faq">
        <details><summary>Does it diagnose dementia?</summary><p>No. It looks for change against the person's own earlier checks and asks a physician to decide what to do. A score in the usual range does not rule out impairment, and the clinic memory test at the screening visit continues as before.</p></details>
        <details><summary>Why by voice?</summary><p>Many older adults in the Gulf had little schooling, and tests that need reading, typing or tapping are unfair to them. Saying words back and naming animals is how memory has been tested over the telephone for decades.</p></details>
        <details><summary>Where does my voice go?</summary><p>The speech model on the device sends nothing anywhere. The browser's own recogniser may send audio to the browser's maker. In a pilot, any cloud listener would run in a UAE region and only with the regulator's approval.</p></details>
        <details><summary>What if I don't hear well?</summary><p>Every check starts with a sound check. If it fails, the check is held, not scored low. After two held checks the app suggests a hearing test, which also makes later checks fairer.</p></details>
        <details><summary>Has it been tested on real people?</summary><p>Partly. On 720 real recordings of single Arabic words from 30 adult volunteers, the first on-device model heard 40% right. An Arabic-tuned model with careful matching heard 82%, and adding each speaker's own voice as the answer key raised that to 93%, with under 1% of wrong words credited. In English the on-device model heard 62%. These are read words, not recall. On public Saudi TV speech, both listeners heard older Gulf speakers no worse than adult Gulf speakers, but no older volunteers have done the check yet. Every recording can also be scored by a person.</p></details>
        <details><summary>Who sees the scores?</summary><p>Only the ordering physician at the screening clinic, and only if the person agreed. The person hears about any result at an in-person visit.</p></details>
      </div>
      <div className="stack"><Link className="btn" to="/programme">Programme view</Link><Link className="btn" to="/benchmark">How the flag was tested</Link></div>
    </>
  )
}
