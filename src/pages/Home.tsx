import { useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'
import tests from '../data/tests.json'
import sada from '../data/sada-bench.json'
import mutation from '../data/mutation-summary.json'
import coverage from '../data/coverage-summary.json'
import live from '../data/live-check.json'
import reading from '../data/reading-grade.json'
import { COST_DEFAULTS, yearlyCost } from '../engine/cost'
import { evaluate } from '../engine/change'
import { PERSONAS } from '../engine/histories'
import { treatableContributors } from '../engine/packet'
import { ICON, useReveal } from '../components/brand'
import { Alert, Arrow, Code, Ear, EyeOff, List, Mic, Moon, Play, Stethoscope } from '../components/Icons'
import dunes from '../assets/dunes.jpg'
import { SurveyBars } from './SurveyChart'
import TrajectoryChart from './TrajectoryChart'
import '../styles/home.css'

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

const decline = PERSONAS.find((p) => p.id === 'decline')!
const declineTraj = evaluate(decline.checks)
const declineFlag = declineTraj.results.find((r) => r.status === 'flag')!
const rows = data.rows.filter((r) => r.world === 'As assumed')
const ours = rows.find((r) => r.rule === 'ours')!
const single = rows.find((r) => r.rule === 'single-low')!
const burden = data.burden.find((b) => b.prevalence === 0.02)!

export default function Home() {
  useReveal()
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
            <Link to="/story" className="btn btn-outline btn-lg"><Stethoscope />See one case, both screens</Link>
          </div>
          <p className="trust"><Link to="/recorded-check" style={{ textDecoration: 'underline', color: 'inherit' }}>Or play the full four-minute check, recorded</Link></p>
          <p className="trust"><span>No sign-up</span><span>Works in the browser</span><span>People shown are synthetic</span><span>Does not diagnose</span></p>
          <ul className="proof" aria-label="What is measured so far">
            <li><b>{Math.round(own.union.rate * 100)}%</b><span>of {own.whisperAlone.n} real Arabic words heard right on the device, with the speaker's own voice as the answer key; 99% in a lab test adding MBZUAI and Inception's Jais-ASR</span></li>
            <li><b>{Math.round(sada.results.jaisAsr['Older, Gulf (Khaliji)'].wer * 100)}% vs {Math.round(sada.results.jaisAsr['Adult, Gulf (Khaliji)'].wer * 100)}%</b><span>word error for older against adult Gulf speakers on public Saudi TV speech: older voices heard no worse</span></li>
            <li><b>52-45 · 52-46</b><span>the Thiqa hearing and dementia screening packages it fills the memory step of</span></li>
            <li><b>0 errors</b><span>from the official HL7 FHIR validator; referrals in the HL7 form Malaffi asks for</span></li>
          </ul>

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

      {/* Evidence, labelled by kind */}
      <section className="section section--alt">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow"><span className="dot" />Evidence so far</span>
            <h2>What we measured, and what we have not.</h2>
            <p className="lead">Each figure says whether it comes from real recordings, a simulation or the code. No patients yet.</p>
          </div>
          <div className="bento">
            <div className="span-3 reveal">
              <span className="lbl working">Real recordings</span>
              <p className="stat">{Math.round(own.union.rate * 100)}% <span>of Arabic words heard right</span></p>
              <p className="t-small">{own.whisperAlone.n} real single words from {own.speakers} adult volunteers, scored on the device with the speaker's own voice as the answer key ({Math.round(own.whisperAlone.rate * 100)}% by the speech model alone; {(own.templateFalseCredit.rate * 100).toFixed(1)}% wrong words credited). Read words, not recall.</p>
            </div>
            <div className="span-3 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl working">Older speakers, public data</span>
              <p className="stat">{Math.round(sada.results.jaisAsr['Older, Gulf (Khaliji)'].wer * 100)}% <span>vs</span> {Math.round(sada.results.jaisAsr['Adult, Gulf (Khaliji)'].wer * 100)}%</p>
              <p className="t-small">Word error for older against adult Gulf speakers on Saudi TV speech ({sada.results.jaisAsr['Older, Gulf (Khaliji)'].clips} and {sada.results.jaisAsr['Adult, Gulf (Khaliji)'].clips} clips). Both listeners heard older Gulf voices no worse. Not yet older Emirati volunteers doing the check.</p>
            </div>
            <div className="span-2 reveal">
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{pct(ours.falseAlarmYear)} <span>false alarms a year</span></p>
              <p className="t-small">in stable people, against {pct(single.falseAlarmYear)} for a rule that flags on one low check.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{Math.round(ours.detected['2'] * 100)}% <span>/</span> {Math.round(ours.detected['1'] * 100)}%</p>
              <p className="t-small">of people losing two points a check, and one point a check, flagged within the year.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <span className="lbl simulated">Simulated</span>
              <p className="stat">{Math.round(burden.packetsPer1000)} <span>per 1,000</span></p>
              <p className="t-small">physician packets a year, {Math.round(burden.realPer1000)} of them real, if 2% of members are in real decline.</p>
            </div>
            <div className="span-2 reveal">
              <span className="lbl working">Tested code</span>
              <p className="stat">{Math.round(coverage.engine.lines * 100)}% <span>of lines</span></p>
              <p className="t-small">of the decision code run by {tests.passed} tests, which catch {Math.round(mutation.score * 100)}% of {mutation.mutants} deliberate bugs put into the rules.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <span className="lbl working">Live site</span>
              <p className="stat">{live.passed} <span>of</span> {live.total}</p>
              <p className="t-small">steps passed end to end on the live site in a real browser ({live.ranAt.slice(0, 10)}), both recorded checks included.</p>
            </div>
            <div className="span-2 reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <span className="lbl working">Plain language</span>
              <p className="stat">Grade {Math.ceil(Math.max(...reading.screens.map((x) => x.grade)))}</p>
              <p className="t-small">reading level or under on every screen and prompt the person meets, in English. Arabic not graded.</p>
            </div>
          </div>
          <p className="center-link reveal"><Link className="btn btn-outline" to="/benchmark">How the flag was tested<Arrow /></Link></p>
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
          <p className="t-small reveal" style={{ marginTop: 20 }}>The same happens in the Gulf. With the usual MoCA cut-off of 26, 69.3% of 606 older adults in Dubai and Sharjah were classed as impaired (<a href="https://doi.org/10.3389/fragi.2026.1822042">Issa et al. 2026</a>), and 74.3% of 308 healthy adults in Qatar scored below it; those authors proposed 22 instead (<a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11807847/">Qatar study</a>).</p>
        </div>
      </section>

      {/* How it works, in three blocks */}
      <section className="section">
        <div className="container vstack">
          <div className="split reveal">
            <div>
              <span className="eyebrow"><Mic />Three listeners</span>
              <h3>Every score shows how sure it is.</h3>
              <p className="lead">The browser's recogniser and a speech model on the device hear the same words, and recalled words are also matched against the person's own voice from when they said each word back. A word heard by two counts; a word heard by one widens the range. A range too wide is "not scored", never low.</p>
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
              <p className="lead">After two low checks in a row, the ordering physician gets the trajectory, the treatable causes to rule out first and the risk factors already on record. If they approve, the person is invited to a visit and hears the result in person.</p>
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
              <p className="lead">The clock runs against the screening programme's own 15-working-day target. A <Link to="/programme">programme view</Link> counts every member by facility, including people lost to follow-up.</p>
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

      {/* Who pays */}
      <WhoPays />

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

const aed = (x: number) => `AED ${Math.round(x).toLocaleString('en')}`

/** Who pays, the modelled yearly cost for one screening provider, and the first pilot ask. */
function WhoPays() {
  const [uptake, setUptake] = useState(COST_DEFAULTS.uptake)
  const c = yearlyCost({ ...COST_DEFAULTS, uptake })
  return (
    <section className="section section--alt">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot" />Where it fits, and who pays</span>
          <h2>About AED {Math.round(yearlyCost().perEligibleAed)} per eligible member a year.</h2>
          <p className="lead">Since 1 September 2026 the adult screening programme has two Thiqa-funded packages called "Comprehensive hearing and dementia screening": 52-45 every three years at 50 to 64, and 52-46 every year at 65 to 75. The billing names no memory tool; in clinic the programme uses the MoCA. This check adds the memory step at home between visits, for people already in the programme, and the programme pays through the package. It watches members for change; it does not screen the whole population.</p>
          <p className="t-small">Why now: in 825 patients at a government hospital in Al Ain, dementia was diagnosed a median of 24 months after symptoms began (<a href="https://doi.org/10.1192/bji.2025.10077">Javaid et al. 2026</a>), and the anti-amyloid medicines approved in the UAE are only for mild cognitive impairment or mild dementia (<a href="https://doi.org/10.1007/s40120-025-00833-8">UAE expert consensus, 2025</a>). Finding change earlier decides who can still be offered them.</p>
        </div>
        <div className="fit reveal" style={{ marginBottom: 24 }}>
          <div className="fit__step"><span className="fit__n">1</span><p className="t-title">Hearing first</p><p className="t-small">A failed hearing check goes to ENT and holds the memory check, so poor hearing is not read as poor memory.</p></div>
          <div className="fit__step"><span className="fit__n">2</span><p className="t-title">Baseline at the visit, checks at home</p><p className="t-small">The first checks set the person's own baseline; home checks fill the years between visits.</p></div>
          <div className="fit__step"><span className="fit__n">3</span><p className="t-title">Referral the way Malaffi wants it</p><p className="t-small">An approved packet becomes an HL7 v2 REF message with a SNOMED-coded specialty, and a FHIR ServiceRequest.</p></div>
        </div>
        <div className="pilot reveal">
          <div className="pilot__col">
            <p className="eyebrow">Modelled cost, one provider with {COST_DEFAULTS.eligible.toLocaleString('en')} members</p>
            <label className="t-small" htmlFor="uptake">Members who take part: <strong>{Math.round(uptake * 100)}%</strong></label>
            <input id="uptake" type="range" min={0.1} max={0.8} step={0.05} value={uptake} onChange={(e) => setUptake(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <p className="stat">{aed(c.perEligibleAed)} <span>per eligible member a year</span></p>
            <p className="t-small">{aed(c.perCheckAed)} per check; {c.checks.toLocaleString('en')} checks and {c.packets.toLocaleString('en')} physician packets a year, about {Math.round(c.physicianHours)} physician hours in all.</p>
            <table>
              <tbody>
                {c.lines.map((l) => <tr key={l.name}><th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>{l.name}</th><td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{aed(l.aed)}</td></tr>)}
                <tr><th scope="row" style={{ textAlign: 'left' }}>Total a year</th><td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}><strong>{aed(c.totalAed)}</strong></td></tr>
              </tbody>
            </table>
            <p className="t-small">Fixed costs dominate. The on-device listener costs nothing per check, and cloud speech in a UAE region is under 2% of the total. Most inputs are our assumptions until a pilot measures them; each one is listed with its source in the commercial case.</p>
          </div>
          <div className="pilot__col">
            <p className="eyebrow">Billing routes to confirm</p>
            <ul className="checks">
              <li>The memory step of packages 52-45 and 52-46, paid per enrolled member by the programme</li>
              <li>Physician packet review as a remote service: DoH's telemedicine addendum lists remote data review (99091) and e-consults (99446 to 99448). Whether a packet qualifies is for the partner's billing team to confirm</li>
              <li>For residents outside the programme: insurers and employers, at the same cost per member</li>
            </ul>
            <p className="eyebrow">For comparison</p>
            <p className="t-small">Published prices of other digital memory tests: about US$40 a test (Cognivue clinics), US$25 a test (BrainTest eSAGE, 2022) and US$299 a month for up to ten patients (BrainCheck). Those are prices; ours is a cost before any margin.</p>
          </div>
          <div className="pilot__col">
            <p className="eyebrow">Who we would ask first</p>
            <ul className="checks">
              <li>ADPHC, which runs the adult screening programme and counts referrals within 15 days</li>
              <li>SEHA clinics that deliver the programme, with the memory clinic at Sheikh Shakhbout Medical City</li>
              <li>M42 (Cleveland Clinic Abu Dhabi, Healthpoint), which also reaches privately insured residents</li>
            </ul>
            <p className="t-small">The ask is a 12-month feasibility pilot at one screening clinic after ethics approval: members aged 50 to 64 randomised to usual care or usual care plus home checks, 250 per arm, with stop rules (for example, physicians dismissing over half of packets). The partner keeps the data. No partner has agreed yet. <Link to="/how" style={{ textDecoration: 'underline', color: 'inherit' }}>Pilot design and questions</Link></p>
          </div>
        </div>
        <p className="pilot-note reveal">Sources: DoH Claims Adjudication Rules, Addendum 06 (IFHAS 3.0) and Addendum 30 (telemedicine); Azure retail prices for UAE North. Package prices sit in the mandatory tariff, which we have not seen.</p>
      </div>
    </section>
  )
}

