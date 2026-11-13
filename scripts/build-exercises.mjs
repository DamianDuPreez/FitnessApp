// Builds src/data/exercises.json from free-exercise-db (Unlicense / public domain).
// Usage: node scripts/build-exercises.mjs <path-to-downloaded-exercises.json>
// Source: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
import { readFileSync, writeFileSync } from 'node:fs'

const src = process.argv[2]
if (!src) {
  console.error('Pass the path to the downloaded free-exercise-db exercises.json')
  process.exit(1)
}

const POPULAR = new Set([
  'Barbell Bench Press - Medium Grip', 'Barbell Squat', 'Barbell Deadlift', 'Romanian Deadlift', 'Sumo Deadlift',
  'Front Barbell Squat', 'Standing Military Press', 'Barbell Shoulder Press', 'Bent Over Barbell Row', 'Barbell Curl',
  'Barbell Hip Thrust', 'Close-Grip Barbell Bench Press', 'Decline Barbell Bench Press',
  'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Dumbbell Shoulder Press', 'Dumbbell Bicep Curl',
  'Hammer Curls', 'Dumbbell Lunges', 'Goblet Squat', 'Side Lateral Raise',
  'Pullups', 'Chin-Up', 'Pushups', 'Dips - Triceps Version', 'Dips - Chest Version', 'Plank', 'Crunches', 'Hanging Leg Raise',
  'Wide-Grip Lat Pulldown', 'Seated Cable Rows', 'Triceps Pushdown', 'Triceps Pushdown - Rope Attachment', 'Face Pull', 'Cable Crossover',
  'Leg Press', 'Leg Extensions', 'Lying Leg Curls', 'Standing Calf Raises', 'Seated Calf Raise',
  'Machine Bench Press', 'Smith Machine Bench Press', 'Machine Shoulder (Military) Press',
  'Running, Treadmill', 'Rowing, Stationary', 'Bicycling, Stationary', 'Walking, Treadmill',
])

const DURATION = /plank|wall sit|hang\b|treadmill|stationary|bicycling|running|walking|jump rope|rope jumping/i

const raw = JSON.parse(readFileSync(src, 'utf8'))
const out = raw
  .filter((e) => e.category !== 'stretching' && e.equipment !== 'foam roll')
  .map((e) => {
    let trackingType = 'weight_reps'
    if (e.category === 'cardio' || DURATION.test(e.name)) trackingType = 'duration'
    else if (e.equipment === 'body only') trackingType = 'bodyweight'
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      equipment: e.equipment ?? 'other',
      level: e.level,
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      instructions: e.instructions,
      trackingType,
      popular: POPULAR.has(e.name),
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const missing = [...POPULAR].filter((n) => !out.some((e) => e.name === n))
if (missing.length) console.warn('Popular names not found:', missing)

writeFileSync(new URL('../src/data/exercises.json', import.meta.url), JSON.stringify(out))
console.log(`Wrote ${out.length} exercises`)
