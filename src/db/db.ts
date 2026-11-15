import Dexie, { type EntityTable } from 'dexie'
import type { Achievement, Exercise, Settings, Tombstone, Workout, WorkoutSet } from './types'
import { installSyncHooks } from '../sync/localHooks'
import { DEFAULT_SETTINGS } from './types'

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  achievements!: EntityTable<Achievement, 'id'>
  settings!: EntityTable<Settings, 'id'>
  tombstones!: EntityTable<Tombstone, 'id'>

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
    // v2: cloud sync. Cross-device ids, dirty flags and a queue of deletions to upload.
    this.version(2)
      .stores({
        exercises: 'id, name, popular, trackingType, dirty',
        workouts: '++id, startedAt, endedAt, &uid, dirty',
        sets: '++id, workoutId, exerciseId, [exerciseId+completed], completedAt, &uid, dirty',
        achievements: 'id, family, seen, dirty',
        settings: 'id',
        tombstones: '++id',
      })
      .upgrade(async (tx) => {
        const now = Date.now()
        const mark = (r: { uid?: string; updatedAt?: number; dirty?: 0 | 1 }, withUid: boolean) => {
          if (withUid && !r.uid) r.uid = crypto.randomUUID()
          r.updatedAt = now
          r.dirty = 1
        }
        await tx.table('workouts').toCollection().modify((r) => mark(r, true))
        await tx.table('sets').toCollection().modify((r) => mark(r, true))
        await tx.table('exercises').filter((e) => !!e.isCustom).modify((r) => mark(r, false))
        await tx.table('achievements').toCollection().modify((r) => mark(r, false))
        await tx.table('settings').toCollection().modify((r) => mark(r, false))
      })
    installSyncHooks(this)
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
