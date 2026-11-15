import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { runAsSync } from './localHooks'

/** Tombstones are written once the delete commits, so give that a moment. */
const settle = () => new Promise((r) => setTimeout(r, 20))

describe('sync change tracking', () => {
  beforeEach(async () => {
    await runAsSync(db, [db.workouts, db.sets, db.exercises, db.achievements, db.settings, db.tombstones], async () => {
      await Promise.all([db.workouts.clear(), db.sets.clear(), db.exercises.clear(), db.achievements.clear(), db.settings.clear(), db.tombstones.clear()])
    })
  })

  it('gives new workouts and sets a shared uid and marks them for upload', async () => {
    const id = (await db.workouts.add({ name: 'W', startedAt: 1, endedAt: null, exercises: [] })) as number
    const w = await db.workouts.get(id)
    expect(w?.uid).toMatch(/^[0-9a-f-]{36}$/)
    expect(w?.dirty).toBe(1)
    expect(w?.updatedAt).toBeGreaterThan(0)
  })

  it('marks updated records dirty again', async () => {
    const id = (await db.workouts.add({ name: 'W', startedAt: 1, endedAt: null, exercises: [] })) as number
    await runAsSync(db, [db.workouts], () => db.workouts.update(id, { dirty: 0 }))
    expect((await db.workouts.get(id))?.dirty).toBe(0)
    await db.workouts.update(id, { name: 'Renamed' })
    expect((await db.workouts.get(id))?.dirty).toBe(1)
  })

  it('queues a tombstone when something is deleted', async () => {
    const id = (await db.workouts.add({ name: 'W', startedAt: 1, endedAt: null, exercises: [] })) as number
    const uid = (await db.workouts.get(id))!.uid
    await db.workouts.delete(id)
    await settle()
    expect(await db.tombstones.toArray()).toEqual([expect.objectContaining({ collection: 'workouts', key: uid })])
  })

  it('does not track writes made by the sync engine itself', async () => {
    await runAsSync(db, [db.workouts], async () => {
      await db.workouts.add({ name: 'From cloud', startedAt: 1, endedAt: null, exercises: [], uid: 'abc', dirty: 0 })
    })
    const w = await db.workouts.where('uid').equals('abc').first()
    expect(w?.dirty).toBe(0)
    await runAsSync(db, [db.workouts], () => db.workouts.delete(w!.id!))
    await settle()
    expect(await db.tombstones.count()).toBe(0)
  })

  it('ignores the built-in exercise library but tracks custom exercises', async () => {
    const base = { category: 'strength', equipment: 'barbell', primaryMuscles: [], secondaryMuscles: [], instructions: [], trackingType: 'weight_reps' as const, popular: false }
    await db.exercises.put({ ...base, id: 'builtin', name: 'Built in' })
    await db.exercises.put({ ...base, id: 'custom-1', name: 'Mine', isCustom: true })
    expect((await db.exercises.get('builtin'))?.dirty).toBeUndefined()
    expect((await db.exercises.get('custom-1'))?.dirty).toBe(1)
  })
})
