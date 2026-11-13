import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeStats } from '../db/workouts'
import { useSettings } from '../hooks'
import { FAMILIES, TIERS, achievementId, progressToNext } from '../lib/achievements'
import { formatDate } from '../lib/format'
import { Badge } from '../components/Badge'

export function AwardsPage() {
  const settings = useSettings()
  const stats = useLiveQuery(() => computeStats(), [settings.weeklyGoal])
  const unlocked = useLiveQuery(async () => new Map((await db.achievements.toArray()).map((a) => [a.id, a])), [], new Map())
  if (!stats) return null

  const total = FAMILIES.reduce((n, f) => n + f.levels.length, 0)

  return (
    <div className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Awards</h1>
        <span className="tag pr">🏅 {unlocked.size} / {total}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Badges level up from {TIERS[0]} to {TIERS[TIERS.length - 1]}. Once earned, they're yours forever.
      </p>

      {FAMILIES.map((f) => {
        const value = stats[f.id]
        const { next, pct } = progressToNext(f, value)
        return (
          <div key={f.id} className="card stack" style={{ gap: 12 }}>
            <div className="row between">
              <div>
                <h2>{f.name}</h2>
                <div className="small muted">{f.description}: <b className="num">{f.format(value)}</b></div>
              </div>
            </div>
            {next && (
              <div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Next: {next.emoji} {next.title} at {f.format(next.threshold)}</div>
              </div>
            )}
            <div className="badge-grid">
              {f.levels.map((l, i) => {
                const a = unlocked.get(achievementId(f.id, i))
                return (
                  <div key={i} className="badge-cell">
                    <Badge family={f} level={i} locked={!a} />
                    <div>{l.title}</div>
                    <div className="muted" style={{ fontWeight: 500 }}>{a ? formatDate(a.unlockedAt, { day: 'numeric', month: 'short', year: '2-digit' }) : f.format(l.threshold)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
