import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useExerciseMap, useSettings } from '../hooks'
import { FAMILIES, TIERS } from '../lib/achievements'
import { celebrateBig } from '../lib/celebrate'
import { RECORD_LABELS } from '../lib/records'
import { Award, Check, Clock, Layers, ListChecks, Trophy } from 'lucide-react'
import { RECORD_ICONS } from '../components/Icons'
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
        <div className={`hero-mark ${prCount || unseen?.length ? 'gold' : ''}`}>
          {unseen?.length ? <Award size={46} strokeWidth={1.8} /> : prCount ? <Trophy size={46} strokeWidth={1.8} /> : <Check size={50} strokeWidth={2.4} />}
        </div>
        <div className="eyebrow" style={{ marginTop: 22 }}>{prCount ? 'New records' : 'Workout complete'}</div>
        <h1 style={{ marginTop: 4 }}>{prCount ? `${prCount} personal record${prCount > 1 ? 's' : ''}` : 'Nice work'}</h1>
        <p className="muted">{workout.name}</p>
      </div>

      <div className="tiles">
        <div className="tile"><div className="label"><Clock size={14} /> Duration</div><div className="value">{formatDuration(duration)}</div></div>
        <div className="tile"><div className="label"><Layers size={14} /> Volume</div><div className="value">{formatVolume(summary.volumeKg, settings.unit)}</div></div>
        <div className="tile"><div className="label"><ListChecks size={14} /> Sets</div><div className="value">{summary.setCount}</div></div>
        <div className="tile"><div className="label"><Trophy size={14} /> PRs</div><div className="value">{prCount}</div></div>
      </div>

      {unseen && unseen.length > 0 && (
        <div className="section stack">
          <h2>Achievement{unseen.length > 1 ? 's' : ''} unlocked</h2>
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
            {summary.prs.map(({ exercise, set, types }) => {
              const Icon = RECORD_ICONS[types[0]]
              return (
              <div key={set.id} className="card tight row">
                <span className="icon-chip gold"><Icon size={18} /></span>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{exercise?.name}</div>
                  <div className="small muted">
                    {set.durationSec ? formatDuration(set.durationSec) : `${set.weightKg ? formatWeight(set.weightKg, settings.unit) : 'BW'} × ${set.reps}`}
                    {' · '}
                    {types.map((t) => RECORD_LABELS[t]).join(', ')}
                  </div>
                </div>
              </div>
              )
            })}
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
