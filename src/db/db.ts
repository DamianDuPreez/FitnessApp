import Dexie, { type EntityTable } from 'dexie'
import type { Achievement, Exercise, Settings, Workout, WorkoutSet } from './types'
import { DEFAULT_SETTINGS } from './types'

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  achievements!: EntityTable<Achievement, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = 'fitness-app') {
    super(name)
    // Schema changes must be additive: add a new version() block, never edit an old one.
    this.version(1).stores({
      exercises: 'id, name, popular, trackingType',
      workouts: '++id, startedAt, endedAt',
      sets: '++id, workoutId, exerciseId, [exerciseId+completed], completedAt',
      achievements: 'id, family, seen',
      settings: 'id',
    })
  }
}

export const db = new FitnessDB()

/** Load the bundled exercise library on first run (or when new built-in exercises ship). */
export async function seedExercises(database: FitnessDB = db): Promise<void> {
  const builtInCount = await database.exercises.filter((e) => !e.isCustom).count()
  const { default: data } = await import('../data/exercises.json')
  if (builtInCount >= data.length) return
  await database.exercises.bulkPut(data as Exercise[])
}

export async function getSettings(database: FitnessDB = db): Promise<Settings> {
  return (await database.settings.get('app')) ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Settings>, database: FitnessDB = db) {
  const current = await getSettings(database)
  await database.settings.put({ ...current, ...patch, id: 'app' })
}

/** Ask the browser not to evict our data (important on iOS Safari). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
