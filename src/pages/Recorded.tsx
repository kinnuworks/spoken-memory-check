import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ANIMALS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { decodeTo16k } from '../speech/capture'
import { DOWNLOAD_MB, SECOND_NAME, loadSecond, transcribeSecond } from '../speech/second'
import SurveyChart from './SurveyChart'

const CLIP: Record<Lang, string> = { en: 'samples/synthetic-voice-animals-en.wav', ar: 'samples/synthetic-voice-animals-ar.wav' }
type Stage = 'intro' | 'loading' | 'listening' | 'result' | 'failed'

export default function Recorded() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>('intro')
  const [percent, setPercent] = useState(0)
  const [score, setScore] = useState<RangeScore | null>(null)
  const [seconds, setSeconds] = useState(0)

  async function run() {
    try {
      setStage('loading')
      const bytes = await (await fetch(CLIP[lang])).arrayBuffer()
      const audio = await decodeTo16k(bytes)
      await loadSecond(lang, setPercent)
      setStage('listening')
      const t0 = performance.now()
      const text = await transcribeSecond(audio, lang, 180000)
      if (text === null) return setStage('failed')
      setSeconds(Math.round((performance.now() - t0) / 100) / 10)
      setScore(scoreTask({ [SECOND_NAME]: text }, ANIMALS[lang], lang))
      setStage('result')
    } catch {
      setStage('failed')
    }
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  return (
    <>
      <h1>Play a recorded check</h1>
      <p><span className="tag syn">Synthetic voice, not a person</span></p>
      <div className="segmented" role="group" aria-label="Language">
        <button className="seg" aria-pressed={lang === 'en'} disabled={stage !== 'intro' && stage !== 'result'} onClick={() => { setLang('en'); setStage('intro') }}>English</button>
        <button className="seg" lang="ar" aria-pressed={lang === 'ar'} disabled={stage !== 'intro' && stage !== 'result'} onClick={() => { setLang('ar'); setStage('intro') }}>العربية</button>
      </div>
      <p>No microphone needed. This is a computer voice naming twenty animals, heard by the same on-device listener the spoken check uses. Play it, then let the listener score it.</p>
      <audio controls src={CLIP[lang]} style={{ width: '100%' }} />

      {stage === 'intro' && (
        <>
          <p className="note">The listener is an open speech model that runs on this device. It needs a one-time download of about {DOWNLOAD_MB[lang]} MB from huggingface.co. The recording is not sent anywhere.</p>
          <div className="stack"><button className="primary" onClick={run}>Score this recording on my device</button></div>
        </>
      )}
      {stage === 'loading' && <div><p className="muted">Getting the listener ready on this device: {percent}%</p><div className="meter"><i style={{ width: `${percent}%` }} /></div></div>}
      {stage === 'listening' && <p className="listening"><i />Listening to the recording on this device…</p>}
      {stage === 'failed' && (
        <>
          <p>The on-device listener could not run here. Older or low-memory devices score with one listener only.</p>
          <div className="stack"><Link className="btn primary" to="/year">See a year of checks</Link></div>
        </>
      )}
      {stage === 'result' && score && (
        <>
          <h2>What the listener heard</h2>
          <p className="big">{score.high} of 20 animals</p>
          <div className="chips" dir={dir}>{score.items.map((it) => <span key={it.row} className="chip">{it.label}</span>)}</div>
          {score.unmatched.length > 0 && <p className="muted" dir={dir}>Heard but not on the accepted list, so not counted: {score.unmatched.slice(0, 12).join(lang === 'ar' ? '، ' : ', ')}.</p>}
          <p className="note">Scored on this device in {seconds} seconds. Twenty animals were said, so anything short of twenty is a miss by the listener. A computer voice is the easy case; people, and Gulf Arabic speakers above all, have not been measured yet. In a spoken check the browser's own recogniser listens too, and each animal is marked as heard by both or by one.</p>
          <SurveyChart />
          <div className="stack"><Link className="btn primary" to="/year">See a year of checks</Link></div>
        </>
      )}
    </>
  )
}
