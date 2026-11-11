import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ANIMALS, ARABIC_REVIEWED, SOUND_CHECK_WORDS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { browserSpeechAvailable } from '../speech/recogniser'
import { DOWNLOAD_MB, loadSecond, secondLoading, secondSupported } from '../speech/second'
import { listenTask } from '../speech/session'
import SurveyChart from './SurveyChart'

type Stage = 'intro' | 'sound' | 'sound-failed' | 'ready' | 'animals' | 'result' | 'blocked' | 'typed'
const ANIMAL_SECONDS = 20

export default function Try() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>(browserSpeechAvailable() ? 'intro' : 'blocked')
  const [live, setLive] = useState<RangeScore | null>(null)
  const [left, setLeft] = useState(ANIMAL_SECONDS)
  const timer = useRef<number | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const [viaTyping, setViaTyping] = useState(false)
  const [second, setSecond] = useState<'off' | 'loading' | 'ready' | 'checking'>('off')
  const [percent, setPercent] = useState(0)
  const [listeners, setListeners] = useState(1)

  function startSecond(l: Lang) {
    if (!secondSupported() || secondLoading(l)) return
    setSecond('loading')
    loadSecond(l, setPercent).then(() => setSecond('ready')).catch(() => setSecond('off'))
  }

  async function listenAll(ms: number, rows: string[][], waitForSecond: boolean): Promise<RangeScore> {
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
    setLive(null)
    setStage('sound')
    // English fetches the second listener by itself; Arabic is a large download, so the person chooses.
    if (lang === 'en') startSecond('en')
    try {
      const res = await listenAll(7000, SOUND_CHECK_WORDS[lang].map((w) => [w]), false)
      setStage(res.high >= 2 ? 'ready' : 'sound-failed')
    } catch {
      setStage('blocked')
    }
  }

  function scoreTyped() {
    setViaTyping(true)
    setLive(scoreTask({ Typed: typed }, ANIMALS[lang], lang))
    setStage('result')
  }

  async function animals() {
    setViaTyping(false)
    setLive(null)
    setLeft(ANIMAL_SECONDS)
    setStage('animals')
    timer.current = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    try {
      await listenAll(ANIMAL_SECONDS * 1000, ANIMALS[lang], true)
      setStage('result')
    } catch {
      setStage('blocked')
    } finally {
      window.clearInterval(timer.current)
    }
  }

  const chips = live?.items.map((it) => (
    <span key={it.row} className={`chip ${listeners > 1 ? it.heard : ''}`}>{it.label}</span>
  ))
  const one = listeners === 1

  return (
    <>
      <h1>Try it with your voice</h1>
      <div className="row">
        <button className="small" disabled={!['intro', 'blocked', 'typed'].includes(stage)} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>{lang === 'en' ? '● ' : ''}English</button>
        <button className="small" disabled={!['intro', 'blocked', 'typed'].includes(stage)} onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>{lang === 'ar' ? '● ' : ''}العربية</button>
      </div>
      {lang === 'ar' && !ARABIC_REVIEWED && <p className="note">The Arabic word lists are a draft and have not yet been reviewed by a native Gulf Arabic speaker.</p>}

      {stage === 'intro' && (
        <>
          <p>First a sound check, then 20 seconds of naming animals. This is a short taste of the full four-minute check. Nothing is stored.</p>
          <p className="note">Two listeners score what you say. The first is your browser's own speech service, which may send audio to the browser's maker. The second is an open speech model that runs on this device and sends your recording nowhere{secondSupported() ? `; it needs a one-time download of about ${DOWNLOAD_MB[lang]} MB from huggingface.co` : '; it is not available on this device, so one listener will score'}. Nothing is stored.</p>
          {lang === 'ar' && secondSupported() && second === 'off' && <p><button className="small" onClick={() => startSecond('ar')}>Add the second listener for Arabic ({DOWNLOAD_MB.ar} MB)</button></p>}
          <div className="stack"><button className="primary" onClick={soundCheck}>Start the sound check</button></div>
        </>
      )}

      {second === 'loading' && <p className="muted">Second listener: {percent}%</p>}

      {stage === 'sound' && (
        <>
          <h2>Say these three words</h2>
          <p className="big" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{SOUND_CHECK_WORDS[lang].join(lang === 'ar' ? '، ' : ', ')}</p>
          <div className="chips" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          <p className="muted">Listening…</p>
        </>
      )}

      {stage === 'sound-failed' && (
        <>
          <h2>We can't hear you clearly here</h2>
          <p>Nothing was scored. Try again somewhere quieter, or see the rest without a microphone.</p>
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
          <div className="chips" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          <p>Next: name as many animals as you can in {ANIMAL_SECONDS} seconds. Any animals, in any order.</p>
          <div className="stack"><button className="primary" onClick={animals}>Start naming animals</button></div>
        </>
      )}

      {stage === 'animals' && (
        <>
          <h2>Name animals</h2>
          <p className="big">{left}s</p>
          <div className="chips" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
        </>
      )}

      {stage === 'result' && live && (
        <>
          <h2>What we heard</h2>
          <p className="big">{live.low === live.high ? live.high : `${live.low} to ${live.high}`} animals</p>
          <div className="chips" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{chips}</div>
          {viaTyping
            ? <p className="note">You typed these, so no speech was recognised. The matching and counting are the same ones the spoken check uses: each animal counts once, whatever form you give it.</p>
            : second === 'checking'
            ? <p className="note">Your browser's recogniser heard the animals above. The second listener, on this device, is now going through the same recording…</p>
            : one
            ? <p className="note">One recogniser listened this time, so the score has no range. That happens when the second listener is not downloaded yet, on phones that cannot share the microphone, and on older devices. With two, each animal is marked as heard by both or by one.</p>
            : <p className="note">Green was heard by both recognisers, amber by one. The score is a range, and that range is carried into the comparison with your baseline.</p>}
          {live.unmatched.length > 0 && <p className="muted" dir={lang === 'ar' ? 'rtl' : 'ltr'}>Heard but not on the accepted list, so not counted: {live.unmatched.slice(0, 12).join(lang === 'ar' ? '، ' : ', ')}. If one of these is an animal, the list needs it; such words are logged for review.</p>}
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
          <p><label>Animals<textarea dir={lang === 'ar' ? 'rtl' : 'ltr'} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={lang === 'ar' ? 'جمل، حصان، صقر' : 'camel, horse, falcon, polar bear, horses'} /></label></p>
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
    </>
  )
}
