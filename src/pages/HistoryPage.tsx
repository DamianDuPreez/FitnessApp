import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteWorkout } from '../db/workouts'
import type { Workout, WorkoutSet } from '../db/types'
import { useExerciseMap, useSettings } from '../hooks'
import { formatDate, formatTime } from '../lib/format'
import { RECORD_LABELS } from '../lib/records'
import { BookOpen, ChevronLeft, Clock, Layers, Trash2, Trophy } from 'lucide-react'
import { RecordIcons } from '../components/Icons'
import { summarize } from '../lib/summary'
import { formatDuration, formatVolume, formatWeight } from '../lib/units'

export function useWorkoutSummary(workoutId: number | undefined) {
  const exMap = useExerciseMap()
  const sets = useLiveQuery(
    () => (workoutId ? db.sets.where('workoutId').equals(workoutId).sortBy('order') : Promise.resolve([] as WorkoutSet[])),
    [workoutId],
    [] as WorkoutSet[],
  )
  return { sets, exMap, summary: summarize(sets, exMap) }
}

export function WorkoutListItem({ workout }: { workout: Workout }) {
  const settings = useSettings()
  const { summary, exMap } = useWorkoutSummary(workout.id)
  const duration = ((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 1000
  const prCount = summary.prs.length
  return (
    <Link to={`/history/${workout.id}`} className="card card-link">
      <div className="row between">
        <div style={{ fontWeight: 700 }} className="ellipsis grow">{workout.name}</div>
        {prCount > 0 && <span className="tag pr"><Trophy size={12} /> {prCount} PR{prCount > 1 ? 's' : ''}</span>}
      </div>
      <div className="meta">
        <span>{formatDate(workout.startedAt)}</span>
        <span><Clock size={13} /> {formatDuration(duration)}</span>
        <span><Layers size={13} /> {formatVolume(summary.volumeKg, settings.unit)}</span>
      </div>
      <div className="small" style={{ marginTop: 8, color: 'var(--text-2)' }}>
        {workout.exercises.slice(0, 4).map((e) => exMap.get(e.exerciseId)?.name).filter(Boolean).join(' · ')}
        {workout.exercises.length > 4 && <span className="muted"> +{workout.exercises.length - 4} more</span>}
      </div>
    </Link>
  )
}

export function HistoryPage() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().filter((w) => w.endedAt !== null).toArray(), [], undefined)
  if (!workouts) return null

  const groups = new Map<string, Workout[]>()
  for (const w of workouts) {
    const key = formatDate(w.startedAt, { month: 'long', year: 'numeric' })
    groups.set(key, [...(groups.get(key) ?? []), w])
  }

  return (
    <div>
      <div className="page-header"><h1>History</h1></div>
      {workouts.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><BookOpen size={26} /></div>
          <p>Your finished workouts will show up here.</p>
        </div>
      )}
      {[...groups].map(([month, list]) => (
        <div key={month} className="section" style={{ marginTop: 16 }}>
          <div className="list-label">{month} · {list.length} workout{list.length > 1 ? 's' : ''}</div>
          <div className="list">{list.map((w) => <WorkoutListItem key={w.id} workout={w} />)}</div>
        </div>
      ))}
    </div>
  )
}

export function WorkoutDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const settings = useSettings()
  const workout = useLiveQuery(() => db.workouts.get(id), [id])
  const { sets, exMap, summary } = useWorkoutSummary(id)
  if (!workout) return null

  const duration = ((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 1000

  return (
    <div className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft size={22} /></button>
        <div className="grow">
          <h1 className="ellipsis">{workout.name}</h1>
          <div className="small muted">{formatDate(workout.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {formatTime(workout.startedAt)}</div>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="label"><Clock size={14} /> Duration</div><div className="value">{formatDuration(duration)}</div></div>
        <div className="tile"><div className="label"><Layers size={14} /> Volume</div><div className="value">{formatVolume(summary.volumeKg, settings.unit)}</div></div>
      </div>

      {workout.exercises.map((we) => {
        const ex = exMap.get(we.exerciseId)
        const exSets = sets.filter((s) => s.exerciseId === we.exerciseId)
        let n = 0
        return (
          <div key={we.exerciseId} className="card">
            <Link to={`/exercises/${encodeURIComponent(we.exerciseId)}`} style={{ fontWeight: 700, color: 'var(--brand-hi)' }}>{ex?.name ?? 'Unknown exercise'}</Link>
            <div style={{ marginTop: 8 }}>
              {exSets.map((s) => {
                if (s.setType !== 'warmup') n++
                const label = s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : s.setType === 'failure' ? 'F' : String(n)
                return (
                  <div key={s.id} className="row small" style={{ padding: '4px 0' }}>
                    <span className="tag" style={{ minWidth: 28, textAlign: 'center' }}>{label}</span>
                    <span className="grow num">
                      {s.durationSec != null
                        ? formatDuration(s.durationSec)
                        : `${s.weightKg ? formatWeight(s.weightKg, settings.unit) : 'BW'} × ${s.reps}`}
                    </span>
                    {s.prs?.length ? (
                      <span className="tag pr" title={s.prs.map((p) => RECORD_LABELS[p]).join(', ')}>
                        <RecordIcons types={s.prs} size={12} /> PR
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        className="btn danger block"
        onClick={async () => {
          if (confirm('Delete this workout permanently? PRs will be recalculated.')) {
            await deleteWorkout(id)
            navigate('/history', { replace: true })
          }
        }}
      >
        <Trash2 size={16} /> Delete workout
      </button>
    </div>
  )
}
