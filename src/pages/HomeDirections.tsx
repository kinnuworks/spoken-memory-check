// The home page in each of the three design directions being compared (a: Letters, b: Voicenotes,
// c: Cal.com). Every figure is read from the same data files as the main home page; the people are
// the synthetic personas the rule runs on.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import tests from '../data/tests.json'
import sada from '../data/sada-bench.json'
import coverage from '../data/coverage-summary.json'
import { COST_DEFAULTS, yearlyCost } from '../engine/cost'
import { evaluate, PACKET_STATUSES, STATUS_LABEL, type Trajectory } from '../engine/change'
import { PERSONAS, type Persona } from '../engine/histories'
import { treatableContributors } from '../engine/packet'
import { Alert, Arrow, Check, Clock, Code, Ear, EyeOff, List, Lock, Mic, Moon, Pause, Send, Stethoscope, Trend, Waves } from '../components/Icons'
import { WORD_LISTS } from '../engine/lexicon'
import type { Dir } from '../components/direction'
import TrajectoryChart from './TrajectoryChart'

const rows = data.rows.filter((r) => r.world === 'As assumed')
const ours = rows.find((r) => r.rule === 'ours')!
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const arabic = Math.round(own.union.rate * 100)
const older = Math.round(sada.results.jaisAsr['Older, Gulf (Khaliji)'].wer * 100)
const adult = Math.round(sada.results.jaisAsr['Adult, Gulf (Khaliji)'].wer * 100)
const perMember = Math.round(yearlyCost().perEligibleAed)
const decline = PERSONAS.find((p) => p.id === 'decline')!
const declineTraj = evaluate(decline.checks)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
const aed = (x: number) => `AED ${Math.round(x).toLocaleString('en')}`

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

const words = WORD_LISTS.en[0]
const packetPeople = PERSONAS.map((p) => ({ p, t: evaluate(p.checks) })).filter(({ p, t }) => !outcome(t, p).ok)
const MEASURED = [
  `${pct1(ours.falseAlarmYear)} false alarms a year in stable people, simulated`,
  `${Math.round(ours.detected['2'] * 100)}% of people losing two points a check flagged within a year, simulated`,
  `${tests.passed} tests run ${Math.round(coverage.engine.lines * 100)}% of the decision code`,
]
const NOT_YET = ['No older Emirati volunteers doing the check', 'Arabic lists not yet reviewed by a native speaker', 'Retest variation taken from published studies']

/* ------------------------------------------------------------------ */
/* Direction a: on Letters' system                                     */
/* ------------------------------------------------------------------ */

/** An inline icon tile set into a heading, the way Letters does. */
function Tile({ children }: { children: React.ReactNode }) {
  return <span className="a-tile" aria-hidden="true">{children}</span>
}

/** The envelope: what the person says aloud, and the packet the physician gets. */
function Envelope() {
  const contributors = treatableContributors(decline.record).slice(0, 2)
  return (
    <div className="a-env a-mock">
      <div className="a-env__fan a-env__fan--l" aria-hidden="true"><i /><i /><i /></div>
      <div className="a-env__fan a-env__fan--r" aria-hidden="true"><i /><i /><i /></div>
      <div className="a-env__back" aria-hidden="true" />
      <div className="a-letter a-letter--said">
        <span className="a-tab"><Mic />Said aloud</span>
        <p className="a-letter__h">Say these ten words back</p>
        <p className="a-letter__words">{words.map((w) => <span key={w}>{w}</span>)}</p>
      </div>
      <div className="a-letter a-letter--packet">
        <span className="a-tab"><Stethoscope />Physician's packet</span>
        <p>Dear doctor,</p>
        <p>{decline.name}, a synthetic person, scored below their own baseline of {(declineTraj.baseline as number).toFixed(1)} on two checks in a row.</p>
        <p>Treatable causes to rule out first: {contributors.map((c) => c.name.toLowerCase()).join(' and ')}.</p>
      </div>
      <div className="a-env__front" aria-hidden="true" />
    </div>
  )
}

function HowSwitch() {
  const [who, setWho] = useState<'person' | 'physician'>('person')
  const steps = who === 'person'
    ? [[<Ear key="e" />, 'A sound check first', 'Digits in noise. If it fails, the check is held, not scored.'], [<Mic key="m" />, 'Four minutes by voice', 'Ten words said back, a minute of animals, the words again.'], [<Check key="c" />, 'Check received. Thank you.', 'No score at home. Results are given in person.']]
    : [[<Trend key="t" />, 'A year of checks', 'Each check is compared with the person’s own first three.'], [<Stethoscope key="s" />, 'A packet after a lasting change', 'Two low checks in a row, a steady fall or harder everyday tasks.'], [<Clock key="c" />, 'Approve and follow up', 'A referral in HL7 v2 and FHIR, tracked against the 15-working-day target.']]
  return (
    <>
      <div className="a-seg" role="group" aria-label="Show the steps for">
        <button type="button" aria-pressed={who === 'person'} className={who === 'person' ? 'is-on' : ''} onClick={() => setWho('person')}><Mic />The person</button>
        <button type="button" aria-pressed={who === 'physician'} className={who === 'physician' ? 'is-on' : ''} onClick={() => setWho('physician')}><Stethoscope />The physician</button>
      </div>
      <div className="a-small3">
        {steps.map(([ic, t, d]) => <div key={t as string} className="a-scard"><span className="a-scard__ic">{ic}</span><h3>{t}</h3><p>{d}</p></div>)}
      </div>
    </>
  )
}

function HomeA() {
  return (
    <main className="dh dh-a">
      <section className="a-hero">
        <div className="a-hero__copy">
          <h1>A memory check you speak</h1>
          <p className="a-lead">Four minutes <b>by voice</b>, in Gulf Arabic or English. <b>Nothing to read or type.</b> Compared with <b>your own</b> earlier checks.</p>
          <Link to="/try" className="a-btn">Try it with your voice</Link>
          <p className="a-small">No sign-up. The people shown are synthetic.</p>
        </div>
        <Envelope />
      </section>

      <section className="a-sec">
        <h2>Four <Tile><Mic /></Tile> minutes<br />at home, by voice</h2>
        <div className="a-two">
          <div className="a-card">
            <span className="a-tag"><Mic />The check</span>
            <h3>Ten words, a minute of animals, then the words again</h3>
            <div className="a-card__ui">
              <div className="a-ui">
                <p className="a-ui__h">Say these ten words back</p>
                <p className="a-ui__chips">{words.slice(0, 6).map((w) => <span key={w}>{w}</span>)}</p>
                <p className="a-ui__bar"><Waves />Listening on this device</p>
              </div>
            </div>
            <Link to="/try" className="a-plink">Try it with your voice<Arrow /></Link>
          </div>
          <div className="a-card">
            <span className="a-tag"><Stethoscope />The physician</span>
            <h3>A packet only after a change that lasts</h3>
            <div className="a-card__ui">
              <div className="a-ui a-ui--chart">
                <p className="a-ui__h">{decline.name}, synthetic: {STATUS_LABEL[declineTraj.status]}</p>
                <TrajectoryChart checks={decline.checks} traj={declineTraj} compact textSize={20} />
                <ChartKey />
              </div>
            </div>
            <Link to="/clinician" className="a-plink">Open the physician's view<Arrow /></Link>
          </div>
        </div>
      </section>

      <section className="a-sec">
        <h2>How <Tile><Waves /></Tile> the check works</h2>
        <HowSwitch />
      </section>

      <section className="a-sec">
        <h2>Low scores have <Tile><Ear /></Tile><br />more than one cause</h2>
        <div className="a-two">
          <div className="a-card a-card--light">
            <span className="a-tag"><Ear />Hearing comes first</span>
            <h3>A failed sound check holds the check instead of scoring it low</h3>
            <div className="a-card__ui">
              <div className="a-ui">
                <p className="a-ui__row"><span>Sound check</span><b>Not passed</b></p>
                <p className="a-ui__row"><span>Memory check</span><b>Held, not scored</b></p>
                <p className="a-ui__row"><span>After two holds</span><b>Hearing assessment</b></p>
              </div>
            </div>
          </div>
          <div className="a-card a-card--light">
            <span className="a-tag"><Moon />Off days do not count</span>
            <h3>A low score on a day the person says was off is left out</h3>
            <div className="a-card__ui">
              <div className="a-ui">
                <p className="a-ui__row"><span>Was today an off day?</span><b>Yes</b></p>
                <p className="a-ui__row"><span>This check</span><b>Kept, not compared</b></p>
                <p className="a-ui__row"><span>A missed check</span><b>Never counted as low</b></p>
              </div>
            </div>
          </div>
        </div>
        <div className="a-small3">
          {ROUTES.slice(2, 5).map((r) => <div key={r.t} className="a-scard"><span className="a-scard__ic">{r.icon}</span><h3>{r.t}</h3><p>{r.d}</p></div>)}
        </div>
      </section>

      <section className="a-sec a-gold">
        <h2>Tested on real speech</h2>
        <p className="a-sub">Real recordings, a simulated year of checks and the official HL7 validator. Every figure links to how it was made.</p>
        <div className="a-facts">{FACTS.map((f) => <div key={f.n}><b>{f.n}</b><span>{f.t}</span></div>)}</div>
        <Link to="/benchmark" className="a-btn a-btn--light">How the flag was tested</Link>
      </section>

      <section className="a-sec">
        <h2>From a check <Tile><Send /></Tile><br />to a visit</h2>
        <div className="a-steps">
          <div className="a-step is-on">
            <p className="a-step__n">1</p>
            <div><h3>The person checks at home</h3><p>Four minutes by voice, every few months, compared with their own first three checks.</p></div>
            <div className="a-step__ui"><p className="a-ui__h">Check received. Thank you.</p><p className="a-ticks">{decline.checks.slice(0, 5).map((c) => <span key={c.date}><Check />{shortDate(c.date)}</span>)}</p></div>
          </div>
          <div className="a-step">
            <p className="a-step__n">2</p>
            <div><h3>The rule looks for a change that lasts</h3><p>Two low checks in a row, a steady fall, or harder everyday tasks. One low day means nothing on its own.</p></div>
          </div>
          <div className="a-step">
            <p className="a-step__n">3</p>
            <div><h3>A physician decides</h3><p>The packet waits for the ordering physician, who approves, edits or dismisses it with a reason.</p></div>
          </div>
        </div>
      </section>

      <section className="a-sec">
        <h2>What is measured, <Tile><List /></Tile><br />and what is not yet</h2>
        <div className="a-two">
          <div className="a-safe"><span className="a-tag"><Check />Measured</span><p className="a-safe__n">{arabic}%</p><p>of {own.whisperAlone.n} real Arabic words heard right on the device, from {own.speakers} adult volunteers.</p><ul>{MEASURED.map((m) => <li key={m}><Check />{m}</li>)}</ul></div>
          <div className="a-safe"><span className="a-tag"><Alert />Not yet</span><p className="a-safe__n">0</p><p>patients so far. A pilot measures the rest.</p><ul>{NOT_YET.map((m) => <li key={m}><Alert />{m}</li>)}</ul></div>
        </div>
      </section>

      <section className="a-sky2">
        <h2>About AED {perMember} per eligible member a year</h2>
        <p className="a-lead a-lead--sm">Thiqa's packages 52-45 and 52-46 already fund hearing and dementia screening. This check adds the memory step at home.</p>
        <div className="a-price"><CostPanel /></div>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Direction b: on Voicenotes' system                                  */
/* ------------------------------------------------------------------ */

function Listener({ label }: { label: string }) {
  return <div className="b-listener"><span className="b-listener__bars" aria-hidden="true"><i /><i /><i /><i /></span><span>{label}</span></div>
}

function CheckPanel() {
  const [tab, setTab] = useState<'check' | 'rule'>('check')
  return (
    <div className="b-panel">
      <div className="b-panel__bar">
        <span className="b-tabs" role="group" aria-label="Show">
          <button type="button" aria-pressed={tab === 'check'} className={tab === 'check' ? 'is-on' : ''} onClick={() => setTab('check')}>The check</button>
          <button type="button" aria-pressed={tab === 'rule'} className={tab === 'rule' ? 'is-on' : ''} onClick={() => setTab('rule')}>The rule</button>
        </span>
        <span className="b-wave" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</span>
        <span className="b-round" aria-hidden="true"><Pause /></span>
        <span className="b-round b-round--stop" aria-hidden="true"><i /></span>
      </div>
      {tab === 'check' ? (
        <ul className="b-panel__list">
          <li>I will read ten words, one at a time. Say each word back after me.</li>
          <li><span className="b-words">{words.join(', ')}</span></li>
        </ul>
      ) : (
        <ul className="b-panel__list">
          <li>{decline.name}, synthetic: {STATUS_LABEL[declineTraj.status].toLowerCase()} against a baseline of {(declineTraj.baseline as number).toFixed(1)}.</li>
          <li>Packet sent to the ordering physician, who decides before anyone is told.</li>
        </ul>
      )}
    </div>
  )
}

function HomeB() {
  return (
    <main className="dh dh-b">
      <section className="b-hero">
        <div className="b-hero__copy">
          <h1>{H1_LONG}</h1>
          <p className="b-lead">Four minutes at home, by voice, in Gulf Arabic or English. Nothing to read or type, and a physician hears only of a change that lasts.</p>
          <p className="b-btns"><Link to="/try" className="b-btn">Try it with your voice</Link><Link to="/year" className="b-btn b-btn--line"><Trend />See a year of checks</Link></p>
          <ul className="b-small">
            <li><Lock />No sign-up. The people shown are synthetic and labelled</li>
            <li><Mic />Gulf Arabic and English, heard in the browser</li>
            <li><EyeOff />No scores at home. It does not diagnose</li>
          </ul>
        </div>
        <div className="b-art">
          <img src="/images/vn-sky.webp" alt="" width={1000} height={1000} fetchPriority="high" />
          <div className="b-listeners"><Listener label="On this device" /><Listener label="The browser's" /></div>
          <CheckPanel />
        </div>
      </section>

      <section className="b-strip">
        <p className="b-strip__label">Measured so far, with the method behind each</p>
        <div className="b-strip__row">{FACTS.map((f) => <p key={f.n}><b>{f.n}</b><span>{f.t}</span></p>)}</div>
      </section>

      <section className="b-sec">
        <h2>Four minutes, nothing to read.</h2>
        <div className="b-three">
          <div className="b-step">
            <div className="b-step__art" style={{ backgroundImage: 'url(/images/vn-sky.webp)', backgroundPosition: '20% 80%' }}>
              <div className="b-mini"><p className="b-mini__h">Say these words back</p><p className="b-chips">{words.slice(0, 5).map((w) => <span key={w}>{w}</span>)}</p></div>
            </div>
            <h3><span>1</span>Say the words back</h3>
            <p>Ten words, one at a time, in Gulf Arabic or English. Two listeners hear them.</p>
          </div>
          <div className="b-step">
            <div className="b-step__art" style={{ backgroundImage: 'url(/images/vn-dunes.webp)', backgroundPosition: '50% 90%' }}>
              <div className="b-mini"><p className="b-mini__h">Name as many animals as you can</p><p className="b-mini__row"><span className="b-pill"><Pause />Pause</span><span className="b-mini__t">One minute</span><span className="b-pill b-pill--stop">Stop</span></p></div>
            </div>
            <h3><span>2</span>Name animals for a minute</h3>
            <p>Each animal heard counts once. Then the ten words again, from memory.</p>
          </div>
          <div className="b-step">
            <div className="b-step__art" style={{ backgroundImage: 'url(/images/vn-sky.webp)', backgroundPosition: '90% 10%' }}>
              <div className="b-mini"><p className="b-mini__h">Check received. Thank you.</p><p className="b-mini__ticks">{decline.checks.slice(0, 4).map((c) => <span key={c.date}><Check />{shortDate(c.date)}</span>)}</p></div>
            </div>
            <h3><span>3</span>Done for today</h3>
            <p>No score at home. One low day means nothing on its own; results are given in person.</p>
          </div>
        </div>
      </section>

      <section className="b-sec">
        <h2>From a spoken check to a physician’s packet.</h2>
        <div className="b-feats">
          <div className="b-feat">
            <div className="b-feat__art" style={{ backgroundImage: 'url(/images/vn-dunes.webp)' }}>
              <div className="b-feat__win"><p className="b-feat__bar"><span className="b-dots" aria-hidden="true"><i /><i /><i /></span>{decline.name}, synthetic</p><TrajectoryChart checks={decline.checks} traj={declineTraj} compact textSize={18} /><ChartKey /></div>
            </div>
            <h3>The rule, run on a year of checks.</h3>
            <p>Each check is compared with the person’s own first three. Two low checks in a row, a steady fall or harder everyday tasks send a packet.</p>
          </div>
          <div className="b-feat">
            <div className="b-feat__art" style={{ backgroundImage: 'url(/images/vn-sky.webp)', backgroundPosition: '30% 40%' }}>
              <div className="b-feat__win"><p className="b-feat__bar"><span className="b-dots" aria-hidden="true"><i /><i /><i /></span>Packets waiting</p><PacketCard chartText={18} /></div>
            </div>
            <h3>Ready before the visit.</h3>
            <p>The trajectory, the treatable causes to rule out first and the risk factors already on record. The physician approves before the person is told.</p>
          </div>
        </div>
      </section>

      <section className="b-sec">
        <h2>Low scores have more than one cause.</h2>
        <div className="b-grid6">{ROUTES.map((r) => <div key={r.t} className="b-card"><span className="b-card__ic">{r.icon}</span><h3>{r.t}</h3><p>{r.d}</p></div>)}</div>
      </section>

      <section className="b-sec">
        <h2>Built to hand on, not to diagnose.</h2>
        <div className="b-grid4">
          <div className="b-card"><span className="b-card__ic"><Send /></span><h3>HL7 v2 referral</h3><p>REF^I12, the message Malaffi asks for, with a SNOMED-coded specialty.</p></div>
          <div className="b-card"><span className="b-card__ic"><Code /></span><h3>FHIR R4</h3><p>0 errors from the official HL7 validator.</p></div>
          <div className="b-card"><span className="b-card__ic"><Lock /></span><h3>Consent in parts</h3><p>Each part off by default, and the check stays locked until the first is on.</p></div>
          <div className="b-card"><span className="b-card__ic"><Clock /></span><h3>About AED {perMember} a member</h3><p>Modelled yearly cost per eligible member, inside Thiqa’s 52-45 and 52-46.</p></div>
        </div>
      </section>

      <section className="b-sec">
        <h2>Measured, and not yet.</h2>
        <div className="b-two">
          <div className="b-card b-card--big"><p className="b-big">{arabic}%</p><p>of {own.whisperAlone.n} real Arabic words heard right on the device, from {own.speakers} adult volunteers.</p><ul>{MEASURED.map((m) => <li key={m}><Check />{m}</li>)}</ul></div>
          <div className="b-card b-card--big"><p className="b-big">0</p><p>patients so far. A pilot measures the rest.</p><ul>{NOT_YET.map((m) => <li key={m}><Alert />{m}</li>)}</ul></div>
        </div>
      </section>

      <section className="b-end">
        <h2>Four minutes, by voice.<br />Try it now.</h2>
        <Link to="/try" className="b-btn">Try it with your voice</Link>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Direction c: on Cal.com's system                                    */
/* ------------------------------------------------------------------ */

/** The real rule on six synthetic people, laid out like a booking widget. */
function CalWidget() {
  const [id, setId] = useState('decline')
  const p = PERSONAS.find((x) => x.id === id)!
  const t = evaluate(p.checks)
  const o = outcome(t, p)
  return (
    <div className="c-widget">
      <div className="c-widget__who">
        <span className="c-av">{p.name.slice(0, 1)}</span>
        <p className="c-widget__name">{p.name}, synthetic</p>
        <p className="c-widget__title">{p.path}</p>
        <p className="c-widget__desc">{p.checks.length} checks over a year, at home, by voice.</p>
        <div className="c-seg" role="group" aria-label="Choose a synthetic person">
          {PERSONAS.map((x) => <button key={x.id} type="button" aria-pressed={x.id === id} className={x.id === id ? 'is-on' : ''} onClick={() => setId(x.id)}>{CHIP[x.id]}</button>)}
        </div>
        <p className="c-widget__row"><Clock />Four minutes a check</p>
        <p className="c-widget__row"><Mic />Gulf Arabic or English</p>
      </div>
      <div className="c-widget__chart">
        <p className="c-widget__h">A year of checks</p>
        <TrajectoryChart checks={p.checks} traj={t} compact textSize={17} />
        <ChartKey />
      </div>
      <div className="c-widget__steps">
        <p className="c-widget__h">What the rule did</p>
        {ruleSteps(p, t).map((s) => <p key={s.label} className="c-slot"><i />{s.label}</p>)}
        <p className={`c-slot c-slot--out ${o.ok ? 'is-ok' : 'is-flag'}`}>{o.text}</p>
      </div>
    </div>
  )
}

function Accordion() {
  const items = [
    ['Check at home every few months', 'Four minutes by voice, compared with the person’s own first three checks, not with a population cut-off.'],
    ['Flag only a change that lasts', 'Two low checks in a row, a steady fall or harder everyday tasks. One low day means nothing on its own.'],
    ['A physician decides', 'The packet waits for the ordering physician, who approves, edits or dismisses it with a reason.'],
  ]
  const [open, setOpen] = useState(0)
  return (
    <div className="c-acc">
      {items.map(([t, d], i) => (
        <button key={t} type="button" className={`c-acc__item${i === open ? ' is-open' : ''}`} aria-expanded={i === open} onClick={() => setOpen(i)}>
          <span className="c-acc__t">{t}</span>
          {i === open && <span className="c-acc__d">{d}</span>}
        </button>
      ))}
    </div>
  )
}

const HUB = [
  ['HL7 v2 REF^I12', 'The referral message Malaffi asks for'],
  ['FHIR R4 bundle', '0 errors from the official validator'],
  ['SNOMED CT', 'Coded specialty on every referral'],
  ['Thiqa 52-45, 52-46', 'Fills the memory step they name no tool for'],
  ['Follow-up clock', 'Against the 15-working-day target'],
  ['Consent in parts', 'Each part off by default'],
]

function HomeC() {
  return (
    <main className="dh dh-c">
      <section className="c-hero">
        <p className="c-pill"><span>New</span>{arabic}% of {own.whisperAlone.n} real Arabic words heard on the device</p>
        <h1>
          <span className="c-line">A memory check <img className="c-obj c-obj--photo" src="/images/cal-chip.webp" alt="" width={300} height={205} /> you speak,</span>{' '}
          <span className="c-line"><span className="c-obj c-obj--wave" aria-hidden="true"><Waves /><b>4 min</b></span> tracked against yourself <span className="c-obj c-obj--card" aria-hidden="true"><b>Check received</b><small><Check />Thank you</small></span></span>
        </h1>
        <p className="c-sub">Four minutes at home, by voice. Nothing to read or type.</p>
        <p className="c-btns"><Link to="/try" className="c-btn c-btn--dark"><Mic />Try it with your voice</Link><Link to="/year" className="c-btn"><Trend />See a year of checks</Link></p>
        <p className="c-small"><b>No sign-up.</b> The people shown are synthetic.</p>
      </section>

      <section className="c-desk">
        <div className="c-desk__menu"><b>Spoken memory check</b><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Help</span><span className="c-desk__right">Demo: synthetic people</span></div>
        <div className="c-browser">
          <div className="c-browser__bar"><span className="c-lights" aria-hidden="true"><i /><i /><i /></span><span className="c-url">spoken-memory-check / physician</span></div>
          <CalWidget />
        </div>
      </section>

      <section className="c-facts">
        <p>Measured so far, each with its method</p>
        <div>{FACTS.map((f) => <p key={f.n}><b>{f.n}</b><span>{f.t}</span></p>)}</div>
      </section>

      <section className="c-split">
        <div className="c-split__text">
          <h2>Diagnosis came 24 months after symptoms. Home checks look in between.</h2>
          <Accordion />
          <p className="c-note"><b>Javaid et al. 2026</b> found a median of 24 months from first symptoms to a dementia diagnosis in 825 patients in Al Ain.</p>
        </div>
        <div className="c-photo" style={{ backgroundImage: 'url(/images/cal-room.webp)' }}>
          <div className="c-inbox">
            <p className="c-inbox__h"><b>Packets waiting</b><span>{packetPeople.length} synthetic</span></p>
            {packetPeople.map(({ p, t }) => <p key={p.id} className="c-inbox__row"><span className="c-av c-av--sm">{p.name.slice(0, 1)}</span><span><b>{p.name}</b><small>{STATUS_LABEL[t.status]}</small></span><i /></p>)}
          </div>
        </div>
      </section>

      <section className="c-sec">
        <h2>Low scores have<br />more than one cause.</h2>
        <div className="c-bento">
          <div className="c-bcard c-bcard--wide"><div className="c-bcard__ui"><div className="c-ui"><p className="c-ui__row"><span>Sound check</span><b>Not passed</b></p><p className="c-ui__row"><span>Memory check</span><span className="c-badge">Held, not scored</span></p></div></div><h3>{ROUTES[0].t}</h3><p>{ROUTES[0].d}</p></div>
          <div className="c-bcard"><div className="c-bcard__ui"><div className="c-ui"><p>Was today an off day?</p><p className="c-ui__sel">Yes <span>Left out</span></p></div></div><h3>{ROUTES[1].t}</h3><p>{ROUTES[1].d}</p></div>
          <div className="c-bcard"><div className="c-bcard__ui"><div className="c-ui"><p className="c-ui__row"><span>Everyday tasks harder?</span><b>Yes</b></p></div><span className="c-ui__line" /><div className="c-ui"><p className="c-ui__row"><span>Sent to the physician</span><span className="c-badge"><Check />Sent</span></p></div></div><h3>{ROUTES[2].t}</h3><p>{ROUTES[2].d}</p></div>
          <div className="c-bcard c-bcard--wide"><div className="c-bcard__ui"><div className="c-ui"><p className="c-ui__row"><span>Very large fall between two checks</span><b>Same day</b></p><p>See a doctor today. The routine flow is bypassed.</p></div></div><h3>{ROUTES[3].t}</h3><p>{ROUTES[3].d}</p></div>
          <div className="c-bcard c-bcard--wide"><div className="c-bcard__ui"><pre className="c-code">{`evaluate(checks)\n  → { status: '${declineTraj.status}', baseline: ${(declineTraj.baseline as number).toFixed(1)} }`}</pre></div><h3>{ROUTES[5].t}</h3><p>{ROUTES[5].d}</p></div>
          <div className="c-bcard"><div className="c-bcard__ui"><div className="c-ui c-ui--center"><p><b>Check received. Thank you.</b></p><p>Results are given in person.</p></div></div><h3>{ROUTES[4].t}</h3><p>{ROUTES[4].d}</p></div>
        </div>
      </section>

      <section className="c-sec">
        <h2>Handed on in the formats<br />Abu Dhabi already uses.</h2>
        <div className="c-hub">
          <div className="c-hub__col">{HUB.slice(0, 3).map(([t, d]) => <div key={t} className="c-hub__item"><b>{t}</b><span>{d}</span></div>)}</div>
          <div className="c-hub__mid"><span className="c-hub__logo"><Waves /></span></div>
          <div className="c-hub__col">{HUB.slice(3).map(([t, d]) => <div key={t} className="c-hub__item"><b>{t}</b><span>{d}</span></div>)}</div>
        </div>
      </section>

      <section className="c-split c-split--cost">
        <div className="c-split__text">
          <h2>About AED {perMember} per eligible member a year.</h2>
          <p className="c-sub c-sub--left">Thiqa's packages 52-45 and 52-46 already fund hearing and dementia screening and name no memory tool. This check adds the memory step at home.</p>
        </div>
        <div className="c-card"><CostPanel /></div>
      </section>

      <section className="c-sec">
        <h2>What is measured,<br />and what is not yet.</h2>
        <div className="c-two">
          <div className="c-card"><p className="c-big">{arabic}%</p><p>of {own.whisperAlone.n} real Arabic words heard right on the device, from {own.speakers} adult volunteers.</p><ul>{MEASURED.map((m) => <li key={m}><Check />{m}</li>)}</ul></div>
          <div className="c-card"><p className="c-big">0</p><p>patients so far. A pilot measures the rest.</p><ul>{NOT_YET.map((m) => <li key={m}><Alert />{m}</li>)}</ul></div>
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
