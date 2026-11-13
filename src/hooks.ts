import { createContext, useContext, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from './db/db'
import { DEFAULT_SETTINGS, type Exercise, type Settings } from './db/types'
import { getActiveWorkout } from './db/workouts'

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
}

export function useActiveWorkout() {
  // undefined = still loading, null = no active workout
  return useLiveQuery(async () => (await getActiveWorkout()) ?? null, [])
}

/** Load all exercises once at the app root; pages read them via useExerciseMap(). */
export function useLoadExerciseMap(): Map<string, Exercise> {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), [], EMPTY_MAP)
}

const EMPTY_MAP = new Map<string, Exercise>()
export const ExerciseMapContext = createContext<Map<string, Exercise>>(EMPTY_MAP)

export function useExerciseMap(): Map<string, Exercise> {
  return useContext(ExerciseMapContext)
}

/** Re-render every `ms` milliseconds (for clocks/timers). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Keep the screen awake while mounted (where supported). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        /* denied or unsupported */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [enabled])
}
