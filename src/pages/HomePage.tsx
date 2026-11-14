import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeStats, startWorkout } from '../db/workouts'
import type { Unit, WorkoutSet } from '../db/types'
import { useActiveWorkout, useExerciseMap, useSettings } from '../hooks'
import { FAMILIES, progressToNext } from '../lib/achievements'
import { formatDate, greeting, isIOS, isStandalone, relativeDay } from '../lib/format'
import { RECORD_LABELS, estimate1RM } from '../lib/records'
import { formatDuration, toDisplayWeight } from '../lib/units'
import { weeklyStreak } from '../lib/weeks'
import { WorkoutListItem } from './HistoryPage'
import { AppMark } from '../components/Icons'
import { ArrowRight, Flag, Share, X } from 'lucide-react'

function isoWeek(d = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** The value a PR set is "worth", for its headline record type. */
function recordFigure(s: WorkoutSet, unit: Unit): { value: string; unit: string } {
  const type = s.prs![0]
  const w = s.weightKg ?? 0
  const r = s.reps ?? 0
  if (type === 'duration') return { value: formatDuration(s.durationSec ?? 0), unit: '' }
  if (type === 'reps') return { value: String(r), unit: 'REPS' }
  const kg = type === 'e1rm' ? (estimate1RM(w, r) ?? w) : type === 'volume' ? w * r : w
  return { value: String(toDisplayWeight(kg, unit)), unit: unit.toUpperCase() }
}

/** Latest record per exercise, newest first. */
function useRecentRecords(limit: number) {
  return useLiveQuery(
    async () => {
      const sets = await db.sets.orderBy('completedAt').reverse().filter((s) => s.completed === 1 && !!s.prs?.length).limit(60).toArray()
      const seen = new Set<string>()
      const out: WorkoutSet[] = []
      for (const s of sets) {
        if (seen.has(s.exerciseId)) continue
        const w = await db.workouts.get(s.workoutId)
        if (!w?.endedAt) continue
        seen.add(s.exerciseId)
        out.push(s)
        if (out.length >= limit) break
      }
      return out
    },
    [limit],
    [] as WorkoutSet[],
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const [hideInstall, setHideInstall] = useState(() => {
    try {
      return localStorage.getItem('hide-install-hint') === '1'
    } catch {
      return false
    }
  })
  const finished = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().filter((w) => w.endedAt !== null).toArray(), [], [])
  const stats = useLiveQuery(() => computeStats(), [settings.weeklyGoal])
  const records = useRecentRecords(3)
  const streak = weeklyStreak(finished.map((w) => w.startedAt), settings.weeklyGoal)

  const start = async () => {
    await startWorkout()
    navigate('/workout')
  }

  // Closest next achievement to motivate
  const nextGoal = stats
    ? FAMILIES.map((f) => ({ f, ...progressToNext(f, stats[f.id]), value: stats[f.id] }))
        .filter((x) => x.next)
        .sort((a, b) => b.pct - a.pct)[0]
    : undefined

  const goal = settings.weeklyGoal
  const done = streak.thisWeekCount
  const left = Math.max(0, goal - done)
  const now = new Date()

  return (
    <div>
      <div className="app-bar">
        <div className="wordmark">
          <AppMark size={26} />
          <div className="wordmark-text">Fitness<span>App</span></div>
        </div>
        <div className="date">{formatDate(now.getTime(), { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      </div>

      {!hideInstall && isIOS() && !isStandalone() && (
        <div className="banner small" style={{ marginBottom: 24 }}>
          <Share size={18} />
          <div className="grow">
            <b>Install this app:</b> tap <b>Share</b>, then <b>Add to Home Screen</b>. This keeps your workouts safe. Safari may delete data from sites that aren't installed.
          </div>
          <button
            className="icon-btn"
            aria-label="Dismiss"
            style={{ width: 32, height: 32 }}
            onClick={() => {
              setHideInstall(true)
              try {
                localStorage.setItem('hide-install-hint', '1')
              } catch {
                /* ignore */
              }
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="eyebrow">{greeting()} · Week {isoWeek(now)}</div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 14 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 4 }}>
          <span className="figure" style={{ fontWeight: 900, fontSize: '7rem', lineHeight: 0.8 }}>{done}</span>
          <span className="figure muted" style={{ fontWeight: 500, fontSize: '2.4rem' }}>/{goal}</span>
        </div>
        <div style={{ textAlign: 'right', paddingBottom: 4 }}>
          <div className="figure" style={{ fontSize: '2rem', lineHeight: 1 }}>{streak.current}</div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Week streak</div>
        </div>
      </div>
      <div className="segments" style={{ marginTop: 18 }}>
        {Array.from({ length: goal }, (_, i) => <span key={i} className={i < done ? 'on' : ''} />)}
      </div>
      <p className="text-2" style={{ margin: '14px 0 26px', fontSize: '0.92rem' }}>
        {left === 0
          ? 'Weekly goal hit. Anything more is a bonus.'
          : `${left === 1 ? 'One session' : `${left} sessions`} left to hit this week's goal.`}
        {streak.best > streak.current && <span className="muted"> Best streak: {streak.best} weeks.</span>}
      </p>

      {active ? (
        <Link to="/workout" className="btn primary block big">Resume session <ArrowRight size={20} strokeWidth={1.6} /></Link>
      ) : (
        <button className="btn primary block big" onClick={start}>Start session <ArrowRight size={20} strokeWidth={1.6} /></button>
      )}

      {records.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>Recent records</h2>
            <Link to="/exercises" className="link">All lifts</Link>
          </div>
          <div className="rules">
            {records.map((s) => {
              const fig = recordFigure(s, settings.unit)
              return (
                <Link key={s.id} to={`/exercises/${encodeURIComponent(s.exerciseId)}`} className="rule-row">
                  <div className="grow">
                    <div className="title ellipsis">{exMap.get(s.exerciseId)?.name ?? 'Exercise'}</div>
                    <div className="sub">{RECORD_LABELS[s.prs![0]]} · {formatDate(s.completedAt ?? 0, { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div><span className="figure gold">{fig.value}</span>{fig.unit && <span className="unit">{fig.unit}</span>}</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {nextGoal?.next && (
        <Link to="/awards" className="section" style={{ display: 'block' }}>
          <div className="section-head">
            <h2>Next milestone</h2>
            <span className="small muted num">{nextGoal.f.format(nextGoal.value)} / {nextGoal.f.format(nextGoal.next.threshold)}</span>
          </div>
          <div className="display" style={{ fontSize: '1.1rem', letterSpacing: '0.03em', marginBottom: 12 }}>{nextGoal.next.title}</div>
          <div className="line-bar"><div style={{ width: `${nextGoal.pct}%` }} /></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>{nextGoal.f.name} · {nextGoal.f.description}</div>
        </Link>
      )}

      <div className="section">
        <div className="section-head">
          <h2>Recent sessions</h2>
          {finished.length > 0 && <Link to="/history" className="link">View all</Link>}
        </div>
        {finished.length === 0 ? (
          <div className="empty" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="empty-icon"><Flag size={22} strokeWidth={1.5} /></div>
            <p style={{ margin: 0 }}>No sessions yet. Your first one unlocks your first badge.</p>
          </div>
        ) : (
          <div className="rules">
            {finished.slice(0, 3).map((w) => <WorkoutListItem key={w.id} workout={w} />)}
          </div>
        )}
        {finished[0] && <p className="tiny muted" style={{ marginTop: 12 }}>Last session: {relativeDay(finished[0].startedAt)}</p>}
      </div>
    </div>
  )
}
