import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, SetType, Unit, WorkoutSet } from '../db/types'
import {
  addSet,
  completeSet,
  deleteSet,
  getPreviousSets,
  moveExercise,
  removeExerciseFromWorkout,
  uncompleteSet,
  updateSet,
} from '../db/workouts'
import { formatDuration, fromDisplayWeight, toDisplayWeight } from '../lib/units'
import { parseNum } from '../lib/format'
import { RECORD_LABELS, estimate1RM } from '../lib/records'
import { ArrowDown, ArrowUp, Check, Ellipsis, Minus, Plus, Trash2 } from 'lucide-react'
import { RecordIcons } from './Icons'
import { titleCase } from '../lib/format'
import { celebratePR } from '../lib/celebrate'
import { useToast } from './Toasts'

const NEXT_TYPE: Record<SetType, SetType> = { normal: 'warmup', warmup: 'drop', drop: 'failure', failure: 'normal' }
const TYPE_LABEL: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' }

/** "90" -> 90, "1:30" -> 90 */
export function parseDuration(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [m, s] = t.split(':').map((x) => parseInt(x || '0', 10))
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null
  }
  return parseNum(t)
}

function prevLabel(s: WorkoutSet | undefined, ex: Exercise, unit: Unit): string {
  if (!s) return '—'
  if (ex.trackingType === 'duration') return s.durationSec ? formatDuration(s.durationSec) : '—'
  const w = s.weightKg ? `${toDisplayWeight(s.weightKg, unit)}` : ex.trackingType === 'bodyweight' ? 'BW' : '0'
  return `${w} × ${s.reps ?? 0}`
}

interface Props {
  workoutId: number
  exercise: Exercise
  sets: WorkoutSet[]
  unit: Unit
  restSec: number
  isFirst: boolean
  isLast: boolean
}

export function ExerciseCard({ workoutId, exercise, sets, unit, restSec, isFirst, isLast }: Props) {
  const [menu, setMenu] = useState(false)
  const previous = useLiveQuery(() => getPreviousSets(exercise.id, workoutId), [exercise.id, workoutId], [])
  const duration = exercise.trackingType === 'duration'
  let workingIndex = 0

  return (
    <div className="ex-card">
      <div className="ex-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <Link to={`/exercises/${encodeURIComponent(exercise.id)}`} className="ellipsis" style={{ display: 'block' }}>{exercise.name}</Link>
          <div className="muscle">{titleCase(exercise.primaryMuscles.join(', ') || exercise.category)}</div>
        </div>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Exercise options" aria-expanded={menu}><Ellipsis size={20} /></button>
      </div>
      {menu && (
        <div className="menu">
          <button className="btn sm" disabled={isFirst} onClick={() => moveExercise(workoutId, exercise.id, -1)}><ArrowUp size={15} /> Up</button>
          <button className="btn sm" disabled={isLast} onClick={() => moveExercise(workoutId, exercise.id, 1)}><ArrowDown size={15} /> Down</button>
          <button
            className="btn sm"
            disabled={sets.length <= 1}
            onClick={() => deleteSet(sets[sets.length - 1].id!)}
          >
            <Minus size={15} /> Last set
          </button>
          <button
            className="btn sm danger"
            onClick={() => {
              if (confirm(`Remove ${exercise.name} from this workout?`)) void removeExerciseFromWorkout(workoutId, exercise.id)
            }}
          >
            <Trash2 size={15} /> Remove
          </button>
        </div>
      )}

      <div className={`set-grid head ${duration ? 'duration' : ''}`}>
        <span className="center">Set</span>
        <span>Previous</span>
        {duration ? (
          <span className="center">Time</span>
        ) : (
          <>
            <span className="center">{exercise.trackingType === 'bodyweight' ? `+${unit}` : unit}</span>
            <span className="center">Reps</span>
          </>
        )}
        <span className="center"><Check size={13} strokeWidth={2.5} /></span>
      </div>

      {sets.map((s, i) => {
        if (s.setType !== 'warmup') workingIndex++
        return (
          <SetRow
            key={s.id}
            set={s}
            label={TYPE_LABEL[s.setType] || String(workingIndex)}
            prev={previous[i]}
            above={sets
              .slice(0, i)
              .reverse()
              .find((p) => p.completed === 1 && (p.setType === 'warmup') === (s.setType === 'warmup'))}
            exercise={exercise}
            unit={unit}
            restSec={restSec}
          />
        )
      })}

      <button className="btn sm ghost block" style={{ marginTop: 6, color: 'var(--brand-hi)' }} onClick={() => addSet(workoutId, exercise.id)}>
        <Plus size={16} /> Add set
      </button>
    </div>
  )
}

function SetRow({ set, label, prev: prevSession, above, exercise, unit, restSec }: {
  set: WorkoutSet
  label: string
  prev?: WorkoutSet
  above?: WorkoutSet
  exercise: Exercise
  unit: Unit
  restSec: number
}) {
  const toast = useToast()
  const [weight, setWeight] = useState(set.weightKg != null ? String(toDisplayWeight(set.weightKg, unit)) : '')
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '')
  const [dur, setDur] = useState(set.durationSec != null ? formatDuration(set.durationSec) : '')
  const [flash, setFlash] = useState(false)
  const done = set.completed === 1
  const isDuration = exercise.trackingType === 'duration'
  const hasPR = (set.prs?.length ?? 0) > 0
  // Pre-fill from last session's matching set, else from the set above in this workout
  const prev = prevSession ?? above

  const toggle = async () => {
    if (done) {
      await uncompleteSet(set.id!)
      return
    }
    const w = parseNum(weight) ?? prev?.weightKg ?? null
    const wKg = parseNum(weight) !== null ? fromDisplayWeight(parseNum(weight)!, unit) : w
    const r = parseNum(reps) ?? prev?.reps ?? null
    const d = parseDuration(dur) ?? prev?.durationSec ?? null

    if (isDuration ? !d : !r) {
      toast({ title: isDuration ? 'Enter a time first' : 'Enter your reps first' }, 2000)
      return
    }
    if (exercise.trackingType === 'weight_reps' && wKg == null) {
      toast({ title: `Enter the weight (${unit}) first` }, 2000)
      return
    }
    const values = {
      weightKg: isDuration ? null : (wKg ?? 0),
      reps: isDuration ? null : Math.round(r!),
      durationSec: isDuration ? Math.round(d!) : null,
    }
    // Show the values actually used (pre-filled ones become real)
    if (!isDuration) {
      setWeight(values.weightKg ? String(toDisplayWeight(values.weightKg, unit)) : '')
      setReps(String(values.reps))
    } else setDur(formatDuration(values.durationSec!))

    const prs = await completeSet(set.id!, values, exercise, set.setType === 'warmup' ? Math.min(60, restSec) : restSec)
    if (prs.length) {
      setFlash(true)
      setTimeout(() => setFlash(false), 1500)
      celebratePR()
      const e1rm = values.weightKg && values.reps ? estimate1RM(values.weightKg, values.reps) : null
      toast(
        {
          kind: 'pr',
          title: `New PR · ${exercise.name}`,
          body:
            prs.map((p) => RECORD_LABELS[p]).join(' · ') +
            (prs.includes('e1rm') && e1rm ? ` · est. 1RM ${toDisplayWeight(e1rm, unit)} ${unit}` : ''),
        },
        4500,
      )
    }
  }

  const onWeight = (v: string) => {
    setWeight(v)
    const n = parseNum(v)
    void updateSet(set.id!, { weightKg: n === null ? null : fromDisplayWeight(n, unit) })
  }
  const onReps = (v: string) => {
    setReps(v)
    const n = parseNum(v)
    void updateSet(set.id!, { reps: n === null ? null : Math.round(n) })
  }
  const onDur = (v: string) => {
    setDur(v)
    void updateSet(set.id!, { durationSec: parseDuration(v) })
  }

  const placeholderW = prev?.weightKg ? String(toDisplayWeight(prev.weightKg, unit)) : exercise.trackingType === 'bodyweight' ? '0' : unit
  const placeholderR = prev?.reps ? String(prev.reps) : '0'

  return (
    <div className={`set-grid set-row ${done ? 'done' : ''} ${done && hasPR ? 'pr' : ''} ${flash ? 'flash' : ''} ${isDuration ? 'duration' : ''}`}>
      <button
        className={`set-type ${set.setType}`}
        onClick={() => updateSet(set.id!, { setType: NEXT_TYPE[set.setType] })}
        onContextMenu={(e) => {
          e.preventDefault()
          if (confirm('Delete this set?')) void deleteSet(set.id!)
        }}
        aria-label={`Set ${label}, type ${set.setType}. Tap to change type, long-press to delete.`}
      >
        {label}
      </button>
      <span className="prev">
        {done && hasPR ? <RecordIcons types={set.prs!} /> : prevLabel(prevSession, exercise, unit)}
      </span>
      {isDuration ? (
        <input className="set-input" inputMode="numeric" placeholder={prev?.durationSec ? formatDuration(prev.durationSec) : '0:30'} value={dur} onChange={(e) => onDur(e.target.value)} disabled={done} aria-label="Time" />
      ) : (
        <>
          <input className="set-input" inputMode="decimal" placeholder={placeholderW} value={weight} onChange={(e) => onWeight(e.target.value)} disabled={done} aria-label="Weight" />
          <input className="set-input" inputMode="numeric" placeholder={placeholderR} value={reps} onChange={(e) => onReps(e.target.value)} disabled={done} aria-label="Reps" />
        </>
      )}
      <button className={`check ${done ? 'on' : ''}`} onClick={toggle} aria-label={done ? 'Mark set not done' : 'Complete set'}><Check size={18} strokeWidth={2.6} /></button>
    </div>
  )
}
