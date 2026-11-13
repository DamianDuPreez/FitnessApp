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
        <div className="big-emoji">🏋️</div>
        <p>No workout in progress.</p>
        <button className="btn primary" onClick={() => navigate('/')}>Go home</button>
      </div>
    )
  }

  const completed = sets.filter((s) => s.completed === 1).length

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
      ? `Finish workout? ${pending} set${pending > 1 ? 's have' : ' has'} values but ${pending > 1 ? 'are' : 'is'} not ticked ✓ and will be dropped.`
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
        <div className="row between">
          <div className="grow">
            <input
              className="name-input"
              value={workout.name}
              onChange={(e) => db.workouts.update(workout.id!, { name: e.target.value })}
              aria-label="Workout name"
            />
            <div className="small muted num">
              ⏱ {formatDuration((now - workout.startedAt) / 1000)} · {completed} set{completed === 1 ? '' : 's'} done
            </div>
          </div>
          <button className="btn success" onClick={finish} disabled={busy}>Finish</button>
        </div>
      </div>

      {workout.exercises.length === 0 && (
        <div className="empty">
          <div className="big-emoji">💪</div>
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

      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn primary block big" onClick={() => setPicking(true)}>+ Add exercise</button>
        <button
          className="btn ghost danger block"
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
          footer={<button className="btn block" onClick={() => { setPicking(false); setCreating(true) }}>+ Create custom exercise</button>}
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
