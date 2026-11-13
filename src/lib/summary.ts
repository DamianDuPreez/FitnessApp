import type { Exercise, RecordType, WorkoutSet } from '../db/types'
import { countsForRecords } from './records'

export interface WorkoutSummary {
  volumeKg: number
  setCount: number
  prs: Array<{ exercise: Exercise | undefined; set: WorkoutSet; types: RecordType[] }>
}

export function summarize(sets: WorkoutSet[], exMap: Map<string, Exercise>): WorkoutSummary {
  let volumeKg = 0
  let setCount = 0
  const prs: WorkoutSummary['prs'] = []
  for (const s of sets) {
    if (s.completed !== 1) continue
    setCount++
    if (countsForRecords(s)) volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0)
    if (s.prs?.length) prs.push({ exercise: exMap.get(s.exerciseId), set: s, types: s.prs })
  }
  return { volumeKg, setCount, prs }
}
