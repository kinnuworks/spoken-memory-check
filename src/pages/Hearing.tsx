import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DIN, classify, isCorrect, loadHearing, nextSnr, saveHearing, srt, triplet, type DinResult, type DinTrial } from '../engine/din'
import { prepare, play, sample } from '../speech/dinAudio'

type Stage = 'intro' | 'loading' | 'listen' | 'answer' | 'result' | 'failed'
type Wear = 'most' | 'some' | 'none'
const WEAR_KEY = 'aid-wear'
const WEAR_LABEL: Record<Wear, string> = { most: 'Most of the day', some: 'Some of the time', none: 'Not at all' }

function loadWear(): { date: string; wear: Wear }[] {
  try { return JSON.parse(localStorage.getItem(WEAR_KEY) ?? '[]') } catch { return [] }
}

export default function Hearing() {
  const [lang, setLang] = useState<'en' | 'ar'>('en')
  const [stage, setStage] = useState<Stage>('intro')
  const [trials, setTrials] = useState<DinTrial[]>([])
  const [answer, setAnswer] = useState<number[]>([])
  const [result, setResult] = useState<DinResult | null>(null)
  const [past, setPast] = useState(loadHearing())
  const [wear, setWear] = useState(loadWear())
  const current = useRef<{ digits: number[]; snr: number }>({ digits: [], snr: DIN.startSnr })

  async function next(snr: number) {
    const digits = triplet(Math.random)
    current.current = { digits, snr }
    setAnswer([])
    setStage('listen')
    await play(lang, digits, snr)
    setStage('answer')
  }

  async function start() {
    setStage('loading')
    try {
      await prepare(lang)
      setTrials([])
      await next(DIN.startSnr)
    } catch {
      setStage('failed')
    }
  }

  async function trySample() {
    try { await prepare(lang); await sample(lang) } catch { setStage('failed') }
  }

  function press(d: number) {
    if (stage !== 'answer' || answer.length >= 3) return
    const a = [...answer, d]
    setAnswer(a)
    if (a.length < 3) return
    const { digits, snr } = current.current
    const ok = isCorrect(digits, a)
    const all = [...trials, { digits, answer: a, snr, correct: ok }]
    setTrials(all)
    if (all.length >= DIN.trials) {
      const value = srt(all)
      const r: DinResult = { date: new Date().toISOString().slice(0, 10), lang, srt: value, outcome: classify(value), trials: all }
      setPast(saveHearing(r))
      setResult(r)
      setStage('result')
    } else {
      window.setTimeout(() => void next(nextSnr(snr, ok)), 450)
    }
  }

  function recordWear(w: Wear) {
    const all = [...wear, { date: new Date().toISOString().slice(0, 10), wear: w }]
    setWear(all)
    try { localStorage.setItem(WEAR_KEY, JSON.stringify(all)) } catch { /* keep in memory */ }
  }

  const keypad = (
    <div className="keypad" role="group" aria-label="Digits">
      {DIN.digits.map((d) => <button key={d} className="key" disabled={stage !== 'answer'} onClick={() => press(d)}>{d}</button>)}
      <button className="key key--wide" disabled={stage !== 'answer' || !answer.length} onClick={() => setAnswer(answer.slice(0, -1))}>Undo</button>
    </div>
  )

  return (
    <>
      <h1>Hearing check</h1>
      <p><span className="tag syn">Digits recorded with a computer voice, not yet a native speaker</span></p>
      <p className="lead-p">In the 2024 Lancet Commission report, hearing loss is one of the two largest risk factors for dementia that can be changed, and most people with it are never fitted with a hearing aid. This three-minute check comes before the memory check: three spoken digits in noise, and you tap what you heard. No speech recognition is involved.</p>

      {stage === 'intro' && (
        <>
          <div className="segmented" role="group" aria-label="Language">
            <button className="seg" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            <button className="seg" lang="ar" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>العربية</button>
          </div>
          <ol className="steps">
            <li>Use headphones if you have them, in a quiet room.</li>
            <li>Play the sample and set the volume so the voice is clear and comfortable. Then leave the volume alone.</li>
            <li>You will hear {DIN.trials} sets of three digits. Tap the three you heard, in order. Guess if you are not sure.</li>
          </ol>
          <div className="stack">
            <button onClick={trySample}>Play a sample to set the volume</button>
            <button className="primary" onClick={start}>Start the hearing check</button>
          </div>
          {past.length > 0 && <p className="muted">Checks on this device: {past.map((p) => `${p.date} (${p.outcome === 'pass' ? 'no sign of difficulty' : 'hearing test suggested'})`).join(', ')}.</p>}
        </>
      )}

      {stage === 'loading' && <p className="listening"><i />Getting the recordings ready…</p>}
      {stage === 'failed' && <p className="note">Sound could not play on this device. Check that the volume is on and try again in Chrome or Safari.</p>}

      {(stage === 'listen' || stage === 'answer') && (
        <div className="din">
          <p className="muted">Set {trials.length + 1} of {DIN.trials}</p>
          <div className="meter"><i style={{ width: `${(trials.length / DIN.trials) * 100}%` }} /></div>
          <div className="slots" aria-live="polite">
            {[0, 1, 2].map((i) => <span key={i} className={`slot${answer[i] ? ' filled' : ''}`}>{answer[i] ?? ''}</span>)}
          </div>
          <p className={stage === 'listen' ? 'listening' : 'muted'}>{stage === 'listen' ? <><i />Listen…</> : 'Tap the three digits you heard.'}</p>
          {keypad}
        </div>
      )}

      {stage === 'result' && result && (
        <>
          <h2>{result.outcome === 'pass' ? 'No sign of hearing difficulty in this check.' : 'A full hearing test would help.'}</h2>
          <p>{result.outcome === 'pass'
            ? 'Hearing well also makes the memory check fairer. The check repeats once a year.'
            : 'With your agreement, your physician at the screening clinic is asked to refer you to audiology. The memory check waits until your hearing has been checked, so a hearing problem is not mistaken for a memory problem.'}</p>
          <details className="card tester">
            <summary>For the tester: how this was scored</summary>
            <p>Speech reception threshold {result.srt.toFixed(1)} dB signal-to-noise (the mean of sets {DIN.firstCounted + 1} to {DIN.trials} and the next level). Lower is better. Refer above {DIN.referAbove} dB: a provisional setting, not a validated cut-off. Published cut-offs depend on the recordings and the noise and have to be set on local listeners with normal hearing.</p>
            <div className="din-trace" role="img" aria-label={`Level of the digits in each set, in dB signal-to-noise: ${result.trials.map((t, i) => `set ${i + 1}, ${t.snr} dB, ${t.correct ? 'all right' : 'not all right'}`).join('; ')}.`}>
              {result.trials.map((t, i) => <span key={i} title={`${t.snr} dB`} className={t.correct ? 'ok' : 'miss'} style={{ height: `${(t.snr - DIN.minSnr) * 3 + 6}px` }} />)}
            </div>
            <p className="muted">Each bar is one set: its height is the level of the digits, green when all three were right.</p>
          </details>
          {result.outcome === 'refer' && (
            <div className="card">
              <h3>After a hearing aid is fitted</h3>
              <p>Many people stop wearing their aid within months, so the app asks one question a week. The programme sees who is still wearing it.</p>
              <p><strong>How much did you wear your hearing aid yesterday?</strong></p>
              <div className="row">{(Object.keys(WEAR_LABEL) as Wear[]).map((w) => <button key={w} className="small" onClick={() => recordWear(w)}>{WEAR_LABEL[w]}</button>)}</div>
              {wear.length > 0 && <div className="ticks" role="list" aria-label="Hearing aid answers">{wear.map((w, i) => <span key={i} role="listitem" className={`tick${w.wear === 'none' ? ' off' : ''}`}>{w.date.slice(5)} · {WEAR_LABEL[w.wear].toLowerCase()}</span>)}</div>}
              <p className="muted">In a pilot, "not at all" two weeks running would go to the audiology clinic. That message is not built in this prototype.</p>
            </div>
          )}
          <div className="stack">
            <Link className="btn primary" to="/check">Go on to the memory check</Link>
            <button onClick={() => { setResult(null); setStage('intro') }}>Do the hearing check again</button>
          </div>
        </>
      )}
    </>
  )
}
