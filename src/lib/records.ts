import type { RecordType, TrackingType, WorkoutSet } from '../db/types'

/** Epley estimated 1RM. Only meaningful for 1–10 reps. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > 10) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface Bests {
  /** number of qualifying sets seen so far */
  count: number
  e1rm: number
  weight: number
  volume: number
  reps: number
  duration: number
  /** best reps achieved at (at least) a given weight: [weightKg, reps] pairs */
  repsAtWeight: Array<[number, number]>
}

export const emptyBests = (): Bests => ({
  count: 0,
  e1rm: 0,
  weight: 0,
  volume: 0,
  reps: 0,
  duration: 0,
  repsAtWeight: [],
})

/** Warm-ups never count. Sets must be completed. */
export function countsForRecords(set: Pick<WorkoutSet, 'setType' | 'completed'>): boolean {
  return set.completed === 1 && set.setType !== 'warmup'
}

function bestRepsAtOrAbove(bests: Bests, weightKg: number): number {
  let best = 0
  for (const [w, r] of bests.repsAtWeight) if (w >= weightKg && r > best) best = r
  return best
}

const EPS = 1e-6

/**
 * Compare one set against the bests so far and return which records it breaks.
 * The first qualifying set for an exercise is a baseline and never a PR.
 */
export function detectPRs(
  set: Pick<WorkoutSet, 'setType' | 'weightKg' | 'reps' | 'durationSec'>,
  trackingType: TrackingType,
  bests: Bests,
): RecordType[] {
  if (bests.count === 0) return []
  const prs: RecordType[] = []
  const w = set.weightKg ?? 0
  const r = set.reps ?? 0

  if (trackingType === 'duration') {
    if ((set.durationSec ?? 0) > bests.duration + EPS) prs.push('duration')
    return prs
  }

  if (w > 0) {
    if (w > bests.weight + EPS) prs.push('weight')
    // Drop sets count for volume/reps but not for 1RM estimates
    const e = set.setType === 'drop' ? null : estimate1RM(w, r)
    if (e !== null && e > bests.e1rm + EPS) prs.push('e1rm')
    if (w * r > bests.volume + EPS) prs.push('volume')
    // Rep PR: more reps than ever at this weight or heavier (only if we've lifted this heavy before)
    const prev = bestRepsAtOrAbove(bests, w)
    if (prev > 0 && r > prev) prs.push('reps')
  } else if (r > bests.reps) {
    prs.push('reps')
  }
  return prs
}

export function applyToBests(
  bests: Bests,
  set: Pick<WorkoutSet, 'setType' | 'weightKg' | 'reps' | 'durationSec'>,
): Bests {
  const w = set.weightKg ?? 0
  const r = set.reps ?? 0
  const next: Bests = { ...bests, count: bests.count + 1, repsAtWeight: bests.repsAtWeight }
  next.weight = Math.max(bests.weight, w)
  next.reps = Math.max(bests.reps, r)
  next.volume = Math.max(bests.volume, w * r)
  next.duration = Math.max(bests.duration, set.durationSec ?? 0)
  const e = set.setType === 'drop' ? null : estimate1RM(w, r)
  if (e !== null) next.e1rm = Math.max(bests.e1rm, e)
  if (w > 0 && r > 0) {
    const idx = bests.repsAtWeight.findIndex(([bw]) => Math.abs(bw - w) < EPS)
    const copy = bests.repsAtWeight.slice()
    if (idx === -1) copy.push([w, r])
    else if (copy[idx][1] < r) copy[idx] = [w, r]
    next.repsAtWeight = copy
  }
  return next
}

/** Build bests from an exercise's history (sets in any order; non-qualifying sets ignored). */
export function buildBests(sets: WorkoutSet[]): Bests {
  return sets
    .filter(countsForRecords)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    .reduce(applyToBests, emptyBests())
}

/**
 * Recompute PR flags for a full chronological history of one exercise.
 * Returns a map of set id → PR types. Used after edits/deletes.
 */
export function recomputePRs(sets: WorkoutSet[], trackingType: TrackingType): Map<number, RecordType[]> {
  const ordered = sets.filter(countsForRecords).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  const out = new Map<number, RecordType[]>()
  let bests = emptyBests()
  // The whole first session with an exercise is the baseline: no PRs until there's something to beat.
  const baselineWorkout = ordered[0]?.workoutId
  for (const s of ordered) {
    const prs = s.workoutId === baselineWorkout ? [] : detectPRs(s, trackingType, bests)
    if (s.id !== undefined) out.set(s.id, prs)
    bests = applyToBests(bests, s)
  }
  return out
}

export const RECORD_LABELS: Record<RecordType, string> = {
  e1rm: 'Est. 1RM',
  weight: 'Heaviest weight',
  reps: 'Most reps',
  volume: 'Best set volume',
  duration: 'Longest time',
}

