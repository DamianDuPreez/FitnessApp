import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addExerciseToWorkout, discardWorkout, finishWorkout } from '../db/workouts'
import { useActiveWorkout, useExerciseMap, useNow, useSettings, useWakeLock } from '../hooks'
import { formatDuration } from '../lib/units'
import { ExerciseCard } from '../components/ExerciseCard'
import { ExerciseList } from '../components/ExerciseList'
import { CustomExerciseForm } from '../components/CustomExerciseForm'
import { RestTimer } from '../components/RestTimer'
import { Sheet } from '../components/Sheet'
import type { Exercise, WorkoutSet } from '../db/types'
import { ChevronDown, Dumbbell, Lightbulb, Plus } from 'lucide-react'
import { formatVolume } from '../lib/units'

const HINT_KEY = 'hint-logging'

/** One-time tips shown during the first session. */
function LoggingHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <div className="hint">
      <Lightbulb size={18} strokeWidth={1.6} className="brand" />
      <div className="grow">
        Enter weight and reps, then tap the <b>tick</b> to log the set. The rest timer starts on its own.
        Tap the <b>set number</b> to mark a warm-up (W), drop set (D) or failure set (F).
      </div>
      <button
        className="btn ghost sm"
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            /* ignore */
          }
        }}
      >
        Got it
      </button>
    </div>
  )
}

/** Local state so fast typing isn't lost waiting on the database round-trip. */
function WorkoutNameInput({ workoutId, initial }: { workoutId: number; initial: string }) {
  const [name, setName] = useState(initial)
  return (
    <input
      className="name-input"
      value={name}
      onChange={(e) => {
        setName(e.target.value)
        void db.workouts.update(workoutId, { name: e.target.value })
      }}
      onBlur={() => {
        if (!name.trim()) {
          setName('Workout')
          void db.workouts.update(workoutId, { name: 'Workout' })
        }
      }}
      aria-label="Workout name"
    />
  )
}

export function WorkoutPage() {
  const workout = useActiveWorkout()
  const navigate = useNavigate()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const now = useNow(1000)
  const [picking, setPicking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  useWakeLock(!!workout)

  const sets = useLiveQuery(
    () => (workout?.id ? db.sets.where('workoutId').equals(workout.id).sortBy('order') : Promise.resolve([] as WorkoutSet[])),
    [workout?.id],
    [] as WorkoutSet[],
  )

  if (workout === undefined) return null
  if (workout === null) {
    return (
      <div className="empty">
        <div className="empty-icon"><Dumbbell size={22} strokeWidth={1.5} /></div>
        <p>No workout in progress.</p>
        <button className="btn primary" onClick={() => navigate('/')}>Go home</button>
      </div>
    )
  }

  const completedSets = sets.filter((s) => s.completed === 1)
  const completed = completedSets.length
  const volumeKg = completedSets.filter((s) => s.setType !== 'warmup').reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0)
  const prSets = completedSets.filter((s) => s.prs?.length).length

  const finish = async () => {
    if (completed === 0) {
      if (confirm('No sets completed yet. Discard this workout?')) {
        await discardWorkout(workout.id!)
        navigate('/')
      }
      return
    }
    const pending = sets.filter((s) => s.completed === 0 && (s.reps != null || s.weightKg != null || s.durationSec != null)).length
    const msg = pending
      ? `Finish workout? ${pending} set${pending > 1 ? 's have' : ' has'} values but ${pending > 1 ? 'are' : 'is'} not ticked and will be dropped.`
      : 'Finish workout?'
    if (!confirm(msg)) return
    setBusy(true)
    const { workoutId } = await finishWorkout(workout.id!)
    navigate(`/summary/${workoutId}`, { replace: true })
  }

  const pick = async (e: Exercise) => {
    setPicking(false)
    setCreating(false)
    await addExerciseToWorkout(workout.id!, e.id)
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
  }

  return (
    <>
      <div className="workout-top">
        <div className="controls">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Minimise session"><ChevronDown size={22} strokeWidth={1.5} /></button>
          <button className="btn sm" onClick={finish} disabled={busy}>Finish</button>
        </div>
        <WorkoutNameInput key={workout.id} workoutId={workout.id!} initial={workout.name} />
        <div className="workout-clock">{formatDuration((now - workout.startedAt) / 1000)}</div>
        <div className="meta num">
          <span>{completed} set{completed === 1 ? '' : 's'}</span>
          <span>{formatVolume(volumeKg, settings.unit)}</span>
          {prSets > 0 && <span className="gold">{prSets} PR{prSets === 1 ? '' : 's'}</span>}
        </div>
      </div>

      {workout.exercises.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Plus size={22} strokeWidth={1.5} /></div>
          <p>Add your first exercise to get started.</p>
        </div>
      )}

      {workout.exercises.map((we, i) => {
        const ex = exMap.get(we.exerciseId)
        if (!ex) return null
        return (
          <ExerciseCard
            key={we.exerciseId}
            workoutId={workout.id!}
            exercise={ex}
            sets={sets.filter((s) => s.exerciseId === we.exerciseId)}
            unit={settings.unit}
            restSec={settings.defaultRestSec}
            isFirst={i === 0}
            isLast={i === workout.exercises.length - 1}
          />
        )
      })}

      {workout.exercises.length > 0 && <LoggingHint />}

      <div className="stack" style={{ marginTop: 24 }}>
        <button className="btn primary block big" onClick={() => setPicking(true)}>Add exercise <Plus size={20} strokeWidth={1.6} /></button>
        <button
          className="btn ghost block" style={{ color: 'var(--danger)' }}
          onClick={async () => {
            if (confirm('Discard this workout? Everything logged in it will be deleted.')) {
              await discardWorkout(workout.id!)
              navigate('/')
            }
          }}
        >
          Discard workout
        </button>
      </div>

      <RestTimer workout={workout} />

      {picking && (
        <Sheet
          title="Add exercise"
          onClose={() => setPicking(false)}
          footer={<button className="btn block" onClick={() => { setPicking(false); setCreating(true) }}><Plus size={16} /> Create custom exercise</button>}
        >
          <ExerciseList onPick={pick} selected={new Set(workout.exercises.map((e) => e.exerciseId))} />
        </Sheet>
      )}
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <CustomExerciseForm onCreated={pick} />
        </Sheet>
      )}
    </>
  )
}
