import { useEffect, useState } from 'react'
import { ArrowRight, Award, CalendarCheck, Check, Dumbbell, History, ShieldCheck, Timer, Trophy } from 'lucide-react'
import { AppMark } from './Icons'

const KEY = 'intro-done'
const EVENT = 'show-intro'

/** Re-open the first-use guide (used from Settings). */
export function showIntro() {
  window.dispatchEvent(new Event(EVENT))
}

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const STEPS = [
  {
    title: 'Log every set.',
    body: 'Start a session, add your exercises, then enter the weight and reps for each set.',
    points: [
      { Icon: Check, text: 'Tap the tick to complete a set. The rest timer starts on its own.' },
      { Icon: History, text: 'Your numbers from last time sit next to each set, so you know what to beat.' },
      { Icon: Timer, text: 'Tap a set number to mark it as a warm-up, drop set or failure set.' },
    ],
  },
  {
    title: 'Beat your records.',
    body: 'Personal records are picked up automatically the moment you complete a set.',
    points: [
      { Icon: Trophy, text: 'Estimated 1-rep max, heaviest weight, most reps and best set. Records light up in gold.' },
      { Icon: Dumbbell, text: 'Your first session with an exercise sets the baseline. Records start counting after that.' },
    ],
  },
  {
    title: 'Keep showing up.',
    body: 'Set a weekly goal and build a streak. Milestones unlock badges from Bronze to Legend.',
    points: [
      { Icon: CalendarCheck, text: 'Hit your weekly goal to keep the streak alive.' },
      { Icon: Award, text: 'Badges are yours forever once earned.' },
      { Icon: ShieldCheck, text: 'Your data stays on this phone. Export a backup from Settings now and then.' },
    ],
  },
]

export function Intro() {
  const [open, setOpen] = useState(() => !seen())
  const [step, setStep] = useState(0)

  useEffect(() => {
    const onShow = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(EVENT, onShow)
    return () => window.removeEventListener(EVENT, onShow)
  }, [])

  if (!open) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* private mode: show again next time */
    }
    setOpen(false)
  }
  const last = step === STEPS.length - 1
  const s = STEPS[step]

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Welcome to FitnessApp">
      <div className="intro-inner">
        <div className="row between">
          <div className="wordmark">
            <AppMark size={28} />
            <div className="wordmark-text">Fitness<span>App</span></div>
          </div>
          {!last && <button className="btn ghost sm" onClick={close}>Skip</button>}
        </div>

        <div className="step-body" key={step}>
          <div className="step-figure" aria-hidden>0{step + 1}</div>
          <h1>{s.title}</h1>
          <p>{s.body}</p>
          <ul>
            {s.points.map(({ Icon, text }) => (
              <li key={text}><Icon size={18} strokeWidth={1.6} />{text}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 28 }} className="stack">
          <div className="segments" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}
          </div>
          <button className="btn primary big block" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Get started' : 'Next'}
            <ArrowRight size={20} strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  )
}
