import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import type { Exercise } from './types'
import {
  addExerciseToWorkout,
  completeSet,
  deleteWorkout,
  finishWorkout,
  getPreviousSets,
  startWorkout,
} from './workouts'

const bench: Exercise = {
  id: 'bench',
  name: 'Bench Press',
  category: 'strength',
  equipment: 'barbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  instructions: [],
  trackingType: 'weight_reps',
  popular: true,
}

async function logWorkout(sets: Array<[number, number]>) {
  const id = await startWorkout()
  await addExerciseToWorkout(id, bench.id)
  let rows = await db.sets.where('workoutId').equals(id).sortBy('order')
  while (rows.length < sets.length) {
    await db.sets.add({ ...rows[0], id: undefined, order: rows.length })
    rows = await db.sets.where('workoutId').equals(id).sortBy('order')
  }
  const prs = []
  for (let i = 0; i < sets.length; i++) {
    prs.push(await completeSet(rows[i].id!, { weightKg: sets[i][0], reps: sets[i][1], durationSec: null }, bench, 0))
  }
  const result = await finishWorkout(id)
  return { id, prs, result }
}

describe('workout flow', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.exercises.put(bench)
  })

  it('logs a first workout as a baseline and unlocks the first achievement', async () => {
    const { prs, result } = await logWorkout([[60, 8]])
    expect(prs[0]).toEqual([])
    expect(result.unlocks.map((u) => u.family.id)).toContain('workoutCount')
    expect(result.unlocks.some((u) => u.family.id === 'maxBarbellKg')).toBe(true) // 60 kg = one plate
  })

  it('never flags PRs during the first session with an exercise', async () => {
    const { prs } = await logWorkout([[40, 10], [60, 8], [70, 6]])
    expect(prs.flat()).toEqual([])
  })

  it('detects PRs live and pre-fills previous sets', async () => {
    await logWorkout([[60, 8], [60, 8]])
    const second = await logWorkout([[70, 8]])
    expect(second.prs[0]).toEqual(expect.arrayContaining(['weight', 'e1rm', 'volume']))

    const prev = await getPreviousSets('bench')
    expect(prev.map((s) => s.weightKg)).toEqual([70])
  })

  it('recomputes medals when a workout is deleted', async () => {
    const first = await logWorkout([[60, 8]])
    const second = await logWorkout([[70, 8]])
    const third = await logWorkout([[65, 8]])
    expect(third.prs[0]).toEqual([])

    await deleteWorkout(second.id)
    const thirdSets = await db.sets.where('workoutId').equals(third.id).toArray()
    expect(thirdSets[0].prs).toEqual(expect.arrayContaining(['weight']))
    expect(await db.workouts.get(first.id)).toBeDefined()
  })
})
