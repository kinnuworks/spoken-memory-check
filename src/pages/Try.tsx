import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ANIMALS, ARABIC_REVIEWED, SOUND_CHECK_WORDS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { browserSpeechAvailable } from '../speech/recogniser'
import { DOWNLOAD_FROM, DOWNLOAD_MB, loadSecond, secondCrashedBefore, secondLoading, secondSupported } from '../speech/second'
import { hasMicrophone } from '../speech/capture'
import { deviceOnlyPossible, listenTask } from '../speech/session'
import SurveyChart from './SurveyChart'

type Stage = 'intro' | 'sound' | 'sound-failed' | 'ready' | 'animals' | 'result' | 'blocked' | 'typed'
const ANIMAL_SECONDS = 20

// ?state=empty|loading|error|result opens one screen of the loop directly, so each can be checked
// and recorded. The result is a labelled sample scored from typed animals, not a recording.
const SAMPLE = 'camel, horse, falcon, goat, cat, dog, lion, fish, eagle'
function forcedState(): Stage | null {
  const q = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
  const s = q.get('state')
  return s === 'empty' ? 'intro' : s === 'loading' ? 'sound' : s === 'error' ? 'blocked' : s === 'result' ? 'result' : null
}

export default function Try() {
  const [lang, setLang] = useState<Lang>('en')
  const forced = forcedState()
  const [stage, setStage] = useState<Stage>(forced ?? (deviceOnlyPossible('en') || browserSpeechAvailable() ? 'intro' : 'blocked'))
  const [live, setLive] = useState<RangeScore | null>(forced === 'result' ? scoreTask({ Typed: SAMPLE }, ANIMALS.en, 'en') : null)
  const sample = forced === 'result'
  const [left, setLeft] = useState(ANIMAL_SECONDS)
  const timer = useRef<number | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const [viaTyping, setViaTyping] = useState(forced === 'result')
  const [second, setSecond] = useState<'off' | 'loading' | 'ready' | 'checking'>('off')
  const [percent, setPercent] = useState(0)
  const [listeners, setListeners] = useState(1)
  // Scoring stays on this device unless the person turns on the browser's recogniser.
  const [browserOn, setBrowserOn] = useState(false)
  const [scoring, setScoring] = useState(false)
  // Each run gets a number; leaving a run (for typing) makes any late answer from it be ignored.
  const run = useRef(0)
  const leave = () => { run.current++; window.clearInterval(timer.current); setScoring(false); setStage('typed') }

  function startSecond(l: Lang) {
    if (!secondSupported(l) || secondLoading(l)) return
    setSecond('loading')
    loadSecond(l, setPercent).then(() => setSecond('ready')).catch(() => setSecond('off'))
  }

  async function listenAll(ms: number, rows: string[][], waitForSecond: boolean): Promise<RangeScore> {
    if (!browserOn) {
      setScoring(false)
      const heard = await listenTask(lang, ms, () => {}, undefined, true, false, undefined, { browser: false, onRecorded: () => setScoring(true) })
      const all = await heard.both
      setScoring(false)
      setListeners(Math.max(1, Object.keys(all).length))
      const res = scoreTask(all, rows, lang)
      setLive(res)
      return res
    }
    const heard = await listenTask(lang, ms, (t) => setLive(scoreTask({ Browser: t }, rows, lang)), undefined, waitForSecond)
    const first = scoreTask(heard.first, rows, lang)
    setLive(first)
    if (!waitForSecond) return first
    setSecond((s) => (s === 'off' ? s : 'checking'))
    void heard.both.then((all) => {
      setListeners(Object.keys(all).length)
      setLive(scoreTask(all, rows, lang))
      setSecond((s) => (s === 'off' ? s : 'ready'))
    })
    return first
  }

  async function soundCheck() {
    const id = ++run.current
    setLive(null)
    if (!browserOn) {
      // The on-device listener has to be ready before anything is recorded.
      if (!deviceOnlyPossible(lang)) return setStage('blocked')
      // Check the microphone before the one-time model download, so nobody waits for a download they cannot use.
      if (!(await hasMicrophone())) { if (run.current === id) setStage('blocked'); return }
      setSecond('loading')
      try {
        await loadSecond(lang, setPercent)
        setSecond('ready')
      } catch {
        setSecond('off')
        if (run.current === id) setStage('blocked')
        return
      }
      if (run.current !== id) return
    } else if (lang === 'en') startSecond('en') // English fetches the second listener by itself; Arabic is a large download, so the person chooses.
    setStage('sound')
    try {
      const res = await listenAll(7000, SOUND_CHECK_WORDS[lang].map((w) => [w]), false)
      if (run.current === id) setStage(res.high >= 2 ? 'ready' : 'sound-failed')
    } catch {
      if (run.current === id) setStage('blocked')
    }
  }

  function scoreTyped() {
    setViaTyping(true)
    setLive(scoreTask({ Typed: typed }, ANIMALS[lang], lang))
    setStage('result')
  }

  async function animals() {
    const id = ++run.current
    setViaTyping(false)
    setLive(null)
    setLeft(ANIMAL_SECONDS)
    setStage('animals')
    timer.current = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    try {
      await listenAll(ANIMAL_SECONDS * 1000, ANIMALS[lang], true)
      if (run.current === id) setStage('result')
    } catch {
      if (run.current === id) setStage('blocked')
    } finally {
      window.clearInterval(timer.current)
    }
  }

  const chips = live?.items.map((it) => (
    <span key={it.row} className={`chip pop ${listeners > 1 ? it.heard : ''}`}>{it.label}</span>
  ))
  const one = listeners === 1

  return (
    <>
      <h1>Try it with your voice</h1>
      <div className="segmented" role="group" aria-label="Language">
        <button className="seg" disabled={!['intro', 'blocked', 'typed'].includes(stage)} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English</button>
        <button className="seg" lang="ar" disabled={!['intro', 'blocked', 'typed'].includes(stage)} onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>العربية</button>
      </div>
      {lang === 'ar' && !ARABIC_REVIEWED && <p className="note">The Arabic word lists are a draft and have not yet been reviewed by a native Gulf Arabic speaker.</p>}
      <div className="try-panel">

      {stage === 'intro' && (
        <>
          <p>First a sound check, then 20 seconds of naming animals. This is a short taste of the full four-minute check. Nothing is stored.</p>
          <p className="note">{deviceOnlyPossible(lang) ? `An open speech model on this device scores what you say, and your voice is sent nowhere. It needs a one-time download of about ${DOWNLOAD_MB[lang]} MB from ${DOWNLOAD_FROM[lang]}, so use Wi-Fi on a phone.` : secondCrashedBefore(lang) ? "Last time, this device closed the page while running the speech model, which usually means it ran out of memory. Turn on the browser's speech service below, or type the animals instead." : "This device can't run the on-device speech model (older and low-memory devices can't). Turn on the browser's speech service below, or type the animals instead."}</p>
          <label className="choice"><input className="switch" type="checkbox" checked={browserOn} onChange={(e) => setBrowserOn(e.target.checked)} /><span>Also use my browser's speech service. It shows words as you speak, but may send your voice to the browser's maker, outside the UAE.</span></label>
          {browserOn && lang === 'ar' && secondSupported('ar') && second === 'off' && <p><button className="small" onClick={() => startSecond('ar')}>Add the on-device listener for Arabic ({DOWNLOAD_MB.ar} MB)</button></p>}
          <div className="stack"><button className="primary" disabled={!browserOn && !deviceOnlyPossible(lang)} onClick={soundCheck}>Start the sound check</button><button onClick={() => setStage('typed')}>Type the animals instead</button></div>
        </>
      )}

      {second === 'loading' && <div><p className="muted">Getting the speech model ready on this device: {percent}%</p><div className="meter"><i style={{ width: `${percent}%` }} /></div></div>}

      {stage === 'sound' && (
        <>
          <h2>Say these three words</h2>
          <p className="prompt-words" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{SOUND_CHECK_WORDS[lang].join(lang === 'ar' ? '، ' : ', ')}</p>
          <div className="chips" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          <p className="listening"><i />{scoring ? 'Scoring on this device…' : 'Listening…'}</p>
          {!scoring && <p className="muted">If your browser asks to use the microphone, choose Allow. Nothing happening?</p>}
          {!scoring && <div className="stack"><button onClick={leave}>Stop and type the animals instead</button></div>}
        </>
      )}

      {stage === 'sound-failed' && (
        <>
          <h2>We couldn't hear the three words</h2>
          <p>Nothing was scored. Check that a microphone is connected and allowed for this page, then try again somewhere quiet. Or see the rest without a microphone.</p>
          <div className="stack">
            <button className="primary" onClick={soundCheck}>Try the sound check again</button>
            <button onClick={() => setStage('typed')}>Type the animals to see the scoring work</button>
            <Link className="btn" to="/year">See a year of checks (no microphone)</Link>
          </div>
        </>
      )}

      {stage === 'ready' && (
        <>
          <h2>We can hear you</h2>
          <div className="chips" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          <p>Next: name as many animals as you can in {ANIMAL_SECONDS} seconds. Any animals, in any order.</p>
          <div className="stack"><button className="primary" onClick={animals}>Start naming animals</button></div>
        </>
      )}

      {stage === 'animals' && (
        <>
          <h2>Name animals</h2>
          <p className="big">{left}s</p>
          <p className="listening"><i />{scoring ? 'Scoring on this device…' : 'Listening'}</p>
          {!scoring && <div className="stack"><button onClick={leave}>Stop and type the animals instead</button></div>}
          <div className="chips" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
        </>
      )}

      {stage === 'result' && live && (
        <>
          <h2>What we heard</h2>
          {sample && <p className="tag syn">Sample result from typed animals</p>}
          <p className="big">{live.low === live.high ? live.high : `${live.low} to ${live.high}`} animals</p>
          <div className="chips" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          {viaTyping
            ? <p className="note">You typed these, so no speech was recognised. The matching and counting are the same ones the spoken check uses: each animal counts once, whatever form you give it.</p>
            : !browserOn
            ? <p className="note">Scored on this device by the open speech model, and your voice was sent nowhere. To add a second listener and see words as you speak, turn on the browser's speech service before you start.</p>
            : second === 'checking'
            ? <p className="note">Your browser's recogniser heard the animals above. The second listener, on this device, is now going through the same recording…</p>
            : one
            ? <p className="note">One recogniser listened this time, so the score has no range. That happens when the second listener is not downloaded yet, on phones that cannot share the microphone, and on older devices. With two, each animal is marked as heard by both or by one.</p>
            : <p className="note">Green was heard by both recognisers, amber by one. The score is a range, and that range is carried into the comparison with your baseline.</p>}
          {live.unmatched.length > 0 && <p className="muted">Heard but not on the accepted list, so not counted: <span lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{live.unmatched.slice(0, 12).join(lang === 'ar' ? '، ' : ', ')}</span>. If one of these is an animal, the list needs it; such words are logged for review.</p>}
          <p>This is 20 seconds, not the real minute, so it is not compared with anyone. One number on one day says little.</p>
          <SurveyChart />
          <div className="stack">
            <Link className="btn primary" to="/year">See a year of checks</Link>
            <button onClick={() => { setLive(null); setStage('intro') }}>Try again</button>
          </div>
        </>
      )}

      {stage === 'typed' && (
        <>
          <h2>Type some animals</h2>
          <p>This is for testing without a microphone. Patients never type. Separate the animals with spaces or commas.</p>
          <p><label>Animals<textarea lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={lang === 'ar' ? 'جمل، حصان، صقر' : 'camel, horse, falcon, polar bear, horses'} /></label></p>
          <div className="stack"><button className="primary" disabled={!typed.trim()} onClick={scoreTyped}>Score what I typed</button></div>
        </>
      )}

      {stage === 'blocked' && (
        <>
          <h2>The microphone isn't available here</h2>
          <p>It may be blocked, or this browser has no speech recognition. Open this page in Chrome or Safari, or carry on without a microphone.</p>
          <div className="stack">
            <button onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy the link</button>
            <button onClick={() => setStage('typed')}>Type the animals to see the scoring work</button>
            <Link className="btn primary" to="/year">See a year of checks (no microphone)</Link>
          </div>
                </>
      )}
      </div>
    </>
  )
}
