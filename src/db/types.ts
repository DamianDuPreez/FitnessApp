/** Fields used by cloud sync. Set automatically by the database hooks (see sync/localHooks.ts). */
export interface Syncable {
  /** Stable id shared across devices (workouts and sets; other tables use their own string id). */
  uid?: string
  /** Last local edit time, used to resolve conflicts (last write wins). */
  updatedAt?: number
  /** 1 = changed locally and not yet uploaded. */
  dirty?: 0 | 1
}

export type TrackingType = 'weight_reps' | 'bodyweight' | 'duration'
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'
export type Unit = 'kg' | 'lb'

export interface Exercise extends Syncable {
  id: string
  name: string
  category: string
  equipment: string
  level?: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  trackingType: TrackingType
  popular: boolean
  isCustom?: boolean
}

export interface WorkoutExercise {
  exerciseId: string
  note?: string
}

export interface Workout extends Syncable {
  id?: number
  name: string
  startedAt: number
  /** null while the workout is in progress */
  endedAt: number | null
  notes?: string
  exercises: WorkoutExercise[]
  /** Timestamp the current rest timer ends at (survives app reloads / screen lock). */
  restEndsAt?: number | null
  restTotalSec?: number
}

export interface WorkoutSet extends Syncable {
  id?: number
  workoutId: number
  exerciseId: string
  order: number
  setType: SetType
  weightKg: number | null
  reps: number | null
  durationSec: number | null
  completed: 0 | 1
  completedAt: number | null
  /** PR types achieved by this set when it was completed (for medals). */
  prs?: RecordType[]
}

export type RecordType = 'e1rm' | 'weight' | 'reps' | 'volume' | 'duration'

export interface Achievement extends Syncable {
  /** e.g. "workouts:3" = family "workouts", level index 3 */
  id: string
  family: string
  level: number
  unlockedAt: number
  /** whether the user has seen the celebration yet */
  seen: 0 | 1
}

export interface Settings extends Syncable {
  id: 'app'
  unit: Unit
  weeklyGoal: number
  defaultRestSec: number
  bodyweightKg: number | null
  barWeightKg: number
}

/** A record deleted locally that still has to be deleted in the cloud. */
export interface Tombstone {
  id?: number
  collection: SyncCollection
  key: string
}

export type SyncCollection = 'workouts' | 'sets' | 'exercises' | 'achievements' | 'settings'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  unit: 'kg',
  weeklyGoal: 3,
  defaultRestSec: 90,
  bodyweightKg: null,
  barWeightKg: 20,
}
