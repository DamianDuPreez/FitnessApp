import Dexie, { type Table, type Transaction } from 'dexie'
import type { FitnessDB } from '../db/db'
import type { Syncable, SyncCollection, Tombstone } from '../db/types'

/**
 * Change tracking for cloud sync.
 *
 * Every local create/update stamps `updatedAt` and marks the record `dirty`, and every
 * delete leaves a tombstone, so the sync engine knows exactly what to upload.
 * Writes made BY the sync engine (applying cloud data, clearing dirty flags) run inside
 * `runAsSync`, which these hooks ignore, so they don't bounce back to the cloud.
 */

const SYNC_FLAG = '__fromSync'

type Listener = () => void
const listeners = new Set<Listener>()

/** Subscribe to "something changed locally that should be uploaded". */
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function emit() {
  for (const fn of listeners) fn()
}

type Flagged = Transaction & { [SYNC_FLAG]?: boolean; parent?: Flagged }

export function isSyncTransaction(trans: Transaction | null | undefined): boolean {
  for (let t = trans as Flagged | undefined; t; t = t.parent) if (t[SYNC_FLAG]) return true
  return false
}

/** Run database work that must not be tracked as a local change. */
export function runAsSync<T>(database: FitnessDB, tables: Table[], fn: () => Promise<T>): Promise<T> {
  return database.transaction('rw', tables, async () => {
    ;(Dexie.currentTransaction as Flagged)[SYNC_FLAG] = true
    return fn()
  })
}

export function newUid(): string {
  return crypto.randomUUID()
}

interface TrackOptions<T> {
  /** Give new records a cross-device `uid` (tables with auto-increment keys). */
  uid?: boolean
  /** Only track records that pass (e.g. custom exercises, not the built-in library). */
  only?: (obj: T) => boolean
  /** The key the record has in the cloud. */
  key: (obj: T) => string | undefined
}

const pendingTombstones = new WeakMap<Transaction, Tombstone[]>()

function track<T extends Syncable>(database: FitnessDB, table: Table<T>, collection: SyncCollection, opts: TrackOptions<T>) {
  table.hook('creating', (_key, obj, trans) => {
    if (opts.uid && !obj.uid) obj.uid = newUid()
    if (isSyncTransaction(trans) || (opts.only && !opts.only(obj))) return
    obj.updatedAt = Date.now()
    obj.dirty = 1
    trans.on('complete', emit)
  })

  table.hook('updating', (mods, _key, obj, trans) => {
    if (isSyncTransaction(trans) || (opts.only && !opts.only({ ...obj, ...mods } as T))) return
    trans.on('complete', emit)
    return { updatedAt: Date.now(), dirty: 1 }
  })

  table.hook('deleting', (_key, obj, trans) => {
    if (isSyncTransaction(trans) || (opts.only && !opts.only(obj))) return
    const key = opts.key(obj)
    if (!key) return
    let list = pendingTombstones.get(trans)
    if (!list) {
      list = []
      pendingTombstones.set(trans, list)
      const queued = list
      // Only record the deletion once the delete has actually committed.
      trans.on('complete', () => {
        void database.tombstones.bulkAdd(queued).then(emit)
      })
    }
    list.push({ collection, key })
  })
}

export function installSyncHooks(database: FitnessDB) {
  track(database, database.workouts, 'workouts', { uid: true, key: (w) => w.uid })
  track(database, database.sets, 'sets', { uid: true, key: (s) => s.uid })
  track(database, database.exercises, 'exercises', { only: (e) => !!e.isCustom, key: (e) => e.id })
  track(database, database.achievements, 'achievements', { key: (a) => a.id })
  track(database, database.settings, 'settings', { key: () => 'app' })
}
