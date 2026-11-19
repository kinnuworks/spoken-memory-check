import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluate } from '../engine/change'
import { ANIMALS, ARABIC_REVIEWED, SOUND_CHECK_WORDS, WORD_LISTS, type Lang } from '../engine/lexicon'
import { scoreTask, type RangeScore } from '../engine/score'
import { readYesNo } from '../engine/yesno'
import { clearChecks, loadChecks, saveCheck, type StoredCheck } from '../engine/store'
import { browserSpeechAvailable, type ListenControl } from '../speech/recogniser'
import { level, startCapture } from '../speech/capture'
import { addConfirmed, features, type Templates } from '../engine/templates'
import { DOWNLOAD_FROM, DOWNLOAD_MB, SECOND_NAME, loadSecond, secondCrashedBefore, secondLoading, secondSupported } from '../speech/second'
import { OWN_NAME, deviceOnlyPossible, listenTask, type Heard } from '../speech/session'
import { cloudAvailable } from '../speech/cloud'
import { loadConsent, saveConsent } from '../engine/consent'
import { APP_VERSION } from '../engine/audit'
import { pause, speak } from '../speech/speak'
import TrajectoryChart from './TrajectoryChart'

type Stage = 'intro' | 'sound' | 'sound-failed' | 'hear-list' | 'recall-1' | 'animals' | 'count' | 'recall-2' | 'function' | 'scoring' | 'done' | 'blocked'

const T: Record<Lang, Record<string, string>> = {
  en: {
    list: 'I will read ten words, one at a time. Say each word back after me.',
    recallNow: 'Now say the words you remember.',
    animals: 'Now name as many animals as you can. You have one minute.',
    count: 'Now count backwards from twenty to one.',
    recallLater: 'Earlier I read you ten words. Say as many as you can remember.',
    fn: 'Last question. In the past month, have money, medicines or appointments become harder to manage? Please say yes or no.',
    thanks: 'Thank you. That is the end of the check.',
  },
  ar: {
    list: 'سأقرأ عشر كلمات، كلمة بعد كلمة. كرر كل كلمة بعدي.',
    recallNow: 'الآن قل الكلمات التي تتذكرها.',
    animals: 'الآن اذكر أكبر عدد من الحيوانات. لديك دقيقة واحدة.',
    count: 'الآن عد تنازلياً من عشرين إلى واحد.',
    recallLater: 'قرأت لك قبل قليل عشر كلمات. قل ما تتذكره منها.',
    fn: 'سؤال أخير. خلال الشهر الماضي، هل أصبح التعامل مع المال أو الأدوية أو المواعيد أصعب؟ قل نعم أو لا.',
    thanks: 'شكراً لك. انتهى الفحص.',
  },
}

const HEAD: Record<Stage, string> = {
  intro: 'The full check', sound: 'Say these three words', 'sound-failed': "We can't hear you clearly here", 'hear-list': 'Say each word back',
  'recall-1': 'Say the words you remember', animals: 'Name animals for one minute', count: 'Count backwards from twenty', 'recall-2': 'Say the ten words again', function: 'One last question', scoring: 'Scoring your check', done: 'Check received', blocked: "The microphone isn't available here",
}

// What the person reads during the check, in Arabic. A draft like the spoken prompts: not yet reviewed by a native Gulf Arabic speaker.
const HEAD_AR: Record<Stage, string> = {
  intro: 'الفحص الكامل', sound: 'قل هذه الكلمات الثلاث', 'sound-failed': 'لا نسمعك بوضوح هنا', 'hear-list': 'كرر كل كلمة',
  'recall-1': 'قل الكلمات التي تتذكرها', animals: 'اذكر حيوانات لمدة دقيقة', count: 'عد تنازلياً من عشرين', 'recall-2': 'قل الكلمات العشر مرة أخرى', function: 'سؤال أخير', scoring: 'جارٍ تقييم الفحص', done: 'تم استلام الفحص', blocked: 'الميكروفون غير متاح هنا',
}
const AR = {
  intro: 'يستغرق الفحص نحو أربع دقائق، ولا تحتاج إلا إلى صوتك. يبدأ بفحص للصوت. بعدها تكرر عشر كلمات، وتذكر أسماء حيوانات لمدة دقيقة، وتعد تنازلياً. وفي النهاية تقول الكلمات العشر مرة أخرى. اختر مكاناً هادئاً وأجرِ الفحص وحدك.',
  offDay: 'نمت نوماً سيئاً أو أشعر بتوعك اليوم',
  cloud: 'اسمح أيضاً لخدمة تعرّف على الكلام مستضافة في الإمارات بسماع هذا الفحص. لديها نموذج للهجة الخليجية، ولم تُقَس بعد دقتها مع المتحدثين الخليجيين في هذا الفحص. يغادر تسجيلك هذا الجهاز لهذا الغرض، ولا يُحفظ، ويمكنك إيقاف ذلك في أي وقت.',
  listeners: 'يقيّم ما تقوله نموذج كلام يعمل على هذا الجهاز، ولا يُرسل صوتك إلى أي مكان. نتائجك تبقى على هذا الجهاز. هذه نسخة تجريبية ولا تشخّص.',
  browser: 'استخدم أيضاً خدمة الكلام في متصفحي. تعرض الكلمات أثناء حديثي، لكنها قد ترسل صوتي إلى الشركة المصنّعة للمتصفح خارج الإمارات.',
  agree: 'أوافق على إجراء فحوص الذاكرة في المنزل وحفظ نتائجي على هذا الجهاز. يمكنني إيقاف ذلك وحذف فحوصي في أي وقت.',
  start: 'ابدأ الفحص',
  listening: 'نستمع…',
  finished: 'انتهيت',
  hearList: 'كرر كل كلمة بعد أن تسمعها. يصبح صوتك مفتاح الإجابة لاحقاً.',
  thanks: 'شكراً لك. انتهى الفحص.',
}

export default function Check() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>(deviceOnlyPossible('en') || browserSpeechAvailable() ? 'intro' : 'blocked')
  const [live, setLive] = useState<RangeScore | null>(null)
  const [offDay, setOffDay] = useState(false)
  const [history, setHistory] = useState<StoredCheck[]>(loadChecks())
  const [last, setLast] = useState<StoredCheck | null>(null)
  const control = useRef<ListenControl>({})
  const [percent, setPercent] = useState<number | null>(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudOn, setCloudOn] = useState(loadConsent().cloudListener)
  const [agreed, setAgreed] = useState(loadConsent().takeChecks)
  // Scoring stays on this device unless the person turns on the browser's recogniser.
  const [browserOn, setBrowserOn] = useState(false)
  useEffect(() => { void cloudAvailable().then(setCloudReady) }, [])
  const useCloud = cloudReady && cloudOn
  const listIndex = history.length % WORD_LISTS[lang].length
  const words = WORD_LISTS[lang][listIndex]

  function startSecond() {
    if (!secondSupported(lang) || secondLoading(lang)) return
    setPercent(0)
    loadSecond(lang, setPercent).then(() => setPercent(null)).catch(() => setPercent(null))
  }

  async function listen(ms: number, rows: string[][], show = true, useSecond = true, own?: Templates, score = true): Promise<Heard> {
    control.current = {}
    setLive(null)
    const heard = await listenTask(lang, ms, (t) => { if (show) setLive(scoreTask({ Browser: t }, rows, lang)) }, control.current, useSecond, useCloud, own, { browser: browserOn, score })
    if (show) setLive(scoreTask(heard.first, rows, lang))
    return heard
  }

  async function run() {
    try {
      setStage('sound')
      if (!browserOn) {
        // The on-device listener has to be ready before anything is recorded.
        if (!deviceOnlyPossible(lang)) throw new Error('no-device-listener')
        setPercent(0)
        await loadSecond(lang, setPercent)
        setPercent(null)
      } else if (lang === 'en') startSecond()
      const soundRows = SOUND_CHECK_WORDS[lang].map((w) => [w])
      const soundHeard = await listen(7000, soundRows, true, false)
      const sound = scoreTask(browserOn ? soundHeard.first : await soundHeard.both, soundRows, lang)
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
      // Registration: the person says each word back once. Those recordings become their own
      // answer key for both recall tasks, so recall is matched against their own voice too.
      const own: Templates = {}
      for (const w of words) {
        await speak(w, lang)
        const cap = await startCapture()
        await pause(2200)
        const clip = cap ? await cap.stop() : null
        if (clip && level(clip) >= 0.002) own[w] = [features(clip)]
      }
      await speak(T[lang].recallNow, lang)
      setStage('recall-1')
      // Recalled words are not shown while the person speaks: seeing them would be a cue for the later recall.
      const immediateHeard = await listen(45000, rows, false, true, own)

      await speak(T[lang].animals, lang)
      setStage('animals')
      const animalsHeard = await listen(60000, ANIMALS[lang])

      await speak(T[lang].count, lang)
      setStage('count'); setLive(null)
      await listen(30000, [], false, false, undefined, false)

      await speak(T[lang].recallLater, lang)
      setStage('recall-2')
      // Words both listeners confirmed in the first recall give own-voice matching a second recording of each.
      // The on-device listener may still be working on that recording, so this waits at most a few seconds.
      const firstRecall = await Promise.race([immediateHeard.both, pause(4000).then(() => null)])
      const immClip = await immediateHeard.clip
      const ownLater = firstRecall && immClip
        ? addConfirmed(own, immClip, new Set(scoreTask(firstRecall, rows, lang).items.filter((it) => it.heard === 'both' && it.by.includes(OWN_NAME)).map((it) => words[it.row])))
        : own
      const delayedHeard = await listen(45000, rows, false, true, ownLater)
      await speak(T[lang].fn, lang)
      setStage('function')
      const fnHeard = await listen(8000, [], false, false)
      const functionChange = readYesNo(browserOn ? (fnHeard.first.Browser ?? '') : ((await fnHeard.both)[SECOND_NAME] ?? ''), lang)
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
  // In Arabic the person reads Arabic first, with the English underneath for anyone helping them.
  const bi = (en: string, ar: string) => (lang === 'ar' ? <><span lang="ar" dir="rtl" style={{ display: 'block' }}>{ar}</span><span className="muted" style={{ display: 'block', fontSize: '0.85em' }}>{en}</span></> : en)

  return (
    <>
      <h1>{lang === 'ar' ? <span lang="ar" dir="rtl">{HEAD_AR[stage]}</span> : HEAD[stage]}</h1>
      {lang === 'ar' && <p className="muted">{HEAD[stage]}</p>}

      {stage === 'intro' && (
        <>
          <p>{bi('It takes about four minutes, and you only need your voice. First comes a sound check. Then you say ten words back, name animals for a minute and count backwards. At the end you say the ten words again. Find a quiet place and do it on your own.', AR.intro)}</p>
          <div className="segmented" role="group" aria-label="Language">
            <button className="seg" onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English</button>
            <button className="seg" lang="ar" onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>العربية</button>
          </div>
          {lang === 'ar' && !ARABIC_REVIEWED && <p className="note">The Arabic wording and word lists are a draft, not yet reviewed by a native Gulf Arabic speaker, and the voice is the device's synthetic one.</p>}
          <label className="choice"><input className="switch" type="checkbox" checked={offDay} onChange={(e) => setOffDay(e.target.checked)} /><span>{bi('I slept badly or feel unwell today', AR.offDay)}</span></label>
          {cloudReady && <label className="choice"><input className="switch" type="checkbox" checked={cloudOn} onChange={(e) => { setCloudOn(e.target.checked); saveConsent({ ...loadConsent(), cloudListener: e.target.checked }) }} /><span>{bi('Also let a speech service hosted in the UAE hear this check. It has a Gulf Arabic model; how well it hears Gulf speakers in this check has not been measured yet. Your recording leaves this device for this, is not kept, and you can turn this off at any time.', AR.cloud)}</span></label>}
          {lang === 'ar' && <p className="note" lang="ar" dir="rtl">{AR.listeners}</p>}
          <p className="note">An open speech model on this device scores what you say, and your voice is sent nowhere.{secondSupported(lang) ? ` It needs a one-time download of about ${DOWNLOAD_MB[lang]} MB from ${DOWNLOAD_FROM[lang]}, so use Wi-Fi on a phone.` : secondCrashedBefore(lang) ? " Last time, this device closed the page while running it, which usually means it ran out of memory. To take the check here, turn on the browser's speech service below." : " This device can't run it, so to take the check here, turn on the browser's speech service below."} What you say back is also matched against your own voice saying the words. The voice reading the words is your device's own. Your scores stay on this device. This is a test version and does not diagnose.</p>
          <label className="choice"><input className="switch" type="checkbox" checked={browserOn} onChange={(e) => setBrowserOn(e.target.checked)} /><span>{bi("Also use my browser's speech service. It shows words as I speak, but may send my voice to the browser's maker, outside the UAE.", AR.browser)}</span></label>
          {lang === 'ar' && secondSupported('ar') && percent === null && !secondLoading('ar') && <p><button className="small" onClick={startSecond}>Add the second listener for Arabic ({DOWNLOAD_MB.ar} MB)</button></p>}
          <label className="choice"><input className="switch" type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); saveConsent({ ...loadConsent(), takeChecks: e.target.checked }) }} /><span>{bi('I agree to take memory checks at home and keep my scores on this device. I can turn this off and delete my checks at any time.', AR.agree)}</span></label>
          <div className="stack"><button className="primary" disabled={!agreed} onClick={run}>{lang === 'ar' ? <span lang="ar">{AR.start}</span> : 'Start the check'}</button>{!agreed && <p className="muted">Turn on the agreement above to start.</p>}</div>
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

      {percent !== null && <p className="muted">Speech model on this device: {percent}%</p>}
      {stage === 'function' && <p lang={lang} dir={dir}>{T[lang].fn}</p>}
      {stage === 'scoring' && <p className="listening"><i />{useCloud ? 'The on-device and UAE listeners are going through your recordings.' : 'The second listener is going through your recordings on this device.'} This can take up to a minute.</p>}
      {stage === 'sound' && <><p className="prompt-words" lang={lang} dir={dir}>{SOUND_CHECK_WORDS[lang].join(lang === 'ar' ? '، ' : ', ')}</p><p className="listening"><i />Listening…</p><p className="muted">If your browser asks to use the microphone, choose Allow.</p></>}
      {stage === 'hear-list' && <p className="listening"><i />{bi('Say each word back after you hear it. Your own voice becomes the answer key for later.', AR.hearList)}</p>}
      {stage === 'animals' && <div className="chips" lang={lang} dir={dir}>{live?.items.map((it) => <span key={it.row} className="chip">{it.label}</span>)}</div>}
      {listening && (
        <>
          <p className="listening"><i />{bi('Listening…', AR.listening)}</p>
          <div className="stack"><button onClick={() => control.current.stop?.()}>{lang === 'ar' ? <span lang="ar">{AR.finished}</span> : "I've finished"}</button></div>
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
          {lang === 'ar' && <p lang="ar" dir="rtl">{AR.thanks}</p>}
          <p>Thank you. {last.low === null ? 'This check could not be scored, so it does not count. In real use it is repeated another day with a different list.' : `That was check ${history.length}.`}</p>
          <p className="note">{loadConsent().sharePhysician ? 'You agreed that your physician is told if your scores stay lower than usual. Nothing is sent after a single check.' : 'You have not agreed to share with your physician, so nothing from this check goes to a physician. You can change this on your choices screen.'}</p>
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
