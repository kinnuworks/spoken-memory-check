import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COST_DEFAULTS, yearlyCost } from '../engine/cost'

const aed = (x: number) => `AED ${Math.round(x).toLocaleString('en')}`

/** Who pays, the modelled yearly cost for one screening provider, and the first pilot ask. */
export function WhoPays() {
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

