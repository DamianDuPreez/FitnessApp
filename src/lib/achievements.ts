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
  /** lucide icon name, resolved in components/Icons.tsx */
  icon: string
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
      { threshold: 1, title: 'First Rep', icon: 'Sprout' },
      { threshold: 10, title: 'Regular', icon: 'Dumbbell' },
      { threshold: 25, title: 'Committed', icon: 'Flame' },
      { threshold: 50, title: 'Gym Regular', icon: 'Medal' },
      { threshold: 100, title: 'Centurion', icon: 'Shield' },
      { threshold: 250, title: 'Iron Veteran', icon: 'Swords' },
    ],
  },
  {
    id: 'lifetimeVolumeKg',
    name: 'Heavy Hauler',
    description: 'Total weight lifted, ever',
    format: t,
    levels: [
      { threshold: 1_500, title: 'Lifted a car', icon: 'Car' },
      { threshold: 6_000, title: 'Lifted a truck', icon: 'Truck' },
      { threshold: 12_000, title: 'Lifted a bus', icon: 'Bus' },
      { threshold: 60_000, title: 'Lifted a locomotive', icon: 'TrainFront' },
      { threshold: 150_000, title: 'Lifted a ship', icon: 'Ship' },
      { threshold: 400_000, title: 'Lifted a jumbo jet', icon: 'Plane' },
    ],
  },
  {
    id: 'maxBarbellKg',
    name: 'Plate Club',
    description: 'Heaviest barbell lift (20 kg bar)',
    format: t,
    levels: [
      { threshold: 60, title: 'One plate', icon: 'Disc3' },
      { threshold: 100, title: 'Two plates', icon: 'Disc3' },
      { threshold: 140, title: 'Three plates', icon: 'Disc3' },
      { threshold: 180, title: 'Four plates', icon: 'Disc3' },
      { threshold: 220, title: 'Five plates', icon: 'Crown' },
    ],
  },
  {
    id: 'bestWeekStreak',
    name: 'Consistency',
    description: 'Weeks in a row hitting your weekly goal',
    format: (v) => `${v} wk`,
    levels: [
      { threshold: 2, title: 'Back to back', icon: 'CalendarCheck' },
      { threshold: 4, title: 'One month strong', icon: 'CalendarDays' },
      { threshold: 8, title: 'Habit formed', icon: 'Link2' },
      { threshold: 12, title: 'Quarter of iron', icon: 'CalendarRange' },
      { threshold: 26, title: 'Half-year hero', icon: 'CalendarHeart' },
      { threshold: 52, title: 'Year of gains', icon: 'Crown' },
    ],
  },
  {
    id: 'distinctExercises',
    name: 'Explorer',
    description: 'Different exercises tried',
    format: (v) => `${v}`,
    levels: [
      { threshold: 5, title: 'Curious', icon: 'Compass' },
      { threshold: 15, title: 'Well-rounded', icon: 'Map' },
      { threshold: 30, title: 'Adventurer', icon: 'Mountain' },
      { threshold: 50, title: 'Encyclopedia', icon: 'Library' },
    ],
  },
  {
    id: 'bestWorkoutVolumeKg',
    name: 'Big Session',
    description: 'Most weight lifted in one workout',
    format: t,
    levels: [
      { threshold: 2_500, title: 'Solid session', icon: 'Zap' },
      { threshold: 5_000, title: 'Big day', icon: 'CloudLightning' },
      { threshold: 10_000, title: 'Monster session', icon: 'Gauge' },
      { threshold: 20_000, title: 'Volume king', icon: 'Landmark' },
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
