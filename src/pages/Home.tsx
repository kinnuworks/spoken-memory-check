import { useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../data/benchmark.json'
import speech from '../data/human-speech-summary.json'
import { lostSignals } from '../engine/signals'
import { evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import { treatableContributors } from '../engine/packet'
import { ICON, useReveal } from '../components/brand'
import { Alert, Arrow, Code, Ear, EyeOff, List, Mic, Moon, Play, Stethoscope } from '../components/Icons'
import dunes from '../assets/dunes.jpg'
import { SurveyBars } from './SurveyChart'
import TrajectoryChart from './TrajectoryChart'
import '../styles/home.css'

const STATUS: Record<string, string> = { 'building-baseline': 'Setting the baseline', 'usual-range': 'Within the usual range', watch: 'Lower once', review: 'Reported change in everyday tasks', flag: 'Lower twice in a row', urgent: 'Very large fall' }
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

const decline = PERSONAS.find((p) => p.id === 'decline')!
const declineTraj = evaluate(decline.checks)
const declineFlag = declineTraj.results.find((r) => r.status === 'flag')!
const rows = data.rows.filter((r) => r.world === 'As assumed')
const ours = rows.find((r) => r.rule === 'ours')!
const single = rows.find((r) => r.rule === 'single-low')!
const burden = data.burden.find((b) => b.prevalence === 0.02)!
const audit = lostSignals()

export default function Home() {
  useReveal()
  const [pick, setPick] = useState('decline')
  const person = PERSONAS.find((p) => p.id === pick)!
  const traj = evaluate(person.checks)
  const raised = traj.results.find((r) => r.status === 'flag' || r.status === 'review')
  const last = traj.results[traj.results.length - 1]
  const contributors = treatableContributors(decline.record).slice(0, 3)

  return (
    <main>
      {/* Hero: the three ways in, then the product doing its thing. */}
      <section className="hero">
        <div className="container">
          <span className="badge badge--dot">A prototype for Abu Dhabi's adult screening programme</span>
          <h1>A memory check you <em className="t-serif">speak,</em> tracked against yourself.</h1>
          <p className="lead">Four minutes at home, by voice, in Gulf Arabic or English. Nothing to read or type. A physician hears about it only after two low checks in a row.</p>
          <div className="cta-row">
            <Link to="/try" className="btn btn-ink btn-lg"><Mic />Try it with your voice<span className="tag">30 s</span></Link>
            <Link to="/recorded" className="btn btn-outline btn-lg"><Play />Play a recorded check</Link>
            <Link to="/clinician" className="btn btn-outline btn-lg"><Stethoscope />Physician's view</Link>
          </div>
          <p className="trust"><span>No sign-up</span><span>Works in the browser</span><span>People shown are synthetic</span><span>Does not diagnose</span></p>

          <div className="hero__visual bleed">
            <div className="stage hero-stage" style={{ backgroundImage: `url(${dunes})` }}>
              <div className="hero-grid" aria-hidden="true">
                <div className="phone">
                  <div className="phone__screen">
                    <div className="phone__status"><span>9:41</span><span className="t-mono">EN · ع</span></div>
                    <div className="phone__body">
                      <p className="mock-eyebrow">Sound check passed</p>
                      <p className="mock-h">Name animals</p>
                      <p className="mock-count">14<span>s</span></p>
                      <div className="mock-chips">
                        <span className="chip both">camel</span><span className="chip both">falcon</span><span className="chip both">horse</span>
                        <span className="chip both">goat</span><span className="chip one">gazelle</span><span className="chip both">cat</span>
                      </div>
                      <p className="mock-listen"><i />Listening</p>
                      <ol className="mock-steps">
                        <li className="done"><i />Sound check</li>
                        <li className="done"><i />Ten words, said back</li>
                        <li className="now"><i />A minute of animals</li>
                        <li><i />Counting backwards</li>
                        <li><i />The ten words again</li>
                        <li><i />One question about everyday tasks</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="window hero-window">
                  <div className="window__bar"><span className="lights"><i /><i /><i /></span><span className="window__title">Physician's packet · {decline.name}</span></div>
                  <div className="hero-window__body">
                    <div className="hero-window__head">
                      <div>
                        <p className="mock-eyebrow">Lower twice in a row</p>
                        <p className="mock-title">Baseline {(declineTraj.baseline as number).toFixed(1)}, latest {(declineFlag.mid as number).toFixed(1)}</p>
                      </div>
                      <span className="tag syn">Synthetic</span>
                    </div>
                    <TrajectoryChart checks={decline.checks} traj={declineTraj} compact />
                    <div className="mock-actions"><span className="btn btn-ink btn-sm">Approve and invite to a visit</span><span className="btn btn-outline btn-sm">Dismiss with a reason</span></div>
                  </div>
                </div>
              </div>
              <div className="float float--a"><b>Two speech listeners, same words</b><span className="dotline"><i className="ok" />camel · falcon · horse, by both</span><span className="dotline"><i className="one" />gazelle, by one</span></div>
              <div className="float float--b"><b>What the person sees</b><span>"Check received. Thank you."</span></div>
            </div>
            <p className="stage-caption">The phone is an illustration of the check screen. The chart is the real rule run on a synthetic person.</p>
          </div>
        </div>
      </section>

      {/* Why a personal baseline */}
      <section className="section section--alt after-bleed">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Why compare people with themselves</span>
            <h2>One cutoff for everyone flags the wrong people.</h2>
            <p className="lead">Older adults who had little schooling often fall below the usual cutoffs when nothing is wrong. Comparing each person with their own earlier checks avoids that.</p>
          </div>
          <div className="grid grid-2">
            <div className="card card--flat reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <p className="eyebrow">The usual way</p>
              <h3 className="card-h">A fixed cutoff of 14 animals</h3>
              <p className="t-small">Share of adults over 60 with no memory complaint who fall below it:</p>
              <div className="card-viz"><SurveyBars /></div>
              <p className="t-micro">Our analysis of NHANES 2011 to 2014, a public US health survey: 265 adults with under 9 years of school and 569 graduates. US data, not Gulf.</p>
            </div>
            <div className="card card--chosen reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <p className="eyebrow"><span className="dot" />This check</p>
              <h3 className="card-h">Your first three checks set your baseline</h3>
              <p className="t-small">Later checks are compared with that baseline, after allowing for practice and ordinary day-to-day variation. Someone who has always named eleven animals is not flagged for naming eleven.</p>
              <div className="card-viz"><TrajectoryChart checks={PERSONAS[0].checks} traj={evaluate(PERSONAS[0].checks)} compact /></div>
              <p className="t-micro">{PERSONAS[0].name}, synthetic: a year of checks with one off day and no flag.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Where it fits in Abu Dhabi */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Where it fits</span>
            <h2>The memory step of a screening package Abu Dhabi already pays for.</h2>
            <p className="lead">Since 1 September 2026 the adult screening programme has two Thiqa-funded packages called "Comprehensive hearing and dementia screening": code 52-45 every three years at 50 to 64, and 52-46 every year at 65 to 75. They bundle a nurse visit and a hearing screen. They name no memory tool.</p>
          </div>
          <div className="fit reveal">
            <div className="fit__step"><span className="fit__n">1</span><p className="t-title">Hearing first</p><p className="t-small">The hearing check runs before any memory score is trusted. A fail goes to ENT and holds the memory check, so poor hearing is not read as poor memory.</p></div>
            <div className="fit__step"><span className="fit__n">2</span><p className="t-title">A baseline at the visit, checks at home</p><p className="t-small">The first checks set the person's own baseline. Home checks fill the years between visits, which the package alone does not cover.</p></div>
            <div className="fit__step"><span className="fit__n">3</span><p className="t-title">Referral the way Malaffi wants it</p><p className="t-small">An approved packet becomes a referral with a priority and a SNOMED-coded specialty, as an HL7 v2 REF message and a FHIR ServiceRequest.</p></div>
          </div>
          <p className="pilot-note reveal">Source: DoH Claims Adjudication Rules, Addendum 06 (IFHAS 3.0). Package prices are not public. No health data reaches this site's server: scoring runs on the device, and the optional UAE speech listener is used only with consent.</p>
        </div>
      </section>

      {/* How it works, in three blocks */}
      <section className="section">
        <div className="container vstack">
          <div className="split reveal">
            <div>
              <span className="eyebrow"><Mic />Two listeners</span>
              <h3>Every score shows how sure it is.</h3>
              <p className="lead">The browser's recogniser and an open speech model on the device hear the same words. A word heard by both counts for certain; a word heard by one widens the range. When the range is too wide, the check is marked "not scored" and never counted as low.</p>
              <div className="chips"><span className="chip">Speech model runs on the device</span><span className="chip">Gulf Arabic and English</span><span className="chip">No language model</span></div>
            </div>
            <div className="stage stage--soft">
              <div className="window" aria-hidden="true">
                <div className="window__bar"><span className="lights"><i /><i /><i /></span><span className="window__title">What we heard</span></div>
                <div className="mock-pad">
                  <p className="mock-big">12 to 14 <span>animals</span></p>
                  <div className="mock-chips">
                    {['camel', 'falcon', 'horse', 'goat', 'cat', 'dog', 'lion', 'sheep', 'cow', 'fox', 'bear', 'wolf'].map((a) => <span key={a} className="chip both">{a}</span>)}
                    <span className="chip one">gazelle</span><span className="chip one">oryx</span>
                  </div>
                  <p className="legend"><span><i className="ok" />Heard by both</span><span><i className="one" />Heard by one</span></p>
                </div>
              </div>
              <p className="stage-note">Illustration</p>
            </div>
          </div>

          <div className="split split--flip reveal">
            <div>
              <span className="eyebrow"><Stethoscope />The physician decides</span>
              <h3>A physician reads the packet before anyone is told.</h3>
              <p className="lead">After two low checks in a row, the ordering physician at the screening clinic gets the trajectory, the treatable causes to rule out first, and the risk factors already in the screening record. If they approve, the app sends one invitation to a visit. The result is given in person.</p>
              <div className="chips"><span className="chip">Approve, edit or dismiss</span><span className="chip">Treatable causes first</span><span className="chip">FHIR R4 export</span></div>
            </div>
            <div className="stage stage--soft">
              <div className="window" aria-hidden="true">
                <div className="window__bar"><span className="lights"><i /><i /><i /></span><span className="window__title">Treatable contributors · {decline.name}</span></div>
                <div className="mock-pad">
                  {contributors.map((c) => (
                    <div className="mock-row" key={c.name}><b>{c.name}</b><span>{c.action}</span></div>
                  ))}
                  <div className="mock-actions"><span className="btn btn-ink btn-sm">Approve and invite</span><span className="btn btn-outline btn-sm">Dismiss</span></div>
                </div>
              </div>
              <p className="stage-note">Synthetic patient</p>
            </div>
          </div>

          <div className="split reveal">
            <div>
              <span className="eyebrow"><List />Closing the loop</span>
              <h3>Each referral is tracked until the appointment.</h3>
              <p className="lead">The clock runs against a 15-working-day target, borrowed from the screening programme's own referral indicator. A programme view counts every member by facility, including people lost to follow-up.</p>
              <div className="chips"><span className="chip">Owner: the ordering physician</span><span className="chip">Small groups suppressed</span></div>
            </div>
            <div className="stage stage--soft">
              <div className="window" aria-hidden="true">
                <div className="window__bar"><span className="lights"><i /><i /><i /></span><span className="window__title">Follow-up clock</span></div>
                <div className="mock-pad">
                  <p className="mock-eyebrow">Open</p>
                  <p className="mock-big">6 <span>of 15 working days</span></p>
                  <div className="meter"><i style={{ width: '40%' }} /></div>
                  <div className="mock-row"><b>Visit</b><span>Result given in person, referral made</span></div>
                  <div className="mock-row"><b>Specialist</b><span>Neurologist or geriatrician, appointment booked</span></div>
                </div>
              </div>
              <p className="stage-note">Illustration</p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety routes */}
      <section className="section section--alt">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Built into the rule</span>
            <h2>Low scores have more than one cause.</h2>
            <p className="lead">The rule checks for the common ones before anything reaches a physician, and sends a few things straight there.</p>
          </div>
          <div className="grid grid-3">
            {[
              { icon: <Ear />, t: 'Hearing comes first', d: 'A three-minute digits-in-noise hearing check runs before the memory check, and a failed sound check holds a check instead of scoring it low.' },
              { icon: <Moon />, t: 'Off days do not count', d: 'People can say a day was off. A low score on that day is left out of the comparison.' },
              { icon: <List />, t: 'Everyday tasks override scores', d: 'One spoken question about money, medicines and appointments. A yes goes to the physician whatever the scores say.' },
              { icon: <Alert />, t: 'Very large falls go urgent', d: 'A fall far outside normal variation tells the person to see a doctor the same day.' },
              { icon: <EyeOff />, t: 'No scores at home', d: 'The person sees dated ticks and a thank-you. Scores stay with the physician, who gives results in person.' },
              { icon: <Code />, t: 'Fixed rules anyone can read', d: 'Every decision comes from a short rule in code, with its formula shown to the physician. No language model anywhere.' },
            ].map((x, i) => (
              <div className="tile reveal" key={x.t} style={{ '--i': i % 3 } as React.CSSProperties}>
                <span className="icon-tile">{x.icon}</span>
                <div><p className="t-title">{x.t}</p><p>{x.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What the programme gets */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />For the programme</span>
            <h2>Three checks on the programme itself.</h2>
            <p className="lead">A home check is only useful if the results lead somewhere. These three pages watch the people, the hearing care and the listeners.</p>
          </div>
          <div className="grid grid-3">
            <Link to="/programme" className="card prog-card reveal">
              <span className="lbl simulated">Simulated year</span>
              <p className="stat">{audit.peopleWithAnyPer1000} <span>per 1,000</span></p>
              <p className="t-title">Lost signals</p>
              <p className="t-small">Members with an abnormal brain-relevant result from the screening visit (memory, hearing, mood, HbA1c, blood pressure, vision) and no recorded action by its target date. Each row is a list the facility can call.</p>
              <span className="prog-link">Open the programme view<Arrow /></span>
            </Link>
            <Link to="/hearing" className="card prog-card reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl working">Working</span>
              <p className="stat">3 <span>minutes</span></p>
              <p className="t-title">Hearing, to an aid that is worn</p>
              <p className="t-small">Digits in noise, answered by tapping, with no speech recognition. A fail goes to the physician as an audiology referral, and a weekly one-tap question shows who is still wearing the aid.</p>
              <span className="prog-link">Take the hearing check<Arrow /></span>
            </Link>
            <Link to="/rescore" className="card prog-card reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <span className="lbl working">Working</span>
              <p className="stat">1 <span>in 10</span></p>
              <p className="t-title">Blind re-scoring</p>
              <p className="t-small">One recorded check in ten is scored again by a person who cannot see the machine's result. Agreement is tracked by language, and a language whose agreement falls goes back to human scoring.</p>
              <span className="prog-link">Try it as the reviewer<Arrow /></span>
            </Link>
          </div>
        </div>
      </section>

      {/* Try it here: the real rule on six synthetic people */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Try it here</span>
            <h2>Six people, one rule.</h2>
            <p className="lead">Each synthetic person takes a route through the rule. Pick one to see a year of checks and what the rule decided.</p>
          </div>
          <div className="try reveal">
            <div className="card try-controls">
              <p className="t-title">Choose a person</p>
              <div className="try-list">
                {PERSONAS.map((p) => (
                  <button key={p.id} className="try-pick" aria-pressed={p.id === pick} onClick={() => setPick(p.id)}>
                    <b>{p.name}</b><span>{p.path}</span>
                  </button>
                ))}
              </div>
              <p className="t-micro">Synthetic histories, not patients.</p>
            </div>
            <div className="stage stage--soft try-stage">
              <div className="window">
                <div className="window__bar"><span className="lights"><i /><i /><i /></span><span className="window__title">{person.name} · a year of checks</span></div>
                <div className="mock-pad">
                  <div className="hero-window__head">
                    <div>
                      <p className="mock-eyebrow">Rule says</p>
                      <p className="mock-title">{person.path}<span className="mock-sub"> · {person.checks.some((c) => c.hearingLimited) ? 'sound check failed twice' : STATUS[traj.status] ?? STATUS[last.status]}</span></p>
                    </div>
                    {raised && <span className="tag syn">Packet raised {raised.date}</span>}
                  </div>
                  <TrajectoryChart key={person.id} checks={person.checks} traj={traj} compact />
                  <p className="t-small try-story">{person.story}</p>
                  <div className="mock-actions">
                    <Link className="btn btn-ink btn-sm" to={`/year/${person.id}`}>See every check<Arrow /></Link>
                    {raised && <Link className="btn btn-outline btn-sm" to={`/clinician/${person.id}`}>Open the packet</Link>}
                    <Link className="btn btn-outline btn-sm" to={`/me/${person.id}`}>What they see</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence, labelled by kind */}
      <section className="section section--alt">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Evidence so far</span>
            <h2>What we measured, and what we have not.</h2>
            <p className="lead">Each figure says where it comes from. Anyone can rerun the simulation from the repository.</p>
          </div>
          <div className="bento">
            <div className="span-3 reveal">
              <span className="lbl working">Real survey data</span>
              <p className="stat">48% <span>vs</span> 16%</p>
              <p className="t-small">Adults over 60 with no memory complaint who fall under a common animal-naming cutoff: under 9 years of school against college graduates.</p>
            </div>
            <div className="span-3 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{pct(ours.falseAlarmYear)} <span>false alarms a year</span></p>
              <p className="t-small">In stable people, against {pct(single.falseAlarmYear)} for a rule that flags on one low check. {data.n.toLocaleString()} simulated people per setting.</p>
            </div>
            <div className="span-2 reveal">
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{Math.round(ours.detected['2'] * 100)}%</p>
              <p className="t-small">of people losing two points a check are flagged within the year.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{Math.round(burden.packetsPer1000)} <span>per 1,000</span></p>
              <p className="t-small">packets a year for physicians, {Math.round(burden.realPer1000)} of them real, if 2% of members are in real decline.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <span className="lbl working">Real recordings</span>
              <p className="stat">{Math.round(speech.en.overall.correct / speech.en.overall.n * 100)}% <span>vs</span> {Math.round(speech.ar.overall.correct / speech.ar.overall.n * 100)}%</p>
              <p className="t-small">of real single words heard right by the on-device listener, English against Arabic: {(speech.en.overall.n + speech.ar.overall.n).toLocaleString()} clips from public recordings of adult volunteers. Arabic needs the browser's listener and native recordings; neither set has older speakers.</p>
            </div>
          </div>
          <p className="center-link reveal"><Link className="btn btn-outline" to="/benchmark">How the flag was tested<Arrow /></Link></p>
        </div>
      </section>

      {/* Path to a pilot */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Path to a pilot</span>
            <h2>Twelve months, one screening provider, two arms.</h2>
            <p className="lead">A feasibility pilot after ethics approval. It measures whether people finish a baseline and whether approved packets reach a specialist on time. True decline is too rare at 50 to 64 for one site to measure detection, so the pilot does not claim to.</p>
          </div>
          <div className="pilot reveal">
            <div className="pilot__col">
              <p className="eyebrow">Design</p>
              <ul className="checks">
                <li>Members aged 50 to 64, randomised at the screening visit</li>
                <li>Usual care, or usual care plus a check about every six weeks</li>
                <li>250 per arm, sized on baseline completion (55% expected, within 7 points)</li>
                <li>Agreement with a human listener and retest, by language, age and schooling</li>
              </ul>
            </div>
            <div className="pilot__col">
              <p className="eyebrow">Stop and review if</p>
              <ul className="checks">
                <li>Physicians dismiss more than half of packets over three months</li>
                <li>More than one distress complaint per 100 members</li>
                <li>Any serious event where a home check delayed care</li>
                <li>More than 20% of checks cannot be scored</li>
              </ul>
            </div>
            <div className="pilot__col">
              <p className="eyebrow">Cost lines, estimated before measuring</p>
              <ul className="checks">
                <li>On-device listener: nothing per check</li>
                <li>Physician: about 10 minutes a packet, about 8 hours per 1,000 members a year (simulated packet rate)</li>
                <li>Hosting and any cloud listener in a UAE region</li>
                <li>Paid first by the screening programme; then insurers and employers for residents outside it</li>
              </ul>
            </div>
          </div>
          <p className="pilot-note reveal">Regulatory route: the pilot runs as research under ethics approval; registration as medical-device software would follow on its evidence. Cloud processing of health data needs the Department of Health's approval. No price is quoted before the cost lines are measured.</p>
        </div>
      </section>

      {/* Questions */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal"><h2>Questions people ask.</h2></div>
          <div className="faq reveal">
            <details><summary>Does it diagnose dementia?</summary><p>No. It looks for change against the person's own earlier checks and asks a physician to decide what to do. A score in the usual range does not rule out impairment, and the clinic memory test at the screening visit continues as before.</p></details>
            <details><summary>Why by voice?</summary><p>Many older adults in the Gulf had little schooling, and tests that need reading, typing or tapping are unfair to them. Saying words back and naming animals is how memory has been tested over the telephone for decades.</p></details>
            <details><summary>Where does my voice go?</summary><p>The speech model on the device sends nothing anywhere. The browser's own recogniser may send audio to the browser's maker. In a pilot, any cloud listener would run in a UAE region and only with the regulator's approval.</p></details>
            <details><summary>What if I don't hear well?</summary><p>Every check starts with a sound check. If it fails, the check is held, not scored low. After two held checks the app suggests a hearing test, which also makes later checks fairer.</p></details>
            <details><summary>Has it been tested on real people?</summary><p>Partly. The on-device listener was measured on 1,107 real recordings of single words from public datasets of adult volunteers: it heard 62% right in English and 40% in Arabic, which is why every recording can also be scored by a person. The full check has not yet been taken by older or Gulf Arabic speakers, and the rule has been tested on simulated people only.</p></details>
            <details><summary>Who sees the scores?</summary><p>Only the ordering physician at the screening clinic, and only if the person agreed. The person hears about any result at an in-person visit.</p></details>
          </div>
        </div>
      </section>

      {/* Final call */}
      <section className="section section--alt final">
        <div className="container">
          <img className="final-icon" src={ICON} alt="" />
          <h2>Four minutes, by voice. <span className="t-muted">Try it now.</span></h2>
          <div className="cta-row">
            <Link to="/try" className="btn btn-ink btn-lg"><Mic />Try it with your voice</Link>
            <Link to="/year" className="btn btn-outline btn-lg">See a year of checks</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
