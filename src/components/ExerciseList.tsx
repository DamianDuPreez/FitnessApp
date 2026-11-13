import { useMemo, useState } from 'react'
import type { Exercise } from '../db/types'
import { useExerciseMap } from '../hooks'
import { titleCase } from '../lib/format'

export const MUSCLE_GROUPS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['abdominals'],
}

const TRACKING_LABEL: Record<Exercise['trackingType'], string> = {
  weight_reps: 'weight',
  bodyweight: 'bodyweight',
  duration: 'time',
}

export function ExerciseList({
  onPick,
  selected,
  autoFocus,
}: {
  onPick: (e: Exercise) => void
  selected?: Set<string>
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const exMap = useExerciseMap()
  const exercises = useMemo(() => [...exMap.values()].sort((a, b) => a.name.localeCompare(b.name)), [exMap])

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter((e) => {
      if (group && !e.primaryMuscles.some((m) => MUSCLE_GROUPS[group].includes(m))) return false
      const hay = `${e.name} ${e.equipment} ${e.primaryMuscles.join(' ')}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [exercises, query, group])

  const searching = query.trim().length > 0 || group !== null
  const custom = filtered.filter((e) => e.isCustom)
  const popular = filtered.filter((e) => e.popular && !e.isCustom)
  const rest = filtered.filter((e) => !e.popular && !e.isCustom)

  const item = (e: Exercise) => (
    <button key={e.id} className={`pick-item ${selected?.has(e.id) ? 'selected' : ''}`} onClick={() => onPick(e)}>
      <div className="grow">
        <div style={{ fontWeight: 700 }} className="ellipsis">{e.name}</div>
        <div className="tiny muted">
          {titleCase(e.primaryMuscles.join(', ') || 'full body')} · {titleCase(e.equipment)} · {TRACKING_LABEL[e.trackingType]}
        </div>
      </div>
      {selected?.has(e.id) && <span style={{ color: 'var(--accent)', fontWeight: 900 }}>✓</span>}
    </button>
  )

  return (
    <div className="stack" style={{ gap: 10 }}>
      <input
        className="input"
        type="search"
        placeholder="Search 750+ exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="chips">
        <button className={`chip ${group === null ? 'on' : ''}`} onClick={() => setGroup(null)}>All</button>
        {Object.keys(MUSCLE_GROUPS).map((g) => (
          <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>
            {g}
          </button>
        ))}
      </div>
      <div>
        {custom.length > 0 && (
          <>
            <div className="tiny muted" style={{ fontWeight: 800, marginTop: 6 }}>YOUR EXERCISES</div>
            {custom.map(item)}
          </>
        )}
        {popular.length > 0 && (
          <>
            <div className="tiny muted" style={{ fontWeight: 800, marginTop: 6 }}>POPULAR</div>
            {popular.map(item)}
          </>
        )}
        {rest.length > 0 && (
          <>
            <div className="tiny muted" style={{ fontWeight: 800, marginTop: 10 }}>{searching ? 'MORE RESULTS' : 'ALL EXERCISES'}</div>
            {rest.map(item)}
          </>
        )}
        {filtered.length === 0 && <div className="empty">No exercises match “{query}”.</div>}
      </div>
    </div>
  )
}
