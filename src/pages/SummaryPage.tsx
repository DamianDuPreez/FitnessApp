import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useExerciseMap, useSettings } from '../hooks'
import { FAMILIES, TIERS } from '../lib/achievements'
import { celebrateBig } from '../lib/celebrate'
import { RECORD_EMOJI, RECORD_LABELS } from '../lib/records'
import { summarize } from '../lib/summary'
import { formatDuration, formatVolume, formatWeight } from '../lib/units'
import { Badge } from '../components/Badge'
import type { Achievement } from '../db/types'

export function SummaryPage() {
  const id = Number(useParams().id)
  const settings = useSettings()
  const exMap = useExerciseMap()
  const workout = useLiveQuery(() => db.workouts.get(id), [id])
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(id).toArray(), [id], [])
  // Achievements not yet celebrated. Captured once, then marked as seen.
  const [unseen, setUnseen] = useState<Achievement[] | undefined>(undefined)
  const loadedUnseen = useRef(false)
  useEffect(() => {
    if (loadedUnseen.current) return // StrictMode runs effects twice; only read + mark once
    loadedUnseen.current = true
    void (async () => {
      const list = await db.achievements.where('seen').equals(0).toArray()
      if (list.length) await db.achievements.bulkUpdate(list.map((a) => ({ key: a.id, changes: { seen: 1 as const } })))
      setUnseen(list)
    })()
  }, [])

  const summary = summarize(sets, exMap)
  const celebrated = useRef(false)
  useEffect(() => {
    if (celebrated.current || !workout || unseen === undefined) return
    celebrated.current = true
    if (summary.prs.length || unseen.length) setTimeout(celebrateBig, 300)
  }, [workout, unseen, summary.prs.length])

  if (!workout) return null
  const duration = ((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 1000
  const prCount = summary.prs.length // sets with at least one record (matches History)

  return (
    <div className="stack">
      <div className="hero">
        <div className="big-emoji">{unseen?.length ? '🏅' : prCount ? '🏆' : '✅'}</div>
        <h1 style={{ marginTop: 12 }}>{prCount ? 'New records!' : 'Workout complete!'}</h1>
        <p className="muted">{workout.name}</p>
      </div>

      <div className="tiles">
        <div className="tile"><div className="value">{formatDuration(duration)}</div><div className="label">Duration</div></div>
        <div className="tile"><div className="value">{formatVolume(summary.volumeKg, settings.unit)}</div><div className="label">Volume</div></div>
        <div className="tile"><div className="value">{summary.setCount}</div><div className="label">Sets</div></div>
        <div className="tile"><div className="value">{prCount}</div><div className="label">PRs</div></div>
      </div>

      {unseen && unseen.length > 0 && (
        <div className="section stack">
          <h2>🎉 Achievement{unseen.length > 1 ? 's' : ''} unlocked</h2>
          {unseen.map((a, i) => {
            const family = FAMILIES.find((f) => f.id === a.family)
            if (!family) return null
            const l = family.levels[a.level]
            return (
              <div key={a.id} className="unlock-card" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
                <Badge family={family} level={a.level} />
                <div>
                  <div style={{ fontWeight: 800 }}>{l.title}</div>
                  <div className="small muted">
                    {family.name} · {TIERS[Math.min(a.level, TIERS.length - 1)]} · {family.description}: {family.format(l.threshold)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {summary.prs.length > 0 && (
        <div className="section">
          <h2>Personal records</h2>
          <div className="list">
            {summary.prs.map(({ exercise, set, types }) => (
              <div key={set.id} className="card tight row">
                <span style={{ fontSize: '1.6rem' }}>{RECORD_EMOJI[types[0]]}</span>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{exercise?.name}</div>
                  <div className="small muted">
                    {set.durationSec ? formatDuration(set.durationSec) : `${set.weightKg ? formatWeight(set.weightKg, settings.unit) : 'BW'} × ${set.reps}`}
                    {' · '}
                    {types.map((t) => RECORD_LABELS[t]).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section stack">
        <Link to="/" className="btn primary block big">Done</Link>
        <Link to={`/history/${id}`} className="btn block">View workout details</Link>
      </div>
    </div>
  )
}
