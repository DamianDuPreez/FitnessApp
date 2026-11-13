import { useEffect, useRef } from 'react'
import type { Workout } from '../db/types'
import { setRestTimer } from '../db/workouts'
import { useNow } from '../hooks'
import { formatDuration } from '../lib/units'
import { buzz } from '../lib/celebrate'
import { useToast } from './Toasts'

/** Rest timer driven by an end timestamp, so it stays correct if the phone locks or the app reloads. */
export function RestTimer({ workout }: { workout: Workout }) {
  const now = useNow(250)
  const toast = useToast()
  const notified = useRef<number | null>(null)
  const endsAt = workout.restEndsAt ?? 0
  const total = workout.restTotalSec ?? 90
  const remaining = Math.ceil((endsAt - now) / 1000)

  useEffect(() => {
    if (endsAt && remaining <= 0 && notified.current !== endsAt) {
      notified.current = endsAt
      buzz([200, 100, 200])
      toast({ title: '⏰ Rest over', body: 'Time for your next set!' }, 2500)
      void setRestTimer(workout.id!, null)
    }
  }, [remaining, endsAt, toast, workout.id])

  if (!endsAt || remaining <= 0) return null

  const adjust = (delta: number) => {
    const next = endsAt + delta * 1000
    if (next <= Date.now()) void setRestTimer(workout.id!, null)
    else void setRestTimer(workout.id!, next, Math.max(1, total + delta))
  }

  return (
    <div className="rest-bar" role="timer" aria-label="Rest timer">
      <div className="row between">
        <div>
          <div className="tiny muted" style={{ fontWeight: 700 }}>REST</div>
          <div className="rest-time">{formatDuration(remaining)}</div>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => adjust(-15)}>−15</button>
          <button className="btn sm" onClick={() => adjust(15)}>+15</button>
          <button className="btn sm primary" onClick={() => setRestTimer(workout.id!, null)}>Skip</button>
        </div>
      </div>
      <div className="progress" style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }} />
    </div>
  )
}
