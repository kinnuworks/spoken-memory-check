import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ANIMALS, type Lang } from '../engine/lexicon'
import { REVIEW_RATE, compareRows, loadReviews, saveReview, tally } from '../engine/rescore'
import { scoreTask, type RangeScore } from '../engine/score'
import { decodeTo16k } from '../speech/capture'
import { DOWNLOAD_MB, SECOND_NAME, loadSecond, transcribeSecond } from '../speech/second'

const CLIP: Record<Lang, string> = { en: 'samples/synthetic-voice-animals-en.wav', ar: 'samples/synthetic-voice-animals-ar.wav' }
type Stage = 'listen' | 'scoring' | 'compare' | 'failed'

export default function Rescore() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>('listen')
  const [typed, setTyped] = useState('')
  const [human, setHuman] = useState<RangeScore | null>(null)
  const [machine, setMachine] = useState<RangeScore | null>(null)
  const [percent, setPercent] = useState(0)
  const [reviews, setReviews] = useState(loadReviews())
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const label = (row: number) => ANIMALS[lang][row][0]

  async function submit() {
    const h = scoreTask({ Reviewer: typed }, ANIMALS[lang], lang)
    setHuman(h)
    setStage('scoring')
    try {
      const audio = await decodeTo16k(await (await fetch(CLIP[lang])).arrayBuffer())
      await loadSecond(lang, setPercent)
      const text = await transcribeSecond(audio, lang, 180000)
      if (text === null) return setStage('failed')
      const m = scoreTask({ [SECOND_NAME]: text }, ANIMALS[lang], lang)
      setMachine(m)
      const c = compareRows(h.items.map((i) => i.row), m.items.map((i) => i.row))
      setReviews(saveReview({ date: new Date().toISOString().slice(0, 10), lang, clip: CLIP[lang], human: h.high, machine: m.high, agreement: c.agreement }))
      setStage('compare')
    } catch {
      setStage('failed')
    }
  }

  const cmp = human && machine ? compareRows(human.items.map((i) => i.row), machine.items.map((i) => i.row)) : null
  const t = tally(reviews)

  return (
    <>
      <h1>Blind re-scoring</h1>
      <p><span className="tag syn">Recording is a computer voice, not a person</span></p>
      <p className="lead-p">One recorded check in {REVIEW_RATE} is picked at random and scored again by a second person who cannot see the machine's result. The programme sees how often people and machine agree, by language, so drift in the speech listeners shows up early. Try it as the reviewer.</p>

      <div className="segmented" role="group" aria-label="Language">
        <button className="seg" aria-pressed={lang === 'en'} disabled={stage === 'scoring'} onClick={() => { setLang('en'); setStage('listen'); setTyped(''); setHuman(null); setMachine(null) }}>English</button>
        <button className="seg" lang="ar" aria-pressed={lang === 'ar'} disabled={stage === 'scoring'} onClick={() => { setLang('ar'); setStage('listen'); setTyped(''); setHuman(null); setMachine(null) }}>العربية</button>
      </div>

      <div className="card">
        <p className="eyebrow">Picked for review · animal naming</p>
        <audio controls src={CLIP[lang]} />
        {stage === 'listen' && (
          <>
            <label>Type every animal you hear, in any order
              <textarea lang={lang} dir={dir} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={lang === 'ar' ? 'جمل، حصان، كلب' : 'dog, cat, horse'} />
            </label>
            {typed.trim() && <div className="chips" lang={lang} dir={dir}>{scoreTask({ Reviewer: typed }, ANIMALS[lang], lang).items.map((i) => <span key={i.row} className="chip">{i.label}</span>)}</div>}
            <p className="muted">The machine's score stays hidden until you submit. It runs on this device and needs a one-time download of about {DOWNLOAD_MB[lang]} MB.</p>
            <div className="stack"><button className="primary" disabled={!typed.trim()} onClick={submit}>Submit my score</button></div>
          </>
        )}
        {stage === 'scoring' && <><p className="listening"><i />Your score is saved. Now the machine scores the same recording on this device…</p>{percent > 0 && percent < 100 && <div className="meter"><i style={{ width: `${percent}%` }} /></div>}</>}
        {stage === 'failed' && <p className="note">The on-device listener could not run here, so there is nothing to compare. Older or low-memory devices cannot run it.</p>}
      </div>

      {stage === 'compare' && human && machine && cmp && (
        <>
          <h2>You and the machine</h2>
          <div className="tiles">
            <div className="card"><p className="muted">You heard</p><p className="big small-big">{human.high}</p></div>
            <div className="card"><p className="muted">The machine heard</p><p className="big small-big">{machine.high}</p></div>
            <div className="card"><p className="muted">Agreement on items</p><p className="big small-big">{Math.round(cmp.agreement * 100)}%</p><p className="muted">Heard by both, over heard by either.</p></div>
          </div>
          <div className="chips" lang={lang} dir={dir}>
            {cmp.both.map((r) => <span key={r} className="chip both">{label(r)}</span>)}
            {cmp.humanOnly.map((r) => <span key={r} className="chip one">{label(r)} · you only</span>)}
            {cmp.machineOnly.map((r) => <span key={r} className="chip one">{label(r)} · machine only</span>)}
          </div>
        </>
      )}

      <h2>Running agreement on this device</h2>
      <div className="scroll" tabIndex={0} role="region" aria-label="Running agreement on this device"><table>
        <thead><tr><th>Language</th><th>Reviews</th><th>Mean agreement</th><th>Machine minus person, items</th></tr></thead>
        <tbody>{t.map((r) => (
          <tr key={r.lang}><td>{r.lang === 'en' ? 'English' : 'Arabic'}</td><td>{r.n}</td><td>{r.agreement === null ? '–' : `${Math.round(r.agreement * 100)}%`}</td><td>{r.countGap === null ? '–' : r.countGap.toFixed(1)}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="muted">In a programme, reviews come from trained staff across all facilities and the figures feed the programme view. If agreement in a language falls, that language's checks are held for human scoring until it is fixed. Only the reviews done on this device are counted here.</p>
      <div className="stack"><Link className="btn" to="/programme">Programme view</Link></div>
    </>
  )
}
