import { db } from './db'
import type { Achievement, Exercise, RecordType, WorkoutSet, Workout } from './types'
import { buildBests, countsForRecords, detectPRs, recomputePRs } from '../lib/records'
import { achievementId, newUnlocks, type Stats, type Unlock } from '../lib/achievements'
import { weeklyStreak } from '../lib/weeks'
import { getSettings } from './db'

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter((w) => w.endedAt === null).first()
}

function defaultWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours()
  if (h < 12) return 'Morning Workout'
  if (h < 17) return 'Afternoon Workout'
  return 'Evening Workout'
}

export async function startWorkout(): Promise<number> {
  const active = await getActiveWorkout()
  if (active?.id) return active.id
  return (await db.workouts.add({
    name: defaultWorkoutName(),
    startedAt: Date.now(),
    endedAt: null,
    exercises: [],
  })) as number
}

/** Sets from the most recent *finished* workout that included this exercise. */
export async function getPreviousSets(exerciseId: string, excludeWorkoutId?: number): Promise<WorkoutSet[]> {
  const sets = await db.sets.where('[exerciseId+completed]').equals([exerciseId, 1]).toArray()
  const byWorkout = new Map<number, WorkoutSet[]>()
  for (const s of sets) {
    if (s.workoutId === excludeWorkoutId) continue
    const list = byWorkout.get(s.workoutId) ?? []
    list.push(s)
    byWorkout.set(s.workoutId, list)
  }
  let latest: WorkoutSet[] = []
  let latestTime = -1
  for (const list of byWorkout.values()) {
    const t = Math.max(...list.map((s) => s.completedAt ?? 0))
    if (t > latestTime) {
      latestTime = t
      latest = list
    }
  }
  return latest.sort((a, b) => a.order - b.order)
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: string) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId)
    if (!w) return
    if (w.exercises.some((e) => e.exerciseId === exerciseId)) {
      await addSet(workoutId, exerciseId)
      return
    }
    await db.workouts.update(workoutId, { exercises: [...w.exercises, { exerciseId }] })
    const prev = await getPreviousSets(exerciseId, workoutId)
    const count = Math.max(1, prev.length)
    for (let i = 0; i < count; i++) {
      await db.sets.add(blankSet(workoutId, exerciseId, i, prev[i]?.setType ?? 'normal'))
    }
  })
}

function blankSet(workoutId: number, exerciseId: string, order: number, setType: WorkoutSet['setType'] = 'normal'): WorkoutSet {
  return { workoutId, exerciseId, order, setType, weightKg: null, reps: null, durationSec: null, completed: 0, completedAt: null }
}

export async function addSet(workoutId: number, exerciseId: string) {
  const existing = await db.sets.where('workoutId').equals(workoutId).filter((s) => s.exerciseId === exerciseId).toArray()
  const order = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1
  await db.sets.add(blankSet(workoutId, exerciseId, order))
}

export async function removeExerciseFromWorkout(workoutId: number, exerciseId: string) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId)
    if (!w) return
    await db.workouts.update(workoutId, { exercises: w.exercises.filter((e) => e.exerciseId !== exerciseId) })
    await db.sets.where('workoutId').equals(workoutId).filter((s) => s.exerciseId === exerciseId).delete()
  })
}

export async function moveExercise(workoutId: number, exerciseId: string, dir: -1 | 1) {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  const list = w.exercises.slice()
  const i = list.findIndex((e) => e.exerciseId === exerciseId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await db.workouts.update(workoutId, { exercises: list })
}

export async function updateSet(id: number, patch: Partial<WorkoutSet>) {
  await db.sets.update(id, patch)
}

export async function deleteSet(id: number) {
  await db.sets.delete(id)
}

/**
 * Mark a set complete, detect PRs against history and start the rest timer.
 * Returns the PR types achieved (empty if none).
 */
export async function completeSet(
  id: number,
  values: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSec'>,
  exercise: Exercise,
  restSec: number,
): Promise<RecordType[]> {
  return db.transaction('rw', db.sets, db.workouts, async () => {
    const set = await db.sets.get(id)
    if (!set) return []
    const now = Date.now()
    const history = await db.sets.where('[exerciseId+completed]').equals([set.exerciseId, 1]).filter((s) => s.id !== id).toArray()
    const updated: WorkoutSet = { ...set, ...values, completed: 1, completedAt: now }
    // First session with this exercise is the baseline: only PRs once an earlier workout exists to beat
    const hasEarlierWorkout = history.some((s) => s.workoutId !== set.workoutId && countsForRecords(s))
    const prs = hasEarlierWorkout && countsForRecords(updated) ? detectPRs(updated, exercise.trackingType, buildBests(history)) : []
    await db.sets.put({ ...updated, prs })
    if (restSec > 0) await db.workouts.update(set.workoutId, { restEndsAt: now + restSec * 1000, restTotalSec: restSec })
    return prs
  })
}

export async function uncompleteSet(id: number) {
  await db.sets.update(id, { completed: 0, completedAt: null, prs: [] })
}

export async function setRestTimer(workoutId: number, endsAt: number | null, totalSec?: number) {
  await db.workouts.update(workoutId, { restEndsAt: endsAt, ...(totalSec ? { restTotalSec: totalSec } : {}) })
}

/** Recalculate PR medals for every set of the given exercises (after edits/deletes). */
export async function recomputeExercisePRs(exerciseIds: string[]) {
  for (const exerciseId of new Set(exerciseIds)) {
    const ex = await db.exercises.get(exerciseId)
    if (!ex) continue
    const sets = await db.sets.where('[exerciseId+completed]').equals([exerciseId, 1]).toArray()
    const map = recomputePRs(sets, ex.trackingType)
    await db.sets.bulkUpdate(sets.map((s) => ({ key: s.id!, changes: { prs: map.get(s.id!) ?? [] } })))
  }
}

export function setVolumeKg(s: WorkoutSet): number {
  if (!countsForRecords(s)) return 0
  return (s.weightKg ?? 0) * (s.reps ?? 0)
}

export interface FinishResult {
  workoutId: number
  unlocks: Unlock[]
}

export async function finishWorkout(workoutId: number): Promise<FinishResult> {
  const unlocks = await db.transaction('rw', [db.workouts, db.sets, db.achievements, db.exercises, db.settings], async () => {
    // Drop sets that were never completed
    await db.sets.where('workoutId').equals(workoutId).filter((s) => s.completed === 0).delete()
    const remaining = await db.sets.where('workoutId').equals(workoutId).toArray()
    const w = await db.workouts.get(workoutId)
    if (!w) return []
    const usedIds = new Set(remaining.map((s) => s.exerciseId))
    await db.workouts.update(workoutId, {
      endedAt: Date.now(),
      restEndsAt: null,
      exercises: w.exercises.filter((e) => usedIds.has(e.exerciseId)),
    })
    await recomputeExercisePRs([...usedIds])
    return checkAchievements()
  })
  return { workoutId, unlocks }
}

export async function discardWorkout(workoutId: number) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}

export async function deleteWorkout(workoutId: number) {
  await db.transaction('rw', [db.workouts, db.sets, db.exercises], async () => {
    const sets = await db.sets.where('workoutId').equals(workoutId).toArray()
    await db.sets.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
    await recomputeExercisePRs(sets.map((s) => s.exerciseId))
  })
}

export async function computeStats(): Promise<Stats> {
  const [workouts, sets, exercises, settings] = await Promise.all([
    db.workouts.filter((w) => w.endedAt !== null).toArray(),
    db.sets.filter((s) => s.completed === 1).toArray(),
    db.exercises.toArray(),
    getSettings(),
  ])
  const finishedIds = new Set(workouts.map((w) => w.id))
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  let lifetime = 0
  let maxBarbell = 0
  const perWorkout = new Map<number, number>()
  const distinct = new Set<string>()
  for (const s of sets) {
    if (!finishedIds.has(s.workoutId)) continue
    distinct.add(s.exerciseId)
    const v = setVolumeKg(s)
    lifetime += v
    perWorkout.set(s.workoutId, (perWorkout.get(s.workoutId) ?? 0) + v)
    if (countsForRecords(s) && exMap.get(s.exerciseId)?.equipment === 'barbell') maxBarbell = Math.max(maxBarbell, s.weightKg ?? 0)
  }
  const streak = weeklyStreak(workouts.map((w) => w.startedAt), settings.weeklyGoal)
  return {
    workoutCount: workouts.length,
    lifetimeVolumeKg: lifetime,
    maxBarbellKg: maxBarbell,
    distinctExercises: distinct.size,
    bestWeekStreak: streak.best,
    bestWorkoutVolumeKg: Math.max(0, ...perWorkout.values()),
  }
}

/** Store any newly reached achievement levels and return them. Earned achievements are never revoked. */
export async function checkAchievements(): Promise<Unlock[]> {
  const stats = await computeStats()
  const unlocked = new Set((await db.achievements.toArray()).map((a) => a.id))
  const fresh = newUnlocks(stats, unlocked)
  const now = Date.now()
  const rows: Achievement[] = fresh.map((u) => ({
    id: achievementId(u.family.id, u.level),
    family: u.family.id,
    level: u.level,
    unlockedAt: now,
    seen: 0,
  }))
  if (rows.length) await db.achievements.bulkPut(rows)
  return fresh
}
