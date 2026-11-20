import { useState } from 'react'
import privacy from '../data/privacy-check.json'
import safety from '../data/safety-check.json'
import { checkPromises, PROMISES } from '../engine/safety'

const n = (x: number) => x.toLocaleString('en')

/** What leaves the device during a check by voice, from the browser's own network log. */
export function PrivacyProof() {
  const rows = privacy.runs
  return (
    <section id="privacy">
      <h2>Nothing leaves the device: the browser's own record</h2>
      <p><span className="tag">Our own test, on the live site</span></p>
      <p>The claim is that your voice is scored on your device and sent nowhere. The page counts every upload it makes and shows the total after each check. That count runs inside our own code, so it is checked from outside too: Chromium writes a log of every request it makes, from the page, its workers and everything else, and a computer voice goes through "Try it with your voice" while it records.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Network log of a check by voice"><table>
        <thead><tr><th>Language</th><th>Requests</th><th>Uploaded</th><th>Went to</th><th>The page's own count</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.lang}><th scope="row">{r.lang === 'ar' ? 'Arabic' : 'English'}</th><td>{n(r.requests)}, all downloads ({Object.entries(r.methods).map(([k, v]) => `${v} ${k}`).join(', ')})</td><td><strong>{n(r.uploadBytes)} bytes</strong>, {r.websocketEvents} WebSocket messages</td><td>{r.hosts.map((h: string) => h.replace(/^us\.aws\.cdn\.hf\.co$/, 'cdn.hf.co (model files)')).join(', ')}</td><td>{n(r.pageCounter.bytes)} bytes</td></tr>
        ))}</tbody>
      </table></div>
      <p className="muted">Run on {privacy.ranAt.slice(0, 10)} against {privacy.url.replace(/^https?:\/\//, '')}, with a computer voice as the microphone, not a person. The downloads are the app and the speech model: Arabic comes from this site, English from huggingface.co. Not covered: the browser's own speech service, which a person can turn on and which records audio inside the browser. Rerun: <code>npx tsx scripts/privacy-check.ts</code>.</p>
    </section>
  )
}

/** The rule's safety promises: a million random histories, and a run in the visitor's own browser. */
export function SafetyPromises() {
  const [run, setRun] = useState<{ done: number; ms: number; broke: number; seed: number; running: boolean } | null>(null)
  const go = () => {
    const seed = Math.floor(Math.random() * 1e9)
    const total = 100_000, chunk = 10_000
    let done = 0, broke = 0
    const t0 = performance.now()
    setRun({ done: 0, ms: 0, broke: 0, seed, running: true })
    const step = () => {
      const rep = checkPromises(chunk, seed + done)
      broke += Object.values(rep.violations).reduce((a, b) => a + b, 0)
      done += chunk
      setRun({ done, ms: performance.now() - t0, broke, seed, running: done < total })
      if (done < total) setTimeout(step, 0)
    }
    setTimeout(step, 0)
  }
  const total = Object.values(safety.violations).reduce((a, b) => a + b, 0)
  return (
    <section id="safety">
      <h2>Nine safety promises, tested on a million random histories</h2>
      <p><span className="tag">Our own break test</span></p>
      <p>Each promise below is something this site says the rule does. A program made {n(safety.histories)} random histories of checks ({n(safety.checks)} checks in all) with missed checks, failed sound checks, off days, wide ranges, slow falls and sudden crashes, and ran the rule on every one. {total === 0 ? <strong>None broke any promise.</strong> : <strong>{n(total)} broke a promise.</strong>}</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Safety promises"><table>
        <thead><tr><th>Promise</th><th>Histories that broke it</th></tr></thead>
        <tbody>{PROMISES.map((p) => <tr key={p.id}><td>{p.text}</td><td>{n((safety.violations as Record<string, number>)[p.id])} of {n(safety.histories)}</td></tr>)}</tbody>
      </table></div>
      <p>It found one real gap first. A "yes" to the everyday-tasks question on a check that could not be scored was dropped, so the physician never heard it: {n(safety.foundBeforeFix.broke)} of {n(safety.foundBeforeFix.histories)} histories broke that promise. The rule was fixed on {safety.foundBeforeFix.date}, and the same test now passes.</p>
      <div className="card">
        <p><strong>Run it yourself.</strong> This button makes 100,000 new random histories in your browser and runs them through the same rule this site uses.</p>
        <div className="stack"><button className="primary" disabled={run?.running} onClick={go}>{run?.running ? `Checking… ${n(run.done)} histories` : 'Check 100,000 random histories now'}</button></div>
        {run && !run.running && <p data-safety-run={run.broke}><strong>{n(run.done)} histories checked in {(run.ms / 1000).toFixed(1)} s: {run.broke === 0 ? 'none broke any promise' : `${n(run.broke)} broke a promise`}.</strong> <span className="muted">Seed {run.seed}.</span></p>}
      </div>
      <p className="muted">Rerun the million: <code>npx tsx scripts/safety-check.ts</code> (about 20 s; it is part of every check before a deploy). The promises are about what the rule does with the checks it gets. They do not show that the check finds disease.</p>
    </section>
  )
}
