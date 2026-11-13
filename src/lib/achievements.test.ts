import { describe, expect, it } from 'vitest'
import { FAMILIES, achievementId, levelReached, newUnlocks, progressToNext, type Stats } from './achievements'
import { weeklyStreak, weekStart } from './weeks'

const zero: Stats = {
  workoutCount: 0,
  lifetimeVolumeKg: 0,
  maxBarbellKg: 0,
  distinctExercises: 0,
  bestWeekStreak: 0,
  bestWorkoutVolumeKg: 0,
}

describe('achievements', () => {
  const workouts = FAMILIES.find((f) => f.id === 'workoutCount')!

  it('finds the level reached', () => {
    expect(levelReached(workouts, 0)).toBe(-1)
    expect(levelReached(workouts, 1)).toBe(0)
    expect(levelReached(workouts, 30)).toBe(2)
  })

  it('returns only unlocks not already stored', () => {
    const stats = { ...zero, workoutCount: 12 }
    expect(newUnlocks(stats, new Set()).map((u) => u.level)).toEqual([0, 1])
    expect(newUnlocks(stats, new Set([achievementId('workoutCount', 0)])).map((u) => u.level)).toEqual([1])
  })

  it('computes progress to the next level', () => {
    const p = progressToNext(workouts, 5)
    expect(p.next?.threshold).toBe(10)
    expect(p.pct).toBeCloseTo((4 / 9) * 100)
  })
})

describe('weeklyStreak', () => {
  // Wednesday 12 Nov 2025, noon
  const now = new Date(2025, 10, 12, 12).getTime()
  const day = 86_400_000
  const thisMon = weekStart(now)

  it('counts consecutive weeks meeting the goal', () => {
    const times = [
      thisMon - 14 * day + 1, thisMon - 13 * day, // 2 weeks ago: 2
      thisMon - 7 * day + 1, thisMon - 5 * day, // last week: 2
      thisMon + 1, // this week: 1 (in progress)
    ]
    const s = weeklyStreak(times, 2, now)
    expect(s.current).toBe(2)
    expect(s.thisWeekCount).toBe(1)
    expect(s.best).toBe(2)
  })

  it('breaks after a missed full week', () => {
    const times = [thisMon - 21 * day, thisMon - 20 * day, thisMon + 1, thisMon + 2]
    const s = weeklyStreak(times, 2, now)
    expect(s.current).toBe(1)
  })
})
