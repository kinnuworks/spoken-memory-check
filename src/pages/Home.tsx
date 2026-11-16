// The home page. Every figure is read from the data files the evidence pages use; the people are
// the synthetic personas the rule runs on.
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import tests from '../data/tests.json'
import sada from '../data/sada-bench.json'
import coverage from '../data/coverage-summary.json'
import { COST_DEFAULTS, yearlyCost } from '../engine/cost'
import { evaluate, PACKET_STATUSES, STATUS_LABEL, type Trajectory } from '../engine/change'
import { PERSONAS, type Persona } from '../engine/histories'
import { WORD_LISTS } from '../engine/lexicon'
import { Alert, Check, Code, Ear, EyeOff, List, Mic, Moon, Trend, Waves } from '../components/Icons'
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
const aed = (x: number) => `AED ${Math.round(x).toLocaleString('en')}`


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
      <span><i className="d-key__dot d-key__dot--ok" />Within the usual range (shaded)</span>
      <span><i className="d-key__dot d-key__dot--flag" />Sent on by the rule</span>
      <span><i className="d-key__dot d-key__dot--grey" />Setting the baseline, or one low check</span>
      <span><i className="d-key__line" />Personal baseline</span>
    </p>
  )
}

const CHIP: Record<string, string> = { stable: 'Steady', practice: 'Rises with practice', decline: 'Slow decline', hearing: 'Hearing problem', function: 'Daily tasks harder', urgent: 'Sudden large drop' }

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


const WORDS = WORD_LISTS.en[0]
const packetPeople = PERSONAS.map((p) => ({ p, t: evaluate(p.checks) })).filter(({ p, t }) => !outcome(t, p).ok)
const MEASURED = [
  `${pct1(ours.falseAlarmYear)} false alarms a year in stable people, simulated`,
  `${Math.round(ours.detected['2'] * 100)}% of people losing two points a check flagged within a year, simulated`,
  `${tests.passed} tests run ${Math.round(coverage.engine.lines * 100)}% of the decision code`,
]
const NOT_YET = ['No older Emirati volunteers doing the check', 'Arabic lists not yet reviewed by a native speaker', 'Retest variation taken from published studies']

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

type Design = { onReplay?: (fn: () => void) => void }

/** One synthetic person's year, end to end, in three numbered steps: the check at home, the
 *  comparison with their own baseline, and what the doctor gets. Choosing a person, or pressing R
 *  in a demo, replays the signature moment: the checks land one at a time, then each step of the
 *  rule, then the outcome. */
function CalWidget() {
  const [id, setId] = useState('decline')
  const [run, setRun] = useState(0)
  useEffect(() => { (window as unknown as { design?: Design }).design?.onReplay?.(() => setRun((r) => r + 1)) }, [])
  const p = PERSONAS.find((x) => x.id === id)!
  const t = evaluate(p.checks)
  const o = outcome(t, p)
  const steps = ruleSteps(p, t)
  const n = p.checks.length
  const key = `${id}-${run}`
  const first = p.name.split(',')[0]
  return (
    <>
      <div className="c-people" role="group" aria-label="Pick a synthetic person">
        <span className="c-people__label">Pick a person</span>
        {PERSONAS.map((x) => <button key={x.id} type="button" aria-pressed={x.id === id} className={x.id === id ? 'is-on' : ''} onClick={() => { setId(x.id); setRun((r) => r + 1) }}>{x.name.split(',')[0]}: {CHIP[x.id]}</button>)}
      </div>
      <div className="c-widget">
        <div className="c-col">
          <p className="c-col__n"><b>1</b>At home, by voice</p>
          <div className="c-phone">
            <p className="c-phone__h">Say these ten words back</p>
            <p className="c-phone__chips">{WORDS.slice(0, 6).map((w) => <span key={w}>{w}</span>)}</p>
            <p className="c-phone__step"><Waves />Then a minute of animals, and the words again</p>
            <p className="c-phone__done"><Check />Check received. Thank you.</p>
          </div>
          <p className="c-col__note">Four minutes, every few months. Nothing to read or type, and no score on screen.</p>
        </div>
        <div className="c-col">
          <p className="c-col__n"><b>2</b>Compared with {first}’s own baseline</p>
          <p className="c-col__who">{p.name}, synthetic. {n} checks over a year. {p.story.split('. ')[0].replace(/\.$/, '')}.</p>
          <TrajectoryChart key={key} checks={p.checks} traj={t} compact textSize={17} animate />
          <ChartKey />
        </div>
        <div className="c-col" key={key} style={{ '--n': n } as React.CSSProperties}>
          <p className="c-col__n"><b>3</b>What the doctor gets</p>
          {steps.map((s, i) => <p key={s.label} className="c-slot c-sig" style={{ '--i': i } as React.CSSProperties}><i />{s.label}</p>)}
          <p className={`c-slot c-slot--out c-sig c-sig--out ${o.ok ? 'is-ok' : 'is-flag'}`} style={{ '--i': steps.length } as React.CSSProperties}><Check />{o.text}</p>
          <p className="c-widget__side c-sig" style={{ '--i': steps.length + 1 } as React.CSSProperties}>{o.side}</p>
        </div>
      </div>
    </>
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
  ['Thiqa 52-45, 52-46', 'Fund dementia screening; this fills the memory step'],
  ['Follow-up clock', 'Against the 15-working-day target'],
  ['Consent in parts', 'Each part off by default'],
]

export default function Home() {
  return (
    <main className="dh dh-c">
      <section className="c-hero">
        <p className="c-pill"><span>New</span>Speech recognition on the device heard {arabic}% of {own.whisperAlone.n} real Arabic words</p>
        <h1>
          <span className="c-line">A four-minute memory check <span className="c-obj c-obj--word" aria-hidden="true"><Mic /><b lang="ar">نهر</b><small>river</small></span></span>{' '}
          <span className="c-line">by voice, at home <span className="c-obj c-obj--card" aria-hidden="true"><b>Check received</b><small><Check />Thank you</small></span></span>
        </h1>
        <p className="c-sub">Compared with your own past checks. Your doctor hears only lasting changes.</p>
        <p className="c-btns"><Link to="/try" className="c-btn c-btn--dark"><Mic />Try it with your voice</Link><Link to="/year" className="c-btn"><Trend />See a year of checks</Link></p>
        <p className="c-small"><b>No sign-up.</b> Gulf Arabic or English, nothing to read or type.</p>
      </section>

      <section className="c-desk">
        <div className="c-desk__menu"><b>Spoken memory check</b><span className="c-desk__right">Synthetic people</span></div>
        <div className="c-browser">
          <div className="c-browser__bar"><span className="c-lights" aria-hidden="true"><i /><i /><i /></span><span className="c-url">How it works: one synthetic person’s year, from home check to doctor</span></div>
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
