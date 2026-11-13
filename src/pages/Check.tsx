import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { ANIMALS, ARABIC_REVIEWED, SOUND_CHECK_WORDS, WORD_LISTS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { readYesNo } from '../engine/yesno'
import { clearChecks, loadChecks, saveCheck, type StoredCheck } from '../engine/store'
import { browserSpeechAvailable, type ListenControl } from '../speech/recogniser'
import { DOWNLOAD_MB, loadSecond, secondLoading, secondSupported } from '../speech/second'
import { listenTask, type Heard } from '../speech/session'
import { cloudAvailable } from '../speech/cloud'
import { loadConsent, saveConsent } from '../engine/consent'
import { APP_VERSION } from '../engine/audit'
import { pause, speak, speakList } from '../speech/speak'
import TrajectoryChart from './TrajectoryChart'

type Stage = 'intro' | 'sound' | 'sound-failed' | 'hear-list' | 'recall-1' | 'animals' | 'count' | 'recall-2' | 'function' | 'scoring' | 'done' | 'blocked'

const T: Record<Lang, Record<string, string>> = {
  en: {
    list: 'I will read ten words. Listen, then say back as many as you can, in any order.',
    recallNow: 'Now say the words you remember.',
    animals: 'Now name as many animals as you can. You have one minute.',
    count: 'Now count backwards from twenty to one.',
    recallLater: 'Earlier I read you ten words. Say as many as you can remember.',
    fn: 'Last question. In the past month, have money, medicines or appointments become harder to manage? Please say yes or no.',
    thanks: 'Thank you. That is the end of the check.',
  },
  ar: {
    list: 'سأقرأ عشر كلمات. استمع ثم قل ما تتذكره منها بأي ترتيب.',
    recallNow: 'الآن قل الكلمات التي تتذكرها.',
    animals: 'الآن اذكر أكبر عدد من الحيوانات. لديك دقيقة واحدة.',
    count: 'الآن عد تنازلياً من عشرين إلى واحد.',
    recallLater: 'قرأت لك قبل قليل عشر كلمات. قل ما تتذكره منها.',
    fn: 'سؤال أخير. خلال الشهر الماضي، هل أصبح التعامل مع المال أو الأدوية أو المواعيد أصعب؟ قل نعم أو لا.',
    thanks: 'شكراً لك. انتهى الفحص.',
  },
}

const HEAD: Record<Stage, string> = {
  intro: 'The full check', sound: 'Say these three words', 'sound-failed': "We can't hear you clearly here", 'hear-list': 'Listen to the ten words',
  'recall-1': 'Say the words you remember', animals: 'Name animals for one minute', count: 'Count backwards from twenty', 'recall-2': 'Say the ten words again', function: 'One last question', scoring: 'Scoring your check', done: 'Check received', blocked: "The microphone isn't available here",
}

export default function Check() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>(browserSpeechAvailable() ? 'intro' : 'blocked')
  const [live, setLive] = useState<RangeScore | null>(null)
  const [offDay, setOffDay] = useState(false)
  const [history, setHistory] = useState<StoredCheck[]>(loadChecks())
  const [last, setLast] = useState<StoredCheck | null>(null)
  const control = useRef<ListenControl>({})
  const [percent, setPercent] = useState<number | null>(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudOn, setCloudOn] = useState(loadConsent().cloudListener)
  const [agreed, setAgreed] = useState(loadConsent().takeChecks)
  useEffect(() => { void cloudAvailable().then(setCloudReady) }, [])
  const useCloud = cloudReady && cloudOn
  const listIndex = history.length % WORD_LISTS[lang].length
  const words = WORD_LISTS[lang][listIndex]

  function startSecond() {
    if (!secondSupported() || secondLoading(lang)) return
    setPercent(0)
    loadSecond(lang, setPercent).then(() => setPercent(null)).catch(() => setPercent(null))
  }

  async function listen(ms: number, rows: string[][], show = true, useSecond = true): Promise<Heard> {
    control.current = {}
    setLive(null)
    const heard = await listenTask(lang, ms, (t) => { if (show) setLive(scoreTask({ Browser: t }, rows, lang)) }, control.current, useSecond, useCloud)
    if (show) setLive(scoreTask(heard.first, rows, lang))
    return heard
  }

  async function run() {
    try {
      setStage('sound')
      if (lang === 'en') startSecond()
      const soundRows = SOUND_CHECK_WORDS[lang].map((w) => [w])
      const sound = scoreTask((await listen(7000, soundRows, true, false)).first, soundRows, lang)
      if (sound.high < 2) {
        // A second failed sound check in a row is saved as a held check: not scored, never read as low.
        if (stage === 'sound-failed') {
          saveCheck({ date: new Date().toISOString().slice(0, 10), low: null, high: null, hearingLimited: true, lang, list: listIndex, parts: { immediate: [0, 0], delayed: [0, 0], animals: [0, 0] }, recognisers: [] })
          setHistory(loadChecks())
        }
        return setStage('sound-failed')
      }
      const rows = words.map((w) => [w])

      setStage('hear-list'); setLive(null)
      await speak(T[lang].list, lang)
      await pause(600)
      await speakList(words, lang)
      await speak(T[lang].recallNow, lang)
      setStage('recall-1')
      // Recalled words are not shown while the person speaks: seeing them would be a cue for the later recall.
      const immediateHeard = await listen(45000, rows, false)

      await speak(T[lang].animals, lang)
      setStage('animals')
      const animalsHeard = await listen(60000, ANIMALS[lang])

      await speak(T[lang].count, lang)
      setStage('count'); setLive(null)
      await listen(30000, [], false, false)

      await speak(T[lang].recallLater, lang)
      setStage('recall-2')
      const delayedHeard = await listen(45000, rows, false)
      await speak(T[lang].fn, lang)
      setStage('function')
      const fnHeard = await listen(8000, [], false, false)
      const functionChange = readYesNo(fnHeard.first.Browser ?? '', lang)
      await speak(T[lang].thanks, lang)

      // The second listener works through each recording after the task; wait for all three.
      setStage('scoring')
      const [imm, ani, del] = await Promise.all([immediateHeard.both, animalsHeard.both, delayedHeard.both])
      const immediate = scoreTask(imm, rows, lang), animals = scoreTask(ani, ANIMALS[lang], lang), delayed = scoreTask(del, rows, lang)
      const scored = immediate.scored && animals.scored && delayed.scored
      const check: StoredCheck = {
        date: new Date().toISOString().slice(0, 10),
        low: scored ? immediate.low + delayed.low + animals.low : null,
        high: scored ? immediate.high + delayed.high + animals.high : null,
        offDay, lang, list: listIndex, ...(functionChange === true ? { functionChange } : {}),
        parts: { immediate: [immediate.low, immediate.high], delayed: [delayed.low, delayed.high], animals: [animals.low, animals.high] },
        recognisers: Object.keys(ani),
        appVersion: APP_VERSION, listVersion: `${lang}-${listIndex + 1}`, heard: { immediate: imm, animals: ani, delayed: del },
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
  const listening = stage === 'recall-1' || stage === 'animals' || stage === 'count' || stage === 'recall-2' || stage === 'function'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <h1>{HEAD[stage]}</h1>

      {stage === 'intro' && (
        <>
          <p>About four minutes, all by voice: a sound check, ten words to say back, a minute of naming animals, counting backwards, then the ten words again. Find a quiet place and do it on your own.</p>
          <div className="segmented" role="group" aria-label="Language">
            <button className="seg" onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English</button>
            <button className="seg" lang="ar" onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>العربية</button>
          </div>
          {lang === 'ar' && !ARABIC_REVIEWED && <p className="note">The Arabic wording and word lists are a draft, not yet reviewed by a native Gulf Arabic speaker, and the voice is the device's synthetic one.</p>}
          <label className="choice"><input className="switch" type="checkbox" checked={offDay} onChange={(e) => setOffDay(e.target.checked)} /><span>I slept badly or feel unwell today</span></label>
          {cloudReady && <label className="choice"><input className="switch" type="checkbox" checked={cloudOn} onChange={(e) => { setCloudOn(e.target.checked); saveConsent({ ...loadConsent(), cloudListener: e.target.checked }) }} /><span>Also let a speech service hosted in the UAE hear this check. It has a Gulf Arabic model; how well it hears Gulf speakers in this check has not been measured yet. Your recording leaves this device for this, is not kept, and you can turn this off at any time.</span></label>}
          <p className="note">Two listeners score what you say: your browser's own speech service, which may send audio to the browser's maker, and an open speech model that runs on this device and sends your recording nowhere{secondSupported() ? ` (one-time download of about ${DOWNLOAD_MB[lang]} MB from huggingface.co)` : ' (not available on this device, so one listener will score)'}. Prompts use your device's voice. Your scores stay on this device. This is a prototype and does not diagnose.</p>
          {lang === 'ar' && secondSupported() && percent === null && !secondLoading('ar') && <p><button className="small" onClick={startSecond}>Add the second listener for Arabic ({DOWNLOAD_MB.ar} MB)</button></p>}
          <label className="choice"><input className="switch" type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); saveConsent({ ...loadConsent(), takeChecks: e.target.checked }) }} /><span>I agree to take memory checks at home and keep my scores on this device. I can turn this off and delete my checks at any time.</span></label>
          <div className="stack"><button className="primary" disabled={!agreed} onClick={run}>Start the check</button>{!agreed && <p className="muted">Turn on the agreement above to start.</p>}</div>
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

      {percent !== null && <p className="muted">Second listener: {percent}%</p>}
      {stage === 'function' && <p lang={lang} dir={dir}>{T[lang].fn}</p>}
      {stage === 'scoring' && <p className="listening"><i />{useCloud ? 'The on-device and UAE listeners are going through your recordings.' : 'The second listener is going through your recordings on this device.'} This can take up to a minute.</p>}
      {stage === 'sound' && <><p className="prompt-words" lang={lang} dir={dir}>{SOUND_CHECK_WORDS[lang].join(lang === 'ar' ? '، ' : ', ')}</p><p className="listening"><i />Listening…</p></>}
      {stage === 'hear-list' && <p className="muted">Reading the words aloud. Nothing is shown on screen.</p>}
      {stage === 'animals' && <div className="chips" lang={lang} dir={dir}>{live?.items.map((it) => <span key={it.row} className="chip">{it.label}</span>)}</div>}
      {listening && (
        <>
          <p className="listening"><i />Listening…</p>
          <div className="stack"><button onClick={() => control.current.stop?.()}>I've finished</button></div>
        </>
      )}

      {stage === 'sound-failed' && (
        <>
          <p>Nothing was scored. Try again somewhere quieter. If it happens again, the check is held rather than scored, and it may be worth asking your clinic about a hearing test.</p>
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
              <tr><td>Everyday tasks harder?</td><td>{last.functionChange ? 'Yes: this goes to the physician whatever the scores say' : 'No, or unclear'}</td></tr>
            </tbody></table>
            <p className="muted">{last.recognisers.length > 1 ? 'Both listeners scored this check, so each figure is a range where they disagreed.' : 'One listener scored this check, so there are no ranges.'}</p>
            <p className="muted">The words were list {last.list + 1}: <span lang={last.lang} dir={last.lang === 'ar' ? 'rtl' : 'ltr'}>{WORD_LISTS[last.lang][last.list].join(lang === 'ar' ? '، ' : ', ')}</span>. A patient sees only "Check received" and their trend.</p>
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
