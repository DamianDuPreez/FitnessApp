/** Monday 00:00 local time of the week containing `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d.getTime()
}

function addWeeks(ts: number, n: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + n * 7)
  return d.getTime()
}

export interface StreakInfo {
  thisWeekCount: number
  /** consecutive weeks meeting the goal, ending with this week if met, else last week */
  current: number
  best: number
}

/**
 * Weekly-goal streak. Rest days never break it; only a full week below the goal does.
 * The current week counts once the goal is reached, and doesn't break the streak while still in progress.
 */
export function weeklyStreak(workoutTimes: number[], goal: number, now = Date.now()): StreakInfo {
  const counts = new Map<number, number>()
  for (const t of workoutTimes) {
    const w = weekStart(t)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const thisWeek = weekStart(now)
  const thisWeekCount = counts.get(thisWeek) ?? 0
  const met = (w: number) => (counts.get(w) ?? 0) >= goal

  // best: scan all weeks from the earliest workout to this week
  let best = 0
  if (counts.size) {
    let run = 0
    for (let w = Math.min(...counts.keys()); w <= thisWeek; w = addWeeks(w, 1)) {
      if (met(w)) {
        run++
        best = Math.max(best, run)
      } else if (w !== thisWeek) {
        run = 0
      }
    }
  }

  let current = met(thisWeek) ? 1 : 0
  for (let w = addWeeks(thisWeek, -1); met(w); w = addWeeks(w, -1)) current++

  return { thisWeekCount, current, best: Math.max(best, current) }
}
