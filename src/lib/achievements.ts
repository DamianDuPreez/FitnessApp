export interface Stats {
  workoutCount: number
  lifetimeVolumeKg: number
  /** heaviest completed (non-warm-up) barbell set */
  maxBarbellKg: number
  distinctExercises: number
  /** best ever weekly-goal streak */
  bestWeekStreak: number
  bestWorkoutVolumeKg: number
}

export interface Level {
  threshold: number
  title: string
  emoji: string
}

export interface Family {
  id: keyof Stats
  name: string
  description: string
  /** how to show progress numbers */
  format: (value: number) => string
  levels: Level[]
}

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'] as const

const t = (kg: number) => (kg >= 1000 ? `${Math.round(kg / 100) / 10} t` : `${Math.round(kg)} kg`)

export const FAMILIES: Family[] = [
  {
    id: 'workoutCount',
    name: 'Dedication',
    description: 'Workouts logged',
    format: (v) => `${v}`,
    levels: [
      { threshold: 1, title: 'First Rep', emoji: '🌱' },
      { threshold: 10, title: 'Regular', emoji: '💪' },
      { threshold: 25, title: 'Committed', emoji: '🔥' },
      { threshold: 50, title: 'Gym Rat', emoji: '🐀' },
      { threshold: 100, title: 'Centurion', emoji: '🛡️' },
      { threshold: 250, title: 'Iron Veteran', emoji: '⚔️' },
    ],
  },
  {
    id: 'lifetimeVolumeKg',
    name: 'Heavy Hauler',
    description: 'Total weight lifted, ever',
    format: t,
    levels: [
      { threshold: 1_500, title: 'Lifted a car', emoji: '🚗' },
      { threshold: 6_000, title: 'Lifted an elephant', emoji: '🐘' },
      { threshold: 12_000, title: 'Lifted a bus', emoji: '🚌' },
      { threshold: 60_000, title: 'Lifted a tank', emoji: '🪖' },
      { threshold: 150_000, title: 'Lifted a blue whale', emoji: '🐋' },
      { threshold: 400_000, title: 'Lifted a jumbo jet', emoji: '✈️' },
    ],
  },
  {
    id: 'maxBarbellKg',
    name: 'Plate Club',
    description: 'Heaviest barbell lift (20 kg bar)',
    format: t,
    levels: [
      { threshold: 60, title: 'One plate', emoji: '🥉' },
      { threshold: 100, title: 'Two plates', emoji: '🥈' },
      { threshold: 140, title: 'Three plates', emoji: '🥇' },
      { threshold: 180, title: 'Four plates', emoji: '💎' },
      { threshold: 220, title: 'Five plates', emoji: '👑' },
    ],
  },
  {
    id: 'bestWeekStreak',
    name: 'Consistency',
    description: 'Weeks in a row hitting your weekly goal',
    format: (v) => `${v} wk`,
    levels: [
      { threshold: 2, title: 'Back to back', emoji: '📅' },
      { threshold: 4, title: 'One month strong', emoji: '🗓️' },
      { threshold: 8, title: 'Habit formed', emoji: '🔗' },
      { threshold: 12, title: 'Quarter of iron', emoji: '⛓️' },
      { threshold: 26, title: 'Half-year hero', emoji: '🌗' },
      { threshold: 52, title: 'Year of gains', emoji: '🌕' },
    ],
  },
  {
    id: 'distinctExercises',
    name: 'Explorer',
    description: 'Different exercises tried',
    format: (v) => `${v}`,
    levels: [
      { threshold: 5, title: 'Curious', emoji: '🧭' },
      { threshold: 15, title: 'Well-rounded', emoji: '🗺️' },
      { threshold: 30, title: 'Adventurer', emoji: '🏔️' },
      { threshold: 50, title: 'Encyclopedia', emoji: '📚' },
    ],
  },
  {
    id: 'bestWorkoutVolumeKg',
    name: 'Big Session',
    description: 'Most weight lifted in one workout',
    format: t,
    levels: [
      { threshold: 2_500, title: 'Solid session', emoji: '⚡' },
      { threshold: 5_000, title: 'Big day', emoji: '🌩️' },
      { threshold: 10_000, title: 'Monster session', emoji: '🦍' },
      { threshold: 20_000, title: 'Volume king', emoji: '🏛️' },
    ],
  },
]

/** Highest level index reached for a family (-1 if none). */
export function levelReached(family: Family, value: number): number {
  let idx = -1
  family.levels.forEach((l, i) => {
    if (value >= l.threshold) idx = i
  })
  return idx
}

export interface Unlock {
  family: Family
  level: number
}

/** Levels newly reached compared with what is already unlocked (by id "family:level"). */
export function newUnlocks(stats: Stats, unlocked: Set<string>): Unlock[] {
  const out: Unlock[] = []
  for (const family of FAMILIES) {
    const reached = levelReached(family, stats[family.id])
    for (let level = 0; level <= reached; level++) {
      if (!unlocked.has(achievementId(family.id, level))) out.push({ family, level })
    }
  }
  return out
}

export const achievementId = (family: string, level: number) => `${family}:${level}`

export function progressToNext(family: Family, value: number): { next: Level | null; pct: number } {
  const idx = levelReached(family, value)
  const next = family.levels[idx + 1] ?? null
  if (!next) return { next: null, pct: 100 }
  const prev = idx >= 0 ? family.levels[idx].threshold : 0
  return { next, pct: Math.min(100, Math.max(0, ((value - prev) / (next.threshold - prev)) * 100)) }
}
