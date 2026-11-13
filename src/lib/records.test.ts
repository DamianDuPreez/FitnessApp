import { describe, expect, it } from 'vitest'
import { applyToBests, detectPRs, emptyBests, estimate1RM, recomputePRs } from './records'
import type { WorkoutSet } from '../db/types'

let nextId = 1
const set = (weightKg: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: nextId++,
  workoutId: 1,
  exerciseId: 'bench',
  order: 0,
  setType: 'normal',
  weightKg,
  reps,
  durationSec: null,
  completed: 1,
  completedAt: nextId * 1000,
  ...extra,
})

describe('estimate1RM', () => {
  it('uses Epley and returns weight for single reps', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1)
  })
  it('ignores high-rep and empty sets', () => {
    expect(estimate1RM(100, 12)).toBeNull()
    expect(estimate1RM(0, 5)).toBeNull()
  })
})

describe('detectPRs', () => {
  it('treats the very first set as a baseline, not a PR', () => {
    expect(detectPRs(set(60, 8), 'weight_reps', emptyBests())).toEqual([])
  })

  it('flags heavier weight, e1rm and volume', () => {
    const bests = applyToBests(emptyBests(), set(60, 8))
    const prs = detectPRs(set(70, 8), 'weight_reps', bests)
    expect(prs).toEqual(expect.arrayContaining(['weight', 'e1rm', 'volume']))
  })

  it('flags a rep PR at an already-lifted weight', () => {
    const bests = applyToBests(emptyBests(), set(80, 6))
    expect(detectPRs(set(80, 8), 'weight_reps', bests)).toContain('reps')
  })

  it('does not flag anything for an equal or worse set', () => {
    const bests = applyToBests(emptyBests(), set(80, 8))
    expect(detectPRs(set(80, 8), 'weight_reps', bests)).toEqual([])
    expect(detectPRs(set(70, 5), 'weight_reps', bests)).toEqual([])
  })

  it('does not count drop sets toward e1rm', () => {
    const bests = applyToBests(emptyBests(), set(60, 5))
    expect(detectPRs(set(60, 8, { setType: 'drop' }), 'weight_reps', bests)).not.toContain('e1rm')
  })

  it('handles bodyweight reps', () => {
    const bests = applyToBests(emptyBests(), set(0, 10))
    expect(detectPRs(set(0, 12), 'bodyweight', bests)).toEqual(['reps'])
  })

  it('handles duration exercises', () => {
    const bests = applyToBests(emptyBests(), set(0, 0, { durationSec: 60 }))
    expect(detectPRs(set(0, 0, { durationSec: 75 }), 'duration', bests)).toEqual(['duration'])
  })
})

describe('recomputePRs', () => {
  it('ignores warm-ups and incomplete sets and recomputes in time order', () => {
    const a = set(60, 8)
    const warm = set(100, 1, { setType: 'warmup', workoutId: 2 })
    const b = set(65, 8, { workoutId: 2 })
    const undone = set(200, 1, { completed: 0, workoutId: 2 })
    const map = recomputePRs([b, undone, warm, a], 'weight_reps')
    expect(map.get(a.id!)).toEqual([])
    expect(map.get(b.id!)).toEqual(expect.arrayContaining(['weight', 'e1rm', 'volume']))
    expect(map.has(warm.id!)).toBe(false)
    expect(map.has(undone.id!)).toBe(false)
  })

  it('treats the whole first workout as the baseline', () => {
    const a = set(60, 8)
    const b = set(80, 8) // same workout, heavier: still baseline
    const map = recomputePRs([a, b], 'weight_reps')
    expect(map.get(b.id!)).toEqual([])
  })
})
