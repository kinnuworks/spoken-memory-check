import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluate, type CheckResult } from '../engine/change'
import { ANIMALS, WORD_LISTS, type Lang } from '../engine/lexicon'
import { matchClosedSet } from '../engine/match'
import { scoreTask, type RangeScore } from '../engine/score'
import bench from '../data/benchmark.json'
import tplBench from '../data/template-bench.json'
import { addConfirmed, features, spot, type Templates } from '../engine/templates'
import { decodeTo16k, level } from '../speech/capture'
import { DOWNLOAD_FROM, DOWNLOAD_MB, SECOND_NAME, loadSecond, transcribeSecond } from '../speech/second'
import { OWN_NAME } from '../speech/session'

// The first check anyone takes uses list 1, so the recording does too.
const LIST = 0
const BASE = 'samples/full'
const regClip = (lang: Lang, i: number) => `${BASE}/${lang}/reg-${String(i + 1).padStart(2, '0')}.wav`
const clip = (lang: Lang, name: string) => `${BASE}/${lang}/${name}.wav`

// The same spoken prompts the real check uses.
const PROMPT: Record<Lang, Record<string, string>> = {
  en: {
    list: 'I will read ten words, one at a time. Say each word back after me.',
    recallNow: 'Now say the words you remember.',
    animals: 'Now name as many animals as you can. You have one minute.',
    count: 'Now count backwards from twenty to one.',
    recallLater: 'Earlier I read you ten words. Say as many as you can remember.',
    fn: 'Last question. In the past month, have money, medicines or appointments become harder to manage? Please say yes or no.',
    answer: 'No.',
  },
  ar: {
    list: 'سأقرأ عشر كلمات، كلمة بعد كلمة. كرر كل كلمة بعدي.',
    recallNow: 'الآن قل الكلمات التي تتذكرها.',
    animals: 'الآن اذكر أكبر عدد من الحيوانات. لديك دقيقة واحدة.',
    count: 'الآن عد تنازلياً من عشرين إلى واحد.',
    recallLater: 'قرأت لك قبل قليل عشر كلمات. قل ما تتذكره منها.',
    fn: 'سؤال أخير. خلال الشهر الماضي، هل أصبح التعامل مع المال أو الأدوية أو المواعيد أصعب؟ قل نعم أو لا.',
    answer: 'لا.',
  },
}

// What the computer voice says in each clip (scripts/make-full-check-audio.sh), so every
// listener can be scored against it: words heard, words said but missed, words credited wrongly.
const SAID: Record<Lang, Record<'immediate' | 'animals' | 'delayed', string[]> & { extra: string }> = {
  en: {
    immediate: ['river', 'candle', 'window', 'garden', 'bridge', 'mirror', 'jacket'], extra: 'carpet',
    animals: ['dog', 'cat', 'horse', 'cow', 'lion', 'tiger', 'elephant', 'giraffe', 'camel', 'monkey', 'rabbit', 'eagle', 'shark', 'sheep'],
    delayed: ['river', 'window', 'garden', 'mirror', 'candle', 'butter'],
  },
  ar: {
    immediate: ['نهر', 'شمعة', 'نافذة', 'حديقة', 'جسر', 'مرآة', 'معطف'], extra: 'كرسي',
    animals: ['جمل', 'حصان', 'قطة', 'كلب', 'أسد', 'نمر', 'فيل', 'زرافة', 'غزال', 'صقر', 'سمكة', 'بقرة', 'خروف', 'ثعلب'],
    delayed: ['نهر', 'نافذة', 'حديقة', 'مرآة', 'شمعة', 'زبدة'],
  },
}

/** Against the script: which items were said and missed by every listener, and which were credited but never said. */
function againstScript(score: RangeScore, said: string[], taskRows: string[][], lang: Lang) {
  const saidRows = matchClosedSet(said.join(' '), taskRows, lang)
  const heard = new Set(score.items.map((it) => it.row))
  return {
    said: saidRows.size,
    missed: [...saidRows].filter((r) => !heard.has(r)).map((r) => taskRows[r][0]),
    added: score.items.filter((it) => !saidRows.has(it.row)).map((it) => it.label),
  }
}

// The flag test's own worlds where listeners miss words: what it does to false alarms and to catching a slow decline.
const missWorlds = (bench.rows as { world: string; rule: string; falseAlarmYear: number; detected: Record<string, number> }[]).filter((r) => r.rule === 'ours')
// The two listeners together on real single-word recordings (scripts/template-bench.ts).
const REAL = Object.fromEntries((['ar', 'en'] as Lang[]).map((l) => {
  const o = tplBench.unionWithWhisper[l === 'ar' ? 'arabic' : 'english'].own.overall
  return [l, { n: o.union.n, union: o.union.rate, falseCredit: o.templateFalseCredit.rate }]
})) as Record<Lang, { n: number; union: number; falseCredit: number }>
const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`

type TaskKey = 'immediate' | 'animals' | 'delayed'
interface TaskResult { score: RangeScore; transcripts: Record<string, string>; seconds: number }
type Stage = 'intro' | 'running' | 'done' | 'failed'

const sec = (ms: number) => Math.round(ms / 100) / 10
const range = (s: { low: number; high: number }) => (s.low === s.high ? String(s.high) : `${s.low} to ${s.high}`)

export default function RecordedCheck() {
  const [lang, setLang] = useState<Lang>('en')
  const [stage, setStage] = useState<Stage>('intro')
  const [step, setStep] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
  const [own, setOwn] = useState<{ words: string[]; seconds: number } | null>(null)
  const [loadSeconds, setLoadSeconds] = useState<number | null>(null)
  const [secondOk, setSecondOk] = useState(true)
  const [added, setAdded] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Partial<Record<TaskKey, TaskResult>>>({})
  const [total, setTotal] = useState<{ low: number; high: number; scored: boolean; seconds: number; result: CheckResult } | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)

  const words = WORD_LISTS[lang][LIST]
  const rows = words.map((w) => [w])
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const sep = lang === 'ar' ? '، ' : ', '

  function play(src: string) {
    player.current?.pause()
    player.current = new Audio(src)
    void player.current.play()
  }

  function reset(l: Lang) {
    setLang(l); setStage('intro'); setOwn(null); setTasks({}); setTotal(null); setLoadSeconds(null); setPercent(null); setSecondOk(true); setAdded(null)
  }

  async function run() {
    try {
      setStage('running'); setTasks({}); setTotal(null); setOwn(null); setLoadSeconds(null); setSecondOk(true)
      const fetchClip = async (src: string) => decodeTo16k(await (await fetch(src)).arrayBuffer())

      // Registration: each word said back once becomes the person's own answer key, as in the real check.
      setStep('Building the answer key from the ten words said back…')
      const regs = await Promise.all(words.map((_, i) => fetchClip(regClip(lang, i))))
      const tReg = performance.now()
      const templates: Templates = {}
      regs.forEach((a, i) => { if (level(a) >= 0.002) templates[words[i]] = [features(a)] })
      setOwn({ words: Object.keys(templates), seconds: sec(performance.now() - tReg) })

      const [imm, ani, del] = await Promise.all(['recall-1', 'animals', 'recall-2'].map((n) => fetchClip(clip(lang, n))))

      setStep('Getting the on-device listener ready…')
      setPercent(0)
      const tLoad = performance.now()
      let haveSecond = true
      try { await loadSecond(lang, setPercent) } catch { haveSecond = false }
      setPercent(null)
      setLoadSeconds(sec(performance.now() - tLoad))
      setSecondOk(haveSecond)

      const scoreOne = async (key: TaskKey, audio: Float32Array, taskRows: string[][], withOwn: boolean, label: string) => {
        setStep(label)
        const t = performance.now()
        const transcripts: Record<string, string> = {}
        if (haveSecond) {
          // One retry: a first transcription straight after the download can fail while the model warms up.
          const text = (await transcribeSecond(audio, lang, 180000)) ?? (await transcribeSecond(audio, lang, 180000))
          if (text !== null) transcripts[SECOND_NAME] = text
          else setSecondOk(false)
        }
        if (withOwn && Object.keys(templates).length) transcripts[OWN_NAME] = spot(templates, audio).map((d) => d.word).join(' ')
        const result: TaskResult = { score: scoreTask(transcripts, taskRows, lang), transcripts, seconds: sec(performance.now() - t) }
        setTasks((prev) => ({ ...prev, [key]: result }))
        return result.score
      }

      const tScore = performance.now()
      const immediate = await scoreOne('immediate', imm, rows, true, 'Scoring the words recalled straight away…')
      // Words confirmed in the first recall give the own-voice key a second recording of each, as in the real check.
      const confirmed = new Set(immediate.items.filter((it) => it.heard === 'both' && it.by.includes(OWN_NAME)).map((it) => words[it.row]))
      const before = Object.values(templates).reduce((a, ts) => a + ts.length, 0)
      Object.assign(templates, addConfirmed(templates, imm, confirmed))
      setAdded(Object.values(templates).reduce((a, ts) => a + ts.length, 0) - before)
      const animals = await scoreOne('animals', ani, ANIMALS[lang], false, 'Scoring the minute of animals…')
      const delayed = await scoreOne('delayed', del, rows, true, 'Scoring the words recalled later…')

      const heardAll = immediate.recognisers.length > 0 && animals.recognisers.length > 0 && delayed.recognisers.length > 0
      const scored = heardAll && immediate.scored && animals.scored && delayed.scored
      const low = immediate.low + animals.low + delayed.low, high = immediate.high + animals.high + delayed.high
      // As the first check on a device: the rule of record decides what happens next.
      const traj = evaluate([{ date: new Date().toISOString().slice(0, 10), low: scored ? low : null, high: scored ? high : null }])
      setTotal({ low, high, scored, seconds: sec(performance.now() - tScore), result: traj.results[0] })
      setStage('done')
    } catch {
      setStage('failed')
    }
  }

  const busy = stage === 'running'

  const taskRows = (k: TaskKey) => (k === 'animals' ? ANIMALS[lang] : rows)
  const vsScript = (k: TaskKey) => { const r = tasks[k]; return r ? againstScript(r.score, SAID[lang][k], taskRows(k), lang) : null }

  function taskCard(k: TaskKey, title: string, prompt: string, src: string, said: string) {
    const r = tasks[k]
    const vs = vsScript(k)
    const listeners = r ? Object.keys(r.transcripts) : []
    const both = r?.score.items.filter((it) => it.by.length >= 2 && listeners.length > 1) ?? []
    const byOne = (name: string) => r?.score.items.filter((it) => it.by.length === 1 && it.by[0] === name) ?? []
    return (
      <div className="card">
        <h3>{title}</h3>
        <p className="muted">The check says: <span lang={lang} dir={dir}>{prompt}</span></p>
        <audio controls preload="none" src={src} style={{ width: '100%' }} />
        <p className="muted">{said}</p>
        {!r && busy && <p className="listening"><i />Waiting to be scored…</p>}
        {r && (
          <>
            <p><strong>{range(r.score)}</strong> {k === 'animals' ? 'animals' : 'of 10 words'}{listeners.length > 1 && r.score.low !== r.score.high ? ' (a range: the listeners disagreed on some words)' : ''}</p>
            {listeners.length === 0 && <p>No listener could hear this recording on this device.</p>}
            {both.length > 0 && chipRow("both", "Heard by both listeners", "both", both.map((it) => it.label))}
            {listeners.map((n) => byOne(n).length > 0 && chipRow(n, listeners.length > 1 ? `Only ${n}` : `Heard by ${n}`, listeners.length > 1 ? 'one' : 'both', byOne(n).map((it) => it.label)))}
            {vs && vs.missed.length > 0 && chipRow('missed', 'Said, but no listener heard it', 'miss', vs.missed)}
            {vs && <p className="muted">Against the recording: {vs.said - vs.missed.length} of {vs.said} heard{vs.added.length ? `; credited but never said: ${vs.added.join(sep)}` : '; nothing credited that was not said'}.</p>}
            {r.score.unmatched.length > 0 && <p className="muted">Heard but not on the list, so not counted: <span lang={lang} dir={dir}>{r.score.unmatched.slice(0, 12).join(sep)}</span></p>}
            <details>
              <summary className="muted">What each listener wrote down</summary>
              {listeners.map((n) => <p key={n} className="muted">{n}: <span lang={lang} dir={dir}>{r.transcripts[n] || '(nothing)'}</span></p>)}
            </details>
            {k === 'delayed' && added !== null && added > 0 && <p className="muted">Own voice also used the {added} word{added === 1 ? '' : 's'} both listeners confirmed in the first recall as a second recording of each.</p>}
            <p className="muted">Scored on this device in {r.seconds} s.</p>
          </>
        )}
      </div>
    )
  }

  function chipRow(key: string, label: string, cls: string, labels: string[]) {
    return (
      <div key={key}>
        <p className="muted" style={{ marginBottom: 0 }}>{label}</p>
        <div className="chips" lang={lang} dir={dir}>{labels.map((l) => <span key={l} className={`chip ${cls}`}>{l}</span>)}</div>
      </div>
    )
  }

  const s = SAID[lang]
  const all = (['immediate', 'animals', 'delayed'] as TaskKey[]).map(vsScript)
  const saidAll = all.reduce((n, v) => n + (v?.said ?? 0), 0)
  const missedAll = all.flatMap((v) => v?.missed ?? [])
  const addedAll = all.flatMap((v) => v?.added ?? [])
  const real = REAL[lang]
  const world = (w: string) => missWorlds.find((r) => r.world.startsWith(w))
  const [calm, miss8, miss15] = [world('As assumed'), world('Each recogniser misses 8%'), world('Each recogniser misses 15%')]
  return (
    <>
      <h1>Play a full recorded check</h1>
      <p><span className="tag syn">Computer voice, not a person</span></p>
      <div className="segmented" role="group" aria-label="Language">
        <button className="seg" aria-pressed={lang === 'en'} disabled={busy} onClick={() => reset('en')}>English</button>
        <button className="seg" lang="ar" aria-pressed={lang === 'ar'} disabled={busy} onClick={() => reset('ar')}>العربية</button>
      </div>
      <p>No microphone needed. A computer voice plays the person's side of the whole four-minute check. Your device then scores it the way the real check would: the ten words said back become the answer key, and two listeners go through each recall and the minute of animals.</p>
      <p className="note">Two listeners score here. <strong>On-device</strong> is an open speech model that runs in this browser and sends nothing anywhere (one-time download of about {DOWNLOAD_MB[lang]} MB from {DOWNLOAD_FROM[lang]}). <strong>{OWN_NAME}</strong> matches recall against the ten words as this speaker said them back. The real check also has the browser's own speech recogniser, but that only listens to a live microphone, so it is left out here.</p>

      {stage === 'intro' && <div className="stack"><button className="primary" onClick={run}>Score the whole check on my device</button></div>}
      {busy && <p className="listening"><i />{step}</p>}
      {percent !== null && <div><p className="muted">On-device listener: {percent}%</p><div className="meter"><i style={{ width: `${percent}%` }} /></div></div>}
      {stage === 'failed' && <p>Something went wrong loading the recordings on this device. Try again, or <Link to="/recorded">play the shorter recorded check</Link>.</p>}
      {!secondOk && <p className="note">The on-device listener could not run here, so only own-voice matching scored the recall. Older or low-memory devices score with fewer listeners.</p>}

      <h2>The check, step by step</h2>

      <div className="card">
        <h3>1. Sound check</h3>
        <p className="muted">In the real check the browser's recogniser hears three words first, to make sure the person can be heard. It needs a live microphone, so this recording starts after it.</p>
      </div>

      <div className="card">
        <h3>2. Ten words, each said back</h3>
        <p className="muted">The check says: <span lang={lang} dir={dir}>{PROMPT[lang].list}</span></p>
        <p className="muted">Tap a word to hear the computer voice say it back.</p>
        <div className="chips" lang={lang} dir={dir}>{words.map((w, i) => <button key={w} className="chip" onClick={() => play(regClip(lang, i))}>{w}</button>)}</div>
        {own && <p className="muted">{own.words.length} of 10 clips became the {OWN_NAME.toLowerCase()} answer key, built on this device in {own.seconds} s. Nothing is scored here; saying a word back only shows it was heard.</p>}
      </div>

      {taskCard("immediate", "3. Words recalled straight away", PROMPT[lang].recallNow, clip(lang, 'recall-1'), `In this recording: ${s.immediate.length} of the 10 words, plus "${s.extra}", which is not on the list.`)}
      {taskCard("animals", "4. A minute of animals", PROMPT[lang].animals, clip(lang, 'animals'), `In this recording: ${s.animals.length} animals. ${OWN_NAME} matching is for the ten list words only, so one listener scores this task.`)}

      <div className="card">
        <h3>5. Counting backwards</h3>
        <p className="muted">The check says: <span lang={lang} dir={dir}>{PROMPT[lang].count}</span></p>
        <p className="muted">This only puts time between the two recalls. The real check does not score it, so the recording skips it.</p>
      </div>

      {taskCard("delayed", "6. Words recalled later", PROMPT[lang].recallLater, clip(lang, 'recall-2'), `In this recording: ${s.delayed.length} of the 10 words.`)}

      <div className="card">
        <h3>7. Everyday tasks</h3>
        <p className="muted">The check says: <span lang={lang} dir={dir}>{PROMPT[lang].fn}</span></p>
        <audio controls preload="none" src={clip(lang, 'answer')} style={{ width: '100%' }} />
        <p>Answer: <strong lang={lang} dir={dir}>{PROMPT[lang].answer}</strong> <span className="muted">This is the known text of the recording. In the real check the browser's recogniser reads the yes or no, and it needs a microphone. A "yes" goes to the physician whatever the scores say.</span></p>
      </div>

      {total && (
        <>
          <h2>The whole check</h2>
          <p className="big" data-said={saidAll} data-missed={missedAll.length} data-added={addedAll.length}>{total.scored ? range(total) : 'Not scored'}</p>
          <p>{total.scored ? `Words heard, of ${saidAll} said: words recalled straight away, plus animals, plus words recalled later. ${total.low === total.high ? 'The listeners agreed on every item.' : 'The low end counts words both listeners heard; the high end counts words either one heard.'}` : 'The listeners disagreed on too much, or could not hear a task, so the real check would not count this one. It would be repeated another day with a different list.'}</p>
          <div className="card">
            <p><strong>Checked against what the voice said</strong></p>
            <p>{missedAll.length === 0 ? `Every one of the ${saidAll} words said was heard by at least one listener.` : `${saidAll - missedAll.length} of the ${saidAll} words said were heard. No listener heard ${missedAll.length === 1 ? 'this one' : `these ${missedAll.length}`}:`}</p>
            {missedAll.length > 0 && <div className="chips" lang={lang} dir={dir}>{missedAll.map((l) => <span key={l} className="chip miss">{l}</span>)}</div>}
            <p>{addedAll.length === 0 ? 'No word was credited that was not said. ' : `Credited but never said: ${addedAll.join(sep)}. `}Listeners miss words far more often than they add one: on {real.n} real recordings of single {lang === 'ar' ? 'Arabic' : 'English'} words, the two together missed {Math.round((1 - real.union) * 100)} in 100, and own voice credited a wrong word in about {Math.max(1, Math.round(real.falseCredit * 100))} in 100. So a count is more likely to be too low than too high, and the top of the range can sit below what was said.</p>
            {calm && miss8 && miss15 && <p className="muted">Why a missed word does not set off the flag: each person is compared with their own earlier checks, scored by the same listeners, so their usual misses are in the baseline too. In the flag test, listeners that each miss 8 in 100 words lowered false alarms from {pct(calm.falseAlarmYear)} to {pct(miss8.falseAlarmYear)} a year, and 15 in 100 to {pct(miss15.falseAlarmYear)}. The cost is a slow decline caught later: at 1 point a check, {pct(miss8.detected['1'])} and {pct(miss15.detected['1'])} flagged within the year, against {pct(calm.detected['1'])}.</p>}
          </div>
          <div className="card">
            <p><strong>What the rule does with it</strong></p>
            <p>{total.result.note} {total.scored ? 'As a first check, it is not compared with anything. Three scored checks within two weeks set the baseline; later checks are compared with it, and a physician hears only when two checks in a row sit well below it, or the scores fall steadily.' : 'A missing score is never treated as a low one.'}</p>
          </div>
          <table><tbody>
            <tr><td>Answer key from the ten words said back</td><td>{own?.seconds} s</td></tr>
            <tr><td>Getting the on-device listener ready{loadSeconds !== null && loadSeconds > 5 ? ' (includes the one-time download)' : ''}</td><td>{loadSeconds} s</td></tr>
            {tasks.immediate && <tr><td>Words recalled straight away</td><td>{tasks.immediate.seconds} s</td></tr>}
            {tasks.animals && <tr><td>A minute of animals</td><td>{tasks.animals.seconds} s</td></tr>}
            {tasks.delayed && <tr><td>Words recalled later</td><td>{tasks.delayed.seconds} s</td></tr>}
            <tr><td><strong>Scoring all three tasks</strong></td><td><strong>{total.seconds} s</strong></td></tr>
          </tbody></table>
          <p className="note">A clear computer voice is the easy case. On public Saudi TV speech these listeners heard older Gulf speakers no worse than younger ones, but Gulf speech was harder than other dialects, and older Emirati volunteers doing this check have not been measured yet. Each recording is scored against what the voice said, so every miss is shown.</p>
          <div className="stack"><button onClick={run}>Score it again</button><Link className="btn primary" to="/year">See a year of checks</Link></div>
        </>
      )}
    </>
  )
}
