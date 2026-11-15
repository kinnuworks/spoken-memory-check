// The home page in each of the three design directions being compared. Every figure is read from the
// same data files as the main home page; the people are the synthetic personas the rule runs on.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import tests from '../data/tests.json'
import sada from '../data/sada-bench.json'
import mutation from '../data/mutation-summary.json'
import coverage from '../data/coverage-summary.json'
import live from '../data/live-check.json'
import { COST_DEFAULTS, yearlyCost } from '../engine/cost'
import { evaluate, PACKET_STATUSES, STATUS_LABEL, type Trajectory } from '../engine/change'
import { PERSONAS, type Persona } from '../engine/histories'
import { treatableContributors } from '../engine/packet'
import { Alert, Arrow, Check, Clock, Code, Ear, EyeOff, List, Mic, Moon, Stethoscope, Waves } from '../components/Icons'
import type { Dir } from '../components/direction'
import { SurveyBars } from './SurveyChart'
import TrajectoryChart from './TrajectoryChart'

const rows = data.rows.filter((r) => r.world === 'As assumed')
const ours = rows.find((r) => r.rule === 'ours')!
const single = rows.find((r) => r.rule === 'single-low')!
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const arabic = Math.round(own.union.rate * 100)
const older = Math.round(sada.results.jaisAsr['Older, Gulf (Khaliji)'].wer * 100)
const adult = Math.round(sada.results.jaisAsr['Adult, Gulf (Khaliji)'].wer * 100)
const lowStart = data.byStart.lowStart
const perMember = Math.round(yearlyCost().perEligibleAed)
const decline = PERSONAS.find((p) => p.id === 'decline')!
const declineTraj = evaluate(decline.checks)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
const aed = (x: number) => `AED ${Math.round(x).toLocaleString('en')}`

const H1_SHORT = 'A memory check you speak'
const H1_LONG = 'A memory check you speak, tracked against yourself.'

const FACTS = [
  { n: `${arabic}%`, t: `of ${own.whisperAlone.n} real Arabic words heard on the device` },
  { n: `${older}% vs ${adult}%`, t: 'word error, older against adult Gulf speakers' },
  { n: '52-45 and 52-46', t: 'the Thiqa packages it fills the memory step of' },
  { n: '0 errors', t: 'from the official HL7 FHIR validator' },
]

const ROUTES = [
  { icon: <Ear />, t: 'Hearing comes first', d: 'A failed sound check holds a check instead of scoring it low.', tags: ['Digits in noise', 'Held, not low'] },
  { icon: <Moon />, t: 'Off days do not count', d: 'A low score on a day the person says was off is left out.', tags: ['Said by the person', 'Left out'] },
  { icon: <List />, t: 'Everyday tasks override scores', d: 'A yes to the everyday-tasks question goes to the physician whatever the scores say.', tags: ['One spoken question', 'Physician'] },
  { icon: <Alert />, t: 'Very large falls go urgent', d: 'A fall far outside normal variation tells the person to see a doctor the same day.', tags: ['Same day', 'Urgent'] },
  { icon: <EyeOff />, t: 'No scores at home', d: 'The person sees dated ticks and a thank-you. Results are given in person.', tags: ['Dated ticks', 'In person'] },
  { icon: <Code />, t: 'Fixed rules anyone can read', d: 'A short rule in code makes every decision. No language model anywhere.', tags: ['Rule in code', 'No language model'] },
]

/* ------------------------------------------------------------------ */
/* Shared product pieces                                               */
/* ------------------------------------------------------------------ */

/** What the rule did for one synthetic person, step by step, from its own output. */
function ruleSteps(p: Persona, t: Trajectory) {
  const s: { label: string; tag: string }[] = []
  if (t.baseline !== null) s.push({ label: `Baseline from the first three checks: ${t.baseline.toFixed(1)}`, tag: 'Personal baseline' })
  const held = p.checks.filter((c) => c.hearingLimited).length
  const off = p.checks.filter((c) => c.offDay).length
  const missed = p.checks.filter((c) => c.low === null && !c.hearingLimited).length
  if (off) s.push({ label: `${off === 1 ? 'One off day' : `${off} off days`} left out of the comparison`, tag: 'Off days' })
  if (missed) s.push({ label: `${missed === 1 ? 'One missed check' : `${missed} missed checks`}, not counted as low`, tag: 'Missed' })
  if (held) s.push({ label: `${held === 1 ? 'One check' : `${held} checks`} held after a failed sound check`, tag: 'Hearing first' })
  const st = t.status
  if (st === 'flag') s.push({ label: 'Lower than the baseline twice in a row', tag: 'Two-in-a-row route' })
  if (st === 'trend') s.push({ label: 'Falling steadily across all checks', tag: 'Slow-fall route' })
  if (st === 'review') s.push({ label: 'Everyday tasks reported harder', tag: 'Everyday tasks' })
  if (st === 'urgent') s.push({ label: 'A very large fall between two checks', tag: 'Urgent route' })
  if (st === 'usual-range' || st === 'watch' || st === 'building-baseline') s.push({ label: held >= 2 ? 'Pointed to a hearing assessment' : 'Latest check within the usual range', tag: STATUS_LABEL[st] })
  return s.slice(-4)
}

function outcome(t: Trajectory, p: Persona) {
  if (PACKET_STATUSES.includes(t.status)) return { ok: false, text: 'Packet sent to the ordering physician', side: 'The physician approves before anyone is told.' }
  if (t.status === 'urgent') return { ok: false, text: 'Told to seek urgent assessment', side: 'The routine flow is bypassed.' }
  if (p.checks.filter((c) => c.hearingLimited).length >= 2) return { ok: true, text: 'Held for hearing, nothing sent', side: 'The person sees: Check received. Thank you.' }
  return { ok: true, text: 'Nothing sent', side: 'The person sees: Check received. Thank you.' }
}

function ChartKey() {
  return (
    <p className="d-key">
      <span><i className="d-key__dot d-key__dot--ok" />In the usual range</span>
      <span><i className="d-key__dot d-key__dot--flag" />Below the baseline</span>
      <span><i className="d-key__line" />Personal baseline</span>
    </p>
  )
}

const CHIP: Record<string, string> = { stable: 'Steady', practice: 'Practice gain', decline: 'Steady fall', hearing: 'Hearing hold', function: 'Everyday tasks', urgent: 'Very large fall' }

/** The rule run live on any of the six synthetic people, with "try another" chips. */
function RuleWindow({ brand }: { brand: string }) {
  const [id, setId] = useState('decline')
  const p = PERSONAS.find((x) => x.id === id)!
  const t = evaluate(p.checks)
  const o = outcome(t, p)
  const icons = [<List key="l" />, <Waves key="w" />, <Stethoscope key="s" />, <Clock key="c" />, <Ear key="e" />]
  return (
    <div className="b-stage">
      <div className="b-window">
        <div className="b-window__rail" aria-hidden="true">{icons.map((ic, i) => <span key={i} className={i === 1 ? 'is-on' : ''}>{ic}</span>)}</div>
        <div className="b-window__main">
          <div className="b-window__bar">
            <span className="b-window__brand"><Waves />{brand}</span>
            <span className="b-window__crumbs"><span>Checks</span><span aria-hidden="true">›</span><b>{p.name}, synthetic</b></span>
            <span className={`b-status ${o.ok ? 'is-ok' : 'is-flag'}`}><i />{STATUS_LABEL[t.status]}</span>
          </div>
          <div className="b-window__body">
            <div className="b-pane">
              <p className="b-pane__who"><span className="b-avatar">{p.name.slice(0, 1)}</span><span><b>{p.name}</b><small>{p.path}</small></span></p>
              <div className="b-chart"><TrajectoryChart checks={p.checks} traj={t} compact /></div>
              <ChartKey />
            </div>
            <div className="b-pane b-pane--steps">
              <p className="b-steps__head"><List />What the rule did <span className="b-ver">rule of record</span></p>
              <ol className="b-steps">
                {ruleSteps(p, t).map((s) => <li key={s.label}><span className="b-tick"><Check /></span><span>{s.label}</span><small>{s.tag}</small></li>)}
              </ol>
              <p className="b-steps__foot"><span className={`b-dot ${o.ok ? 'is-ok' : 'is-flag'}`} /><b>{o.text}</b><small>{o.side}</small></p>
            </div>
          </div>
        </div>
      </div>
      <div className="b-try">
        <span>Try another person</span>
        {PERSONAS.map((x) => (
          <button key={x.id} type="button" className={`b-chip${x.id === id ? ' is-on' : ''}`} aria-pressed={x.id === id} onClick={() => setId(x.id)}>{CHIP[x.id] ?? x.path}</button>
        ))}
      </div>
    </div>
  )
}

/** Modelled yearly cost for one provider, with the uptake slider. */
function CostPanel() {
  const [uptake, setUptake] = useState(COST_DEFAULTS.uptake)
  const c = yearlyCost({ ...COST_DEFAULTS, uptake })
  const id = useId()
  return (
    <div className="d-cost">
      <div className="d-cost__stats">
        <div><small>Per eligible member a year</small><b>{aed(c.perEligibleAed)}</b></div>
        <div><small>Physician packets a year</small><b>{c.packets.toLocaleString('en')}</b></div>
      </div>
      <label className="d-cost__slider" htmlFor={id}>Members who take part: <strong>{Math.round(uptake * 100)}%</strong>
        <input id={id} type="range" min={0.1} max={0.8} step={0.05} value={uptake} onChange={(e) => setUptake(Number(e.target.value))} />
      </label>
      <table className="d-cost__table">
        <tbody>
          {c.lines.map((l) => <tr key={l.name}><th scope="row">{l.name}</th><td>{aed(l.aed)}</td></tr>)}
          <tr><th scope="row"><b>Total a year, {COST_DEFAULTS.eligible.toLocaleString('en')} members</b></th><td><b>{aed(c.totalAed)}</b></td></tr>
        </tbody>
      </table>
      <p className="d-note">Modelled, not measured: most inputs are our assumptions until a pilot measures them. No partner has agreed yet.</p>
    </div>
  )
}

function PacketCard({ chartText }: { chartText?: number }) {
  const contributors = treatableContributors(decline.record).slice(0, 3)
  return (
    <div className="d-packet">
      <p className="d-packet__head"><b>Physician's packet</b><span>{decline.name}, synthetic</span></p>
      <p className="d-packet__sub">{STATUS_LABEL[declineTraj.status]}: baseline {(declineTraj.baseline as number).toFixed(1)}</p>
      <TrajectoryChart checks={decline.checks} traj={declineTraj} compact textSize={chartText} />
      <ChartKey />
      <p className="d-packet__label">Treatable contributors to check first</p>
      {contributors.map((c) => <p className="d-packet__row" key={c.name}><b>{c.name}</b><span>{c.action}</span></p>)}
      <p className="d-packet__actions"><Link to="/clinician" className="d-btn d-btn--sm">Approve and invite to a visit</Link><Link to="/clinician" className="d-btn d-btn--ghost d-btn--sm">Dismiss with a reason</Link></p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Direction a: on Duna's system                                        */
/* ------------------------------------------------------------------ */

function HomeA() {
  return (
    <main className="dh dh-a">
      <section className="a-hero">
        <img className="a-hero__art" src="/images/hero-painting.webp" srcSet="/images/hero-painting-1024.webp 1024w, /images/hero-painting.webp 2048w" sizes="100vw" width={2048} height={1152} alt="" fetchPriority="high" />
        <div className="a-hero__copy">
          <Link to="/benchmark" className="a-pill">{arabic}% of real Arabic words heard on the device <span aria-hidden="true">›</span></Link>
          <h1>{H1_SHORT}</h1>
          <p className="a-lead">Four minutes at home in Gulf Arabic or English. Nothing to read or type. Compared with your own past checks.</p>
          <Link to="/try" className="a-btn a-btn--lg">Try it with your voice</Link>
        </div>
      </section>

      <section className="a-facts">
        <p className="a-facts__cap">Measured so far, before any patients</p>
        <ul>{FACTS.map((f) => <li key={f.n}><b>{f.n}</b><span>{f.t}</span></li>)}</ul>
      </section>

      <section className="a-sec">
        <div className="a-wrap">
          <h2>The person speaks.<br />A physician decides.</h2>
          <div className="a-cols">
            <div><Mic /><p className="a-col__t">Three listeners</p><p>The browser's recogniser and a speech model on the device hear the same words.</p></div>
            <div><Waves /><p className="a-col__t">Compared with yourself</p><p>The first three checks set a baseline. Later checks are compared with it.</p></div>
            <div><Stethoscope /><p className="a-col__t">A physician decides</p><p>After two low checks in a row, a physician approves first.</p></div>
          </div>
        </div>
      </section>

      <section className="a-sec">
        <div className="a-wrap a-quote">
          <div className="a-quote__text">
            <p className="a-quote__big">One cutoff for everyone flags the wrong people.</p>
            <p className="a-quote__by">In the Gulf, the usual MoCA cut-off classed 69.3% of 606 older adults in Dubai and Sharjah as impaired (<a href="https://doi.org/10.3389/fragi.2026.1822042">Issa et al. 2026</a>).</p>
          </div>
          <div className="a-panel a-quote__panel">
            <p className="a-panel__t">Adults over 60 with no memory complaint below a fixed cutoff of 14 animals</p>
            <SurveyBars />
            <p className="d-note">Our analysis of NHANES 2011 to 2014, a public US survey: 265 adults with under 9 years of school, 569 graduates.</p>
          </div>
        </div>
      </section>

      <section className="a-band">
        <img className="a-band__art" src="/images/hero-painting.webp" alt="" loading="lazy" decoding="async" width={2048} height={1152} />
        <ul className="a-band__pills" aria-label="Routes built into the rule">
          {ROUTES.map((r, i) => <li key={r.t} className={`a-float a-float--${i + 1}`}>{r.t}</li>)}
        </ul>
        <div className="a-band__copy">
          <h2>Low scores have more than one cause.</h2>
          <p>Six routes in the rule keep a low score from being read as decline, and send the hard cases to a person.</p>
          <Link to="/how" className="a-btn">How it works</Link>
        </div>
      </section>

      <section className="a-sec">
        <div className="a-wrap a-split">
          <div className="a-split__text">
            <span className="a-tag">On the device</span>
            <h2 className="a-h3">Every score shows how sure it is</h2>
            <p className="a-sub">A word heard by two listeners counts. A word heard by one widens the range.</p>
            <ul className="a-rows">
              <li><Check />A word heard by both listeners counts</li>
              <li><Waves />A word heard by one widens the range</li>
              <li><EyeOff />A range too wide is not scored, never low</li>
            </ul>
          </div>
          <div className="a-panel a-panel--cards">
            <div className="a-card"><p className="a-card__t">A, 58, synthetic: a year of checks</p><TrajectoryChart checks={PERSONAS[0].checks} traj={evaluate(PERSONAS[0].checks)} compact textSize={22} /><ChartKey /><p className="d-note">Each bar is the range the listeners heard at one check.</p></div>
          </div>
          <Link to="/recorded" className="a-explore">Play a recorded check <span aria-hidden="true">›</span></Link>
        </div>
      </section>

      <section className="a-sec">
        <div className="a-wrap a-split a-split--flip">
          <div className="a-split__text">
            <span className="a-tag">Physician's view</span>
            <h2 className="a-h3">A physician reads the packet before anyone is told</h2>
            <p className="a-sub">The trajectory, the treatable causes to rule out first and the risk factors already on record.</p>
            <ul className="a-rows">
              <li><Check />Approve, edit or dismiss</li>
              <li><Stethoscope />Treatable causes first</li>
              <li><Clock />Tracked to the 15-working-day target</li>
              <li><Code />HL7 v2 for Malaffi and FHIR R4</li>
            </ul>
          </div>
          <div className="a-panel a-panel--cards"><PacketCard chartText={22} /></div>
          <Link to="/clinician" className="a-explore">Open the physician's view <span aria-hidden="true">›</span></Link>
        </div>
      </section>

      <section className="a-grey">
        <div className="a-wrap a-split">
          <div className="a-split__text">
            <h2 className="a-h3">About AED {perMember} per eligible member a year</h2>
            <p className="a-sub">Thiqa's packages 52-45 and 52-46 already fund hearing and dementia screening and name no memory tool. This check adds the memory step at home, for people already in the programme.</p>
            <ul className="a-badges"><li>FHIR R4<small>0 errors</small></li><li>HL7 v2<small>for Malaffi</small></li><li>Consent<small>off by default</small></li></ul>
          </div>
          <div className="a-panel a-panel--white"><CostPanel /></div>
        </div>
      </section>

      <section className="a-sec">
        <div className="a-wrap">
          <h2 className="a-h3">What we measured, and what we have not</h2>
          <div className="a-stories">
            <Link to="/benchmark" className="a-story"><span className="a-story__art" style={{ backgroundPosition: '30% 40%' }}><b>{arabic}%</b></span><p className="a-story__t">of real Arabic words heard right</p><p>{own.whisperAlone.n} single words from {own.speakers} adult volunteers, scored on the device with the speaker's own voice as the answer key. Read words, not recall.</p></Link>
            <Link to="/benchmark" className="a-story"><span className="a-story__art" style={{ backgroundPosition: '70% 30%' }}><b>{pct1(ours.falseAlarmYear)}</b></span><p className="a-story__t">false alarms a year, simulated</p><p>In stable people, against {pct1(single.falseAlarmYear)} for a rule that flags on one low check. {Math.round(ours.detected['2'] * 100)}% of people losing two points a check are flagged within the year.</p></Link>
            <Link to="/how" className="a-story"><span className="a-story__art" style={{ backgroundPosition: '50% 60%' }}><b>{tests.passed}</b></span><p className="a-story__t">tests on the decision code</p><p>They run {Math.round(coverage.engine.lines * 100)}% of its lines and catch {Math.round(mutation.score * 100)}% of {mutation.mutants} deliberate bugs. The live site passes {live.passed} of {live.total} end-to-end steps after each deploy.</p></Link>
          </div>
        </div>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Direction b: on Brainfish's system                                   */
/* ------------------------------------------------------------------ */

function DotGrid({ share, tone }: { share: number; tone: 'flag' | 'ok' }) {
  const on = Math.round(share * 100)
  return <div className={`b-dots b-dots--${tone}`} aria-hidden="true">{Array.from({ length: 100 }, (_, i) => <i key={i} className={i < on ? 'is-on' : ''} />)}</div>
}

function HomeB() {
  return (
    <main className="dh dh-b">
      <section className="b-hero">
        <div className="b-hero__copy">
          <Link to="/benchmark" className="b-pill"><span className="b-pill__tag">Measured</span>{arabic}% of {own.whisperAlone.n} real Arabic words heard on the device <Arrow /></Link>
          <h1>{H1_LONG}</h1>
          <p className="b-lead">Four minutes at home in Gulf Arabic or English, with nothing to read or type. A physician hears about it only after two low checks in a row.</p>
          <Link to="/try" className="b-btn">Try it with your voice <Arrow /></Link>
          <p className="b-fine"><span><Check />No sign-up</span><span><EyeOff />People shown are synthetic</span></p>
        </div>
        <RuleWindow brand="Spoken memory check" />
      </section>

      <section className="b-stats">
        {[
          { l: 'Real recordings', n: `${arabic}%`, t: `of ${own.whisperAlone.n} Arabic words heard right on the device` },
          { l: 'Simulated', n: pct1(ours.falseAlarmYear), t: 'false alarms a year in stable people' },
          { l: 'Simulated', n: `${Math.round(ours.detected['2'] * 100)}%`, t: 'of people losing two points a check flagged within a year' },
          { l: 'Official validator', n: '0', t: 'errors in the FHIR R4 export' },
        ].map((s, i) => <div key={i}><p className="b-stats__l">{s.l}</p><p className="b-stats__n">{s.n}</p><p className="b-stats__t">{s.t}</p></div>)}
      </section>

      <section className="b-sec">
        <h2>One cutoff for everyone flags the wrong people.</h2>
        <div className="b-split">
          <div>
            <p className="b-big">48%</p>
            <p className="b-body">of adults over 60 with under 9 years of school and no memory complaint fall below a fixed cutoff of 14 animals, against 16% of graduates. Our analysis of NHANES 2011 to 2014, US data.</p>
          </div>
          <div className="b-qs">
            <p className="b-q"><i />Dubai and Sharjah: 69.3% of 606 older adults below the usual MoCA cut-off</p>
            <p className="b-q"><i />Qatar: 74.3% of 308 healthy adults below it</p>
            <p className="b-q"><i />Comparing each person with their own earlier checks avoids this</p>
          </div>
        </div>
        <Link to="/how" className="b-link"><Arrow />How the personal baseline works</Link>
      </section>

      <section className="b-dark">
        <div className="b-dark__in">
          <div className="b-dark__lead">
            <p className="b-big b-big--light">{pct1(lowStart.ours)}</p>
            <p className="b-body b-body--light">of stable people who start in the lowest fifth get a false packet in a year with a personal baseline, against <span className="b-hl">{pct1(lowStart.fixedCutoff)}</span> with one cutoff for everyone. Simulated, {lowStart.people.toLocaleString('en')} people.</p>
            <Link to="/benchmark" className="b-link b-link--light">How the flag was tested</Link>
          </div>
          <div className="b-cards">
            {ROUTES.map((r) => (
              <div className="b-card" key={r.t}>
                <p className="b-card__t">{r.t}</p>
                <p className="b-card__tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</p>
                <p className="b-card__foot"><i />Built into the rule</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="b-dark b-dark--2">
        <div className="b-dark__in b-dark__in--col">
          <h2 className="b-h2--light">Compared with yourself, not with everyone.</h2>
          <p className="b-body b-body--light b-narrow">Stable people who start in the lowest fifth, followed for a simulated year. Each dot is one in a hundred of the {lowStart.people.toLocaleString('en')} people.</p>
          <div className="b-panels">
            <div className="b-panel"><p className="b-panel__h">One cutoff for everyone <span className="b-tag b-tag--flag">fixed cutoff</span></p><DotGrid share={lowStart.fixedCutoff} tone="flag" /><p className="b-panel__f"><span><i className="b-sw b-sw--flag" />Falsely flagged</span><b>{pct1(lowStart.fixedCutoff)}</b></p></div>
            <div className="b-panel"><p className="b-panel__h">Compared with their own baseline <span className="b-tag b-tag--ok">this rule</span></p><DotGrid share={lowStart.ours} tone="ok" /><p className="b-panel__f"><span><i className="b-sw b-sw--ok" />Falsely flagged</span><b>{pct1(lowStart.ours)}</b></p></div>
          </div>
        </div>
      </section>

      <section className="b-sec">
        <h2>What we measured, and what we have not.</h2>
        <div className="b-evid">
          <div><p className="b-evid__q">"{arabic}% of real Arabic words heard right."</p><p>{own.whisperAlone.n} single words from {own.speakers} adult volunteers, scored on the device with the speaker's own voice as the answer key. Read words, not recall.</p><p className="b-evid__by"><i />Real recordings</p></div>
          <div><p className="b-evid__q">"Older Gulf voices heard no worse."</p><p>Word error {older}% for older against {adult}% for adult Gulf speakers on public Saudi TV speech. Not yet older Emirati volunteers doing the check.</p><p className="b-evid__by"><i />Public data</p></div>
          <div><p className="b-evid__q">"Every line of the decision code tested."</p><p>{tests.passed} tests run {Math.round(coverage.engine.lines * 100)}% of its lines and catch {Math.round(mutation.score * 100)}% of {mutation.mutants} deliberate bugs. {live.passed} of {live.total} live steps pass after each deploy.</p><p className="b-evid__by"><i />Tested code</p></div>
        </div>
      </section>

      <section className="b-dark b-dark--3">
        <div className="b-dark__in">
          <div className="b-dark__lead">
            <h2 className="b-h2--light">About AED {perMember} per eligible member a year.</h2>
            <p className="b-body b-body--light">Thiqa's packages 52-45 and 52-46 already fund hearing and dementia screening. Referrals leave as HL7 v2 for Malaffi and FHIR R4. Consent comes in parts, each off by default, and scores stay on the device.</p>
          </div>
          <div className="b-cost"><CostPanel /></div>
        </div>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Direction c: on Loops' system                                        */
/* ------------------------------------------------------------------ */

function ProgrammeWindow() {
  const people = PERSONAS.map((p) => ({ p, t: evaluate(p.checks) }))
  const groups = [
    { h: 'Packets waiting', items: people.filter((x) => PACKET_STATUSES.includes(x.t.status)) },
    { h: 'Urgent', items: people.filter((x) => x.t.status === 'urgent') },
    { h: 'Held for hearing', items: people.filter((x) => x.p.checks.filter((c) => c.hearingLimited).length >= 2 && !PACKET_STATUSES.includes(x.t.status) && x.t.status !== 'urgent') },
  ]
  const shown = new Set(groups.flatMap((g) => g.items.map((x) => x.p.id)))
  groups.push({ h: 'Nothing sent', items: people.filter((x) => !shown.has(x.p.id)) })
  const last = (p: Persona) => p.checks[p.checks.length - 1].date
  return (
    <div className="c-stage">
      <div className="c-window">
        <div className="c-window__bar"><span className="c-dots" aria-hidden="true"><i /><i /><i /></span><span>‹ ›</span><b>Home</b><span>/</span><span>Physician's view</span></div>
        <div className="c-window__body">
          <aside className="c-side">
            <p className="c-side__org"><span className="c-org">S</span>Screening clinic, demo</p>
            {[['Home', <List key="i" />], ['Checks', <Mic key="i" />], ['Packets', <Stethoscope key="i" />], ['Referrals', <Clock key="i" />], ['Hearing', <Ear key="i" />], ['Re-scoring', <Waves key="i" />]].map(([l, ic], i) => (
              <p key={l as string} className={`c-side__item${i === 0 ? ' is-on' : ''}`}>{ic}{l}</p>
            ))}
          </aside>
          <div className="c-main">
            <p className="c-main__h">Home <span className="c-syn">Synthetic people, not real data</span></p>
            {groups.map((g) => (
              <div className="c-group" key={g.h}>
                <p className="c-group__h"><span aria-hidden="true">⌄</span>{g.h} <span className="c-count">{g.items.length}</span></p>
                {g.items.map(({ p, t }) => (
                  <Link key={p.id} to={`/clinician/${p.id}`} className="c-row"><b>{p.name}</b><span>{STATUS_LABEL[t.status]}</span><small>last check {shortDate(last(p))}</small></Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="c-float c-float--person">
        <p className="c-float__bar"><span className="c-dots" aria-hidden="true"><i /><i /><i /></span>What the person sees <small>Ready</small></p>
        <div className="c-float__body">
          <p className="c-float__big">Check received. Thank you.</p>
          <p>One low day does not mean anything on its own. Results are discussed in person, never in the app.</p>
          <p className="c-ticks">{decline.checks.slice(-4).map((c) => <span key={c.date}><Check />{shortDate(c.date)}</span>)}</p>
        </div>
      </div>
      <div className="c-float c-float--note"><Stethoscope /><p>A physician approves every packet</p></div>
    </div>
  )
}

function Learn({ items }: { items: [string, string][] }) {
  return <p className="c-learn"><span>Learn</span>{items.map(([l, to]) => <Link key={l} to={to}>{l}</Link>)}</p>
}

function HomeC() {
  return (
    <main className="dh dh-c">
      <div className="c-top">
      <div className="c-stripes" aria-hidden="true"><i /><i /><i /><i /></div>
      <section className="c-hero">
        <h1>{H1_SHORT}</h1>
        <p className="c-lead">Four minutes at home in Gulf Arabic or English, compared with your own earlier checks. A physician hears only after two low checks in a row.</p>
        <p className="c-actions"><Link to="/try" className="c-btn">Try it with your voice</Link><Link to="/story" className="c-btn c-btn--ghost">See one case, both screens</Link></p>
      </section>
      <ProgrammeWindow />
      </div>
      <ul className="c-facts">{FACTS.map((f) => <li key={f.n}><b>{f.n}</b>{f.t}</li>)}</ul>

      <section className="c-sec">
        <h2>Every score shows how sure it is</h2>
        <p>The browser's recogniser and a speech model on the device hear the same words, and recalled words are matched against the person's <Link to="/recorded-check">own voice</Link>. Three checks set a <Link to="/how">personal baseline</Link>, so low schooling is not read as decline.</p>
        <div className="c-win">
          <p className="c-win__bar"><span className="c-seg"><b>Person</b><span>Physician</span></span><span className="c-select">{PERSONAS[0].name}, synthetic ⌄</span></p>
          <div className="c-win__body"><TrajectoryChart checks={PERSONAS[0].checks} traj={evaluate(PERSONAS[0].checks)} compact textSize={13} /><ChartKey /><p className="d-note">Each bar is the range the listeners heard at one check.</p></div>
        </div>
        <Learn items={[['Recorded check', '/recorded'], ['Hearing check', '/hearing'], ['Blind re-scoring', '/rescore']]} />
      </section>

      <section className="c-sec">
        <h2>A physician reads the packet before anyone is told</h2>
        <p>After two low checks in a row, the ordering physician gets the trajectory, the <Link to="/clinician">treatable causes</Link> to rule out first and the risk factors already on record. If they approve, the person is invited to a visit.</p>
        <div className="c-win"><div className="c-win__body"><PacketCard chartText={13} /></div></div>
        <Learn items={[["Physician's view", '/clinician'], ['A year of checks', '/year'], ['Programme view', '/programme']]} />
      </section>

      <section className="c-sec">
        <h2>About AED {perMember} per eligible member a year</h2>
        <p>Thiqa's packages <Link to="/how">52-45 and 52-46</Link> fund hearing and dementia screening and name no memory tool. This check adds the memory step at home for people already in the programme.</p>
        <div className="c-win"><div className="c-win__body"><CostPanel /></div></div>
        <Learn items={[['Pilot design', '/how'], ['Evidence', '/benchmark']]} />
      </section>

      <section className="c-sec">
        <h2>Low scores have more than one cause</h2>
        <p>The rule <Link to="/how">holds, leaves out or hands on</Link> a low score before it ever counts as decline.</p>
        <div className="c-win">
          <div className="c-win__body c-health">
            <p className="c-health__big">Held, not low</p>
            <div className="c-health__cols">
              <div><p className="c-health__h">Handled by the rule</p>
                <p className="c-health__r"><Ear />Failed sound check<small>Held</small></p>
                <p className="c-health__r"><Moon />Off day<small>Left out</small></p>
                <p className="c-health__r"><Clock />Missed check<small>Not counted</small></p>
              </div>
              <div><p className="c-health__h">Sent to a person</p>
                <p className="c-health__r"><Stethoscope />Two low checks in a row<small>Physician</small></p>
                <p className="c-health__r"><List />Everyday tasks harder<small>Physician</small></p>
                <p className="c-health__r"><Alert />Very large fall<small>Urgent</small></p>
              </div>
            </div>
          </div>
        </div>
        <Learn items={[['Safety case', '/how'], ['What is real', '/how']]} />
      </section>

      <section className="c-sec">
        <h2>What we measured so far</h2>
        <p>Each figure says whether it comes from real recordings, a simulation or the code. No patients yet.</p>
        <div className="c-stats">
          <div><p className="c-stats__l"><Mic />Real recordings</p><p className="c-stats__n">{arabic}%</p><p>of {own.whisperAlone.n} Arabic words heard right on the device</p><Link to="/benchmark">Read the method</Link></div>
          <div><p className="c-stats__l"><Waves />Simulated</p><p className="c-stats__n">{pct1(ours.falseAlarmYear)}</p><p>false alarms a year in stable people</p><Link to="/benchmark">Read the method</Link></div>
          <div><p className="c-stats__l"><Code />Tested code</p><p className="c-stats__n">{Math.round(coverage.engine.lines * 100)}%</p><p>of the decision code's lines run by {tests.passed} tests</p><Link to="/how">Read the method</Link></div>
        </div>
      </section>
    </main>
  )
}

export default function HomeDirection({ dir }: { dir: Dir }) {
  if (dir === 'a') return <HomeA />
  if (dir === 'b') return <HomeB />
  return <HomeC />
}
