import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeStats, startWorkout } from '../db/workouts'
import { useActiveWorkout, useSettings } from '../hooks'
import { FAMILIES, progressToNext } from '../lib/achievements'
import { greeting, isIOS, isStandalone, relativeDay } from '../lib/format'
import { formatVolume } from '../lib/units'
import { weeklyStreak } from '../lib/weeks'
import { Badge } from '../components/Badge'
import { WorkoutListItem } from './HistoryPage'
import { AppMark } from '../components/Icons'
import { ChevronRight, Flag, Flame, Play, Plus, Share, Target, X } from 'lucide-react'

export function HomePage() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  const settings = useSettings()
  const [hideInstall, setHideInstall] = useState(() => {
    try {
      return localStorage.getItem('hide-install-hint') === '1'
    } catch {
      return false
    }
  })
  const finished = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().filter((w) => w.endedAt !== null).toArray(), [], [])
  const stats = useLiveQuery(() => computeStats(), [settings.weeklyGoal])
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

  const goalPct = Math.min(1, streak.thisWeekCount / settings.weeklyGoal)
  const R = 36
  const C = 2 * Math.PI * R

  return (
    <div className="stack">
      <div className="app-bar" style={{ marginBottom: 4 }}>
        <div className="wordmark">
          <AppMark size={34} />
          <div className="wordmark-text">Fitness<span>App</span></div>
        </div>
      </div>
      <div>
        <div className="eyebrow">{greeting()}</div>
        <h1 style={{ marginTop: 4 }}>Let's train</h1>
      </div>

      {!hideInstall && isIOS() && !isStandalone() && (
        <div className="banner small">
          <Share size={18} />
          <div className="grow">
            <b>Install this app:</b> tap <b>Share</b>, then <b>Add to Home Screen</b>. This keeps your workouts safe. Safari may delete data from sites that aren't installed.
          </div>
          <button
            className="icon-btn"
            aria-label="Dismiss"
            onClick={() => {
              setHideInstall(true)
              try {
                localStorage.setItem('hide-install-hint', '1')
              } catch {
                /* ignore */
              }
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {active ? (
        <Link to="/workout" className="btn primary block big"><Play size={18} fill="currentColor" /> Resume workout</Link>
      ) : (
        <button className="btn primary block big" onClick={start}><Plus size={20} strokeWidth={2.5} /> Start workout</button>
      )}

      <div className="card row" style={{ gap: 16 }}>
        <div className="ring">
          <svg width="88" height="88" viewBox="0 0 84 84">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7d90ff" />
                <stop offset="1" stopColor="#3d4fd6" />
              </linearGradient>
            </defs>
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
            <circle
              cx="42" cy="42" r={R} fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - goalPct)} style={{ transition: 'stroke-dashoffset .6s' }}
            />
          </svg>
          <div className="label num">{streak.thisWeekCount}/{settings.weeklyGoal}</div>
        </div>
        <div className="grow">
          <div className="eyebrow">This week</div>
          <div style={{ fontWeight: 700, margin: '2px 0', gap: 6 }} className="row">
            {streak.thisWeekCount >= settings.weeklyGoal ? <><Target size={16} className="brand" /> Weekly goal hit</> : 'Keep it going'}
          </div>
          <div className="small muted">
            {streak.current > 0
              ? <span className="pill-stat"><Flame size={14} /> {streak.current} week{streak.current > 1 ? 's' : ''} in a row</span>
              : `${settings.weeklyGoal - streak.thisWeekCount} more workout${settings.weeklyGoal - streak.thisWeekCount === 1 ? '' : 's'} to hit your weekly goal`}
          </div>
          {streak.best > streak.current && <div className="tiny muted">Best streak: {streak.best} weeks</div>}
        </div>
      </div>

      {stats && stats.workoutCount > 0 && (
        <div className="tiles">
          <div className="tile"><div className="value">{stats.workoutCount}</div><div className="label">Workouts</div></div>
          <div className="tile"><div className="value">{formatVolume(stats.lifetimeVolumeKg, settings.unit)}</div><div className="label">Lifted all-time</div></div>
        </div>
      )}

      {nextGoal?.next && (
        <Link to="/awards" className="card card-link row" style={{ gap: 14 }}>
          <Badge family={nextGoal.f} level={nextGoal.f.levels.indexOf(nextGoal.next)} locked size={48} />
          <div className="grow">
            <div className="eyebrow">Next milestone</div>
            <div style={{ fontWeight: 700 }}>{nextGoal.next.title}</div>
            <div className="bar" style={{ margin: '6px 0 4px' }}><div style={{ width: `${nextGoal.pct}%` }} /></div>
            <div className="tiny muted">
              {nextGoal.f.format(nextGoal.value)} / {nextGoal.f.format(nextGoal.next.threshold)} · {nextGoal.f.description.toLowerCase()}
            </div>
          </div>
          <ChevronRight size={18} className="muted" />
        </Link>
      )}

      <div className="section">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2>Recent workouts</h2>
          {finished.length > 0 && <Link to="/history" className="small" style={{ color: 'var(--brand-hi)', fontWeight: 700 }}>See all</Link>}
        </div>
        {finished.length === 0 ? (
          <div className="empty card">
            <div className="empty-icon"><Flag size={26} /></div>
            <p>No workouts yet. Your first one unlocks your first badge.</p>
          </div>
        ) : (
          <div className="list">
            {finished.slice(0, 3).map((w) => <WorkoutListItem key={w.id} workout={w} />)}
          </div>
        )}
        {finished[0] && <p className="tiny muted center">Last workout: {relativeDay(finished[0].startedAt)}</p>}
      </div>
    </div>
  )
}
