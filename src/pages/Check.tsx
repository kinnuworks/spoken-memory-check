import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { ANIMALS, ARABIC_REVIEWED, SOUND_CHECK_WORDS, WORD_LISTS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { clearChecks, loadChecks, saveCheck, type StoredCheck } from '../engine/store'
import { activeRecognisers, browserSpeechAvailable, type ListenControl } from '../speech/recogniser'
import { pause, speak, speakList } from '../speech/speak'
import TrajectoryChart from './TrajectoryChart'

type Stage = 'intro' | 'sound' | 'sound-failed' | 'hear-list' | 'recall-1' | 'animals' | 'count' | 'recall-2' | 'done' | 'blocked'

const T: Record<Lang, Record<string, string>> = {
  en: {
    list: 'I will read ten words. Listen, then say back as many as you can, in any order.',
    recallNow: 'Now say the words you remember.',
    animals: 'Now name as many animals as you can. You have one minute.',
    count: 'Now count backwards from twenty to one.',
    recallLater: 'Earlier I read you ten words. Say as many as you can remember.',
    thanks: 'Thank you. That is the end of the check.',
  },
  ar: {
    list: 'سأقرأ عشر كلمات. استمع ثم قل ما تتذكره منها بأي ترتيب.',
    recallNow: 'الآن قل الكلمات التي تتذكرها.',
    animals: 'الآن اذكر أكبر عدد من الحيوانات. لديك دقيقة واحدة.',
    count: 'الآن عد تنازلياً من عشرين إلى واحد.',
    recallLater: 'قرأت لك قبل قليل عشر كلمات. قل ما تتذكره منها.',
    thanks: 'شكراً لك. انتهى الفحص.',
  },
}

const HEAD: Record<Stage, string> = {
  intro: 'The full check', sound: 'Say these three words', 'sound-failed': "We can't hear you clearly here", 'hear-list': 'Listen to the ten words',
  'recall-1': 'Say the words you remember', animals: 'Name animals for one minute', count: 'Count backwards from twenty', 'recall-2': 'Say the ten words again', done: 'Check received', blocked: "The microphone isn't available here",
}

export default function Check() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>(browserSpeechAvailable() ? 'intro' : 'blocked')
  const [live, setLive] = useState<RangeScore | null>(null)
  const [offDay, setOffDay] = useState(false)
  const [history, setHistory] = useState<StoredCheck[]>(loadChecks())
  const [last, setLast] = useState<StoredCheck | null>(null)
  const control = useRef<ListenControl>({})
  const recs = activeRecognisers()
  const listIndex = history.length % WORD_LISTS[lang].length
  const words = WORD_LISTS[lang][listIndex]

  async function listenAll(ms: number, rows: string[][], show = true): Promise<RangeScore> {
    const heard: Record<string, string> = {}
    control.current = {}
    setLive(null)
    await Promise.all(recs.map(async (r) => {
      heard[r.name] = ''
      heard[r.name] = await r.listen(lang, ms, (t) => { heard[r.name] = t; if (show) setLive(scoreTask({ ...heard }, rows, lang)) }, control.current)
    }))
    const final = scoreTask(heard, rows, lang)
    if (show) setLive(final)
    return final
  }

  async function run() {
    try {
      setStage('sound')
      const sound = await listenAll(7000, SOUND_CHECK_WORDS[lang].map((w) => [w]))
      if (sound.high < 2) return setStage('sound-failed')
      const rows = words.map((w) => [w])

      setStage('hear-list'); setLive(null)
      await speak(T[lang].list, lang)
      await pause(600)
      await speakList(words, lang)
      await speak(T[lang].recallNow, lang)
      setStage('recall-1')
      // Recalled words are not shown while the person speaks: seeing them would be a cue for the later recall.
      const immediate = await listenAll(45000, rows, false)

      await speak(T[lang].animals, lang)
      setStage('animals')
      const animals = await listenAll(60000, ANIMALS[lang])

      await speak(T[lang].count, lang)
      setStage('count'); setLive(null)
      await listenAll(30000, [], false)

      await speak(T[lang].recallLater, lang)
      setStage('recall-2')
      const delayed = await listenAll(45000, rows, false)
      await speak(T[lang].thanks, lang)

      const scored = immediate.scored && animals.scored && delayed.scored
      const check: StoredCheck = {
        date: new Date().toISOString().slice(0, 10),
        low: scored ? immediate.low + delayed.low + animals.low : null,
        high: scored ? immediate.high + delayed.high + animals.high : null,
        offDay, lang, list: listIndex,
        parts: { immediate: [immediate.low, immediate.high], delayed: [delayed.low, delayed.high], animals: [animals.low, animals.high] },
        recognisers: recs.map((r) => r.name),
      }
      saveCheck(check)
      setLast(check)
      setHistory(loadChecks())
      setStage('done')
    } catch {
      setStage('blocked')
    }
  }

  const traj = evaluate(history)
  const range = (p: [number, number]) => (p[0] === p[1] ? String(p[1]) : `${p[0]} to ${p[1]}`)
  const listening = stage === 'recall-1' || stage === 'animals' || stage === 'count' || stage === 'recall-2'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <h1>{HEAD[stage]}</h1>

      {stage === 'intro' && (
        <>
          <p>About four minutes, all by voice: a sound check, ten words to say back, a minute of naming animals, counting backwards, then the ten words again. Find a quiet place and do it on your own.</p>
          <div className="row">
            <button className="small" onClick={() => setLang('en')} aria-pressed={lang === 'en'}>{lang === 'en' ? '● ' : ''}English</button>
            <button className="small" onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>{lang === 'ar' ? '● ' : ''}العربية</button>
          </div>
          {lang === 'ar' && !ARABIC_REVIEWED && <p className="note">The Arabic wording and word lists are a draft, not yet reviewed by a native Gulf Arabic speaker, and the voice is the device's synthetic one.</p>}
          <p><label><input type="checkbox" checked={offDay} onChange={(e) => setOffDay(e.target.checked)} /> I slept badly or feel unwell today</label></p>
          <p className="note">In this build your speech is recognised by your browser's own speech service, and prompts use your device's voice. Your scores stay on this device. This is a prototype and does not diagnose.</p>
          <div className="stack"><button className="primary" onClick={run}>Start the check</button></div>
          {history.length > 0 && (
            <>
              <h2>Your checks on this device</h2>
              <div className="card"><TrajectoryChart checks={history} traj={traj} /></div>
              <p>{history.length < 3 ? `${history.filter((c) => c.low !== null).length} of 3 baseline checks done.` : 'Baseline set from your first three scored checks.'}</p>
              <button className="small" onClick={() => { clearChecks(); setHistory([]) }}>Delete my checks from this device</button>
            </>
          )}
        </>
      )}

      {stage === 'sound' && <><p className="big" dir={dir}>{SOUND_CHECK_WORDS[lang].join(lang === 'ar' ? '، ' : ', ')}</p><p className="muted">Listening…</p></>}
      {stage === 'hear-list' && <p className="muted">Reading the words aloud. Nothing is shown on screen.</p>}
      {stage === 'animals' && <div className="chips" dir={dir}>{live?.items.map((it) => <span key={it.row} className="chip">{it.label}</span>)}</div>}
      {listening && (
        <>
          <p className="muted">Listening…</p>
          <div className="stack"><button onClick={() => control.current.stop?.()}>I've finished</button></div>
        </>
      )}

      {stage === 'sound-failed' && (
        <>
          <p>Nothing was scored. Try again somewhere quieter.</p>
          <div className="stack"><button className="primary" onClick={run}>Try again</button><Link className="btn" to="/year">See a year of checks (no microphone)</Link></div>
        </>
      )}

      {stage === 'done' && last && (
        <>
          <p>Thank you. {last.low === null ? 'This check could not be scored, so it does not count. In real use it is repeated another day with a different list.' : `That was check ${history.length}.`}</p>
          <div className="card">
            <p><strong>What we heard</strong> <span className="tag">shown to you as a tester</span></p>
            <table><tbody>
              <tr><td>Words said back</td><td>{range(last.parts.immediate)} of 10</td></tr>
              <tr><td>Animals in a minute</td><td>{range(last.parts.animals)}</td></tr>
              <tr><td>Words recalled later</td><td>{range(last.parts.delayed)} of 10</td></tr>
            </tbody></table>
            <p className="muted">The words were list {last.list + 1}: <span dir={dir}>{WORD_LISTS[last.lang][last.list].join(lang === 'ar' ? '، ' : ', ')}</span>. A patient sees only "Check received" and their trend.</p>
          </div>
          <div className="card"><TrajectoryChart checks={history} traj={traj} /></div>
          <p>{history.filter((c) => c.low !== null).length < 3 ? 'Three checks within two weeks set your baseline. One score on its own is not compared with anything.' : 'Your baseline is set. Later checks are compared with it.'}</p>
          <div className="stack"><button onClick={() => setStage('intro')}>Back</button><Link className="btn" to="/year">See a year of checks</Link></div>
        </>
      )}

      {stage === 'blocked' && (
        <>
          <p>It may be blocked, or this browser has no speech recognition. Open this page in Chrome or Safari, or carry on without a microphone.</p>
          <div className="stack"><Link className="btn primary" to="/year">See a year of checks (no microphone)</Link></div>
        </>
      )}
    </>
  )
}
