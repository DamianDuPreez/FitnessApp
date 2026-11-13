import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { WorkoutSet } from '../db/types'
import { useExerciseMap, useSettings } from '../hooks'
import { ExerciseList } from '../components/ExerciseList'
import { CustomExerciseForm } from '../components/CustomExerciseForm'
import { Sheet } from '../components/Sheet'
import { formatDate, titleCase } from '../lib/format'
import { buildBests, countsForRecords, estimate1RM } from '../lib/records'
import { formatDuration, formatWeight, platesPerSide, toDisplayWeight } from '../lib/units'

export function ExercisesPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  return (
    <div>
      <div className="page-header">
        <h1>Exercises</h1>
        <button className="btn sm" onClick={() => setCreating(true)}>+ Custom</button>
      </div>
      <ExerciseList onPick={(e) => navigate(`/exercises/${encodeURIComponent(e.id)}`)} />
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <CustomExerciseForm onCreated={(e) => { setCreating(false); navigate(`/exercises/${encodeURIComponent(e.id)}`) }} />
        </Sheet>
      )}
    </div>
  )
}

function E1rmChart({ points, unit }: { points: Array<{ t: number; v: number }>; unit: 'kg' | 'lb' }) {
  if (points.length < 2) return <p className="small muted">Log this exercise a couple of times to see your progress chart.</p>
  const W = 320, H = 120, P = 8
  const minV = Math.min(...points.map((p) => p.v)), maxV = Math.max(...points.map((p) => p.v))
  const minT = points[0].t, maxT = points[points.length - 1].t
  const x = (t: number) => P + ((t - minT) / Math.max(1, maxT - minT)) * (W - 2 * P)
  const y = (v: number) => H - P - ((v - minV) / Math.max(1e-6, maxV - minV)) * (H - 2 * P)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Estimated 1RM over time">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${x(last.t)},${H} L${x(points[0].t)},${H} Z`} fill="url(#fill)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="3" fill="var(--accent)" />)}
      </svg>
      <div className="row between tiny muted">
        <span>{formatDate(minT)}</span>
        <span>{toDisplayWeight(minV, unit)}–{toDisplayWeight(maxV, unit)} {unit}</span>
        <span>{formatDate(maxT)}</span>
      </div>
    </div>
  )
}

export function ExerciseDetailPage() {
  const id = decodeURIComponent(useParams().id ?? '')
  const navigate = useNavigate()
  const settings = useSettings()
  const exercise = useExerciseMap().get(id)
  const [plateTarget, setPlateTarget] = useState('')
  const sets = useLiveQuery(() => db.sets.where('[exerciseId+completed]').equals([id, 1]).toArray(), [id], [] as WorkoutSet[])
  const workouts = useLiveQuery(() => db.workouts.filter((w) => w.endedAt !== null).toArray(), [], [])

  const { bests, sessions, points } = useMemo(() => {
    const finished = new Map(workouts.map((w) => [w.id!, w]))
    const done = sets.filter((s) => finished.has(s.workoutId))
    const bySession = new Map<number, WorkoutSet[]>()
    for (const s of done) bySession.set(s.workoutId, [...(bySession.get(s.workoutId) ?? []), s])
    const sessions = [...bySession].map(([wid, list]) => ({ workout: finished.get(wid)!, sets: list.sort((a, b) => a.order - b.order) }))
      .sort((a, b) => b.workout.startedAt - a.workout.startedAt)
    const points = sessions
      .map((s) => ({ t: s.workout.startedAt, v: Math.max(0, ...s.sets.filter(countsForRecords).map((x) => (x.setType === 'drop' ? 0 : estimate1RM(x.weightKg ?? 0, x.reps ?? 0) ?? 0))) }))
      .filter((p) => p.v > 0)
      .reverse()
    return { bests: buildBests(done), sessions, points }
  }, [sets, workouts])

  if (!exercise) return null
  const u = settings.unit
  const isDuration = exercise.trackingType === 'duration'
  const target = parseFloat(plateTarget)

  return (
    <div className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="grow">
          <h1>{exercise.name}</h1>
          <div className="small muted">{titleCase(exercise.primaryMuscles.join(', '))} · {titleCase(exercise.equipment)}</div>
        </div>
      </div>

      <div className="tiles">
        {isDuration ? (
          <div className="tile"><div className="value">{bests.duration ? formatDuration(bests.duration) : '—'}</div><div className="label">⏱️ Longest</div></div>
        ) : (
          <>
            <div className="tile"><div className="value">{bests.e1rm ? formatWeight(bests.e1rm, u) : '—'}</div><div className="label">🏆 Est. 1RM</div></div>
            <div className="tile"><div className="value">{bests.weight ? formatWeight(bests.weight, u) : '—'}</div><div className="label">🏋️ Heaviest</div></div>
            <div className="tile"><div className="value">{bests.volume ? formatWeight(bests.volume, u) : '—'}</div><div className="label">📦 Best set volume</div></div>
            <div className="tile"><div className="value">{bests.reps || '—'}</div><div className="label">🔁 Most reps</div></div>
          </>
        )}
      </div>

      {!isDuration && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Estimated 1RM progress</h3>
          <E1rmChart points={points} unit={u} />
        </div>
      )}

      {exercise.equipment === 'barbell' && (
        <div className="card stack" style={{ gap: 8 }}>
          <h3>Plate calculator</h3>
          <input className="input" inputMode="decimal" placeholder={`Target weight (${u})`} value={plateTarget} onChange={(e) => setPlateTarget(e.target.value)} />
          {target > 0 && u === 'kg' && (() => {
            const bar = settings.barWeightKg
            if (target < bar) return <div className="small muted">That's lighter than the {bar} kg bar.</div>
            const plates = platesPerSide(target, bar)
            const loaded = bar + 2 * plates.reduce((a, b) => a + b, 0)
            return (
              <div className="small">
                Per side ({bar} kg bar): <b>{plates.join(' + ') || 'just the bar'}</b>
                {Math.abs(loaded - target) > 0.01 && <div className="tiny muted">Closest possible: {loaded} kg</div>}
              </div>
            )
          })()}
          {u === 'lb' && <div className="tiny muted">Plate calculator currently supports kg plates.</div>}
        </div>
      )}

      <div className="section">
        <h2>History</h2>
        {sessions.length === 0 && <p className="small muted">You haven't logged this exercise yet.</p>}
        <div className="list">
          {sessions.slice(0, 30).map(({ workout, sets }) => (
            <div key={workout.id} className="card tight">
              <div className="small" style={{ fontWeight: 700 }}>{formatDate(workout.startedAt)}</div>
              <div className="small muted num">
                {sets.map((s) => (isDuration ? formatDuration(s.durationSec ?? 0) : `${s.weightKg ? toDisplayWeight(s.weightKg, u) : 'BW'}×${s.reps}`) + (s.prs?.length ? ' 🏆' : '')).join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {exercise.instructions.length > 0 && (
        <details className="card">
          <summary style={{ fontWeight: 700 }}>How to do it</summary>
          <ol className="small" style={{ paddingLeft: 18 }}>
            {exercise.instructions.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
          </ol>
        </details>
      )}

      {exercise.isCustom && (
        <button
          className="btn danger block"
          onClick={async () => {
            if (sets.length) return alert('This exercise has logged sets, so it can’t be deleted.')
            if (confirm(`Delete ${exercise.name}?`)) {
              await db.exercises.delete(exercise.id)
              navigate('/exercises', { replace: true })
            }
          }}
        >
          Delete custom exercise
        </button>
      )}
    </div>
  )
}
