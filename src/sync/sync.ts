import { useSyncExternalStore } from 'react'
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore/lite'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import type { IndexableType, Table } from 'dexie'
import { db } from '../db/db'
import type { Syncable, SyncCollection } from '../db/types'
import { auth, firestore } from '../lib/firebase'
import { onLocalChange, runAsSync } from './localHooks'

/**
 * Cloud sync: the phone's database stays the source of truth and works offline.
 * Local changes are uploaded to Firestore under users/{uid}/{collection}/{key},
 * and changes from the person's other devices are downloaded. When the same record
 * changed in both places, the most recent edit wins.
 */

export type SyncState = 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error'
export interface SyncStatus {
  state: SyncState
  lastSyncedAt: number | null
  error?: string
}

let status: SyncStatus = { state: 'signed-out', lastSyncedAt: null }
const statusListeners = new Set<() => void>()
function setStatus(next: SyncStatus) {
  status = next
  for (const fn of statusListeners) fn()
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      statusListeners.add(fn)
      return () => {
        statusListeners.delete(fn)
      }
    },
    () => status,
  )
}

// ---------- local bookkeeping ----------
const OWNER_KEY = 'sync-owner'
const lastKey = (uid: string) => `sync-last:${uid}`
const cursorKey = (uid: string, c: SyncCollection) => `sync-cursor:${uid}:${c}`

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

const ALL_TABLES = () => [db.workouts, db.sets, db.exercises, db.achievements, db.settings, db.tombstones] as Table[]
// Order matters when downloading: workouts before the sets that belong to them.
const COLLECTIONS: SyncCollection[] = ['settings', 'exercises', 'achievements', 'workouts', 'sets']

// ---------- lifecycle ----------
let currentUser: User | null = null
let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let started = false

function schedule(ms: number) {
  if (!currentUser) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), ms)
}

export function initSync() {
  if (started) return
  started = true
  onAuthStateChanged(auth, (user) => {
    currentUser = user
    if (!user) {
      setStatus({ state: 'signed-out', lastSyncedAt: null })
      return
    }
    void (async () => {
      await claimLocalData(user.uid)
      setStatus({ state: 'idle', lastSyncedAt: Number(lsGet(lastKey(user.uid))) || null })
      await syncNow()
    })()
  })
  onLocalChange(() => schedule(3000))
  window.addEventListener('online', () => schedule(0))
  document.addEventListener('visibilitychange', () => {
    // Upload right away when the app goes to the background; refresh when it comes back.
    schedule(0)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') schedule(0)
  }, 120_000)
}

/** Data on this device belongs to whoever last signed in here. A different person gets a clean slate. */
async function claimLocalData(uid: string) {
  const owner = lsGet(OWNER_KEY)
  if (owner && owner !== uid) await wipeLocalData()
  lsSet(OWNER_KEY, uid)
}

export async function syncNow(): Promise<void> {
  const user = currentUser
  if (!user) return
  if (!navigator.onLine) {
    setStatus({ ...status, state: 'offline' })
    return
  }
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    setStatus({ ...status, state: 'syncing', error: undefined })
    try {
      do {
        again = false
        await push(user.uid)
        await pull(user.uid)
      } while (again && currentUser?.uid === user.uid)
      const t = Date.now()
      lsSet(lastKey(user.uid), String(t))
      setStatus({ state: 'idle', lastSyncedAt: t })
    } catch (e) {
      console.warn('Sync failed', e)
      setStatus({
        ...status,
        state: navigator.onLine ? 'error' : 'offline',
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      running = null
    }
  })()
  return running
}

/** Local changes not yet uploaded. */
export async function pendingChangeCount(): Promise<number> {
  const counts = await Promise.all([
    db.workouts.where('dirty').equals(1).count(),
    db.sets.where('dirty').equals(1).count(),
    db.exercises.where('dirty').equals(1).count(),
    db.achievements.where('dirty').equals(1).count(),
    db.tombstones.count(),
  ])
  const settings = await db.settings.get('app')
  return counts.reduce((a, b) => a + b, 0) + (settings?.dirty === 1 ? 1 : 0)
}

/** Remove everything personal from this device (the cloud copy is untouched). */
export async function wipeLocalData() {
  await runAsSync(db, ALL_TABLES(), async () => {
    await db.workouts.clear()
    await db.sets.clear()
    await db.achievements.clear()
    await db.settings.clear()
    await db.tombstones.clear()
    await db.exercises.filter((e) => !!e.isCustom).delete()
  })
}

/** Upload what's left, sign out, and clear this device so the next person starts fresh. */
export async function signOutAndClear() {
  const uid = currentUser?.uid
  await signOut(auth)
  await wipeLocalData()
  lsSet(OWNER_KEY, null)
  if (uid) {
    lsSet(lastKey(uid), null)
    for (const c of COLLECTIONS) lsSet(cursorKey(uid, c), null)
  }
}

// ---------- upload ----------
type Op = { coll: SyncCollection; key: string; data: DocumentData }

/** Drop local-only fields and undefined values (Firestore rejects undefined). */
function toRemote(obj: object, drop: string[] = []): DocumentData {
  const out: DocumentData = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || k === 'id' || k === 'dirty' || drop.includes(k)) continue
    out[k] = v
  }
  return JSON.parse(JSON.stringify(out))
}

async function push(uid: string) {
  const [workouts, sets, exercises, achievements, settings, tombstones] = await Promise.all([
    db.workouts.where('dirty').equals(1).toArray(),
    db.sets.where('dirty').equals(1).toArray(),
    db.exercises.where('dirty').equals(1).filter((e) => !!e.isCustom).toArray(),
    db.achievements.where('dirty').equals(1).toArray(),
    db.settings.get('app'),
    db.tombstones.toArray(),
  ])
  const settingsDirty = settings?.dirty === 1
  if (!workouts.length && !sets.length && !exercises.length && !achievements.length && !settingsDirty && !tombstones.length) return

  // Sets point at their workout by local number; the cloud needs the workout's shared uid.
  const parentIds = [...new Set(sets.map((s) => s.workoutId))]
  const parents = await db.workouts.bulkGet(parentIds)
  const parentUid = new Map(parents.filter(Boolean).map((w) => [w!.id!, w!.uid!]))

  const ops: Op[] = []
  for (const w of workouts) if (w.uid) ops.push({ coll: 'workouts', key: w.uid, data: { ...toRemote(w), deleted: false } })
  for (const s of sets) {
    const workoutUid = parentUid.get(s.workoutId)
    if (s.uid && workoutUid) ops.push({ coll: 'sets', key: s.uid, data: { ...toRemote(s, ['workoutId']), workoutUid, deleted: false } })
  }
  for (const e of exercises) ops.push({ coll: 'exercises', key: e.id, data: { ...toRemote(e), deleted: false } })
  for (const a of achievements) ops.push({ coll: 'achievements', key: a.id, data: { ...toRemote(a), deleted: false } })
  if (settings && settingsDirty) ops.push({ coll: 'settings', key: 'app', data: { ...toRemote(settings), deleted: false } })
  const upserted = new Set(ops.map((o) => `${o.coll}/${o.key}`))
  for (const t of tombstones) {
    if (!upserted.has(`${t.collection}/${t.key}`)) ops.push({ coll: t.collection, key: t.key, data: { deleted: true, updatedAt: Date.now() } })
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(firestore)
    for (const op of ops.slice(i, i + 400)) {
      batch.set(doc(firestore, 'users', uid, op.coll, op.key), { ...op.data, syncedAt: serverTimestamp() })
    }
    await batch.commit()
  }

  // Mark as uploaded, unless the record was edited again while we were uploading.
  await runAsSync(db, ALL_TABLES(), async () => {
    const clean = async (table: Table, pairs: Array<[IndexableType, number | undefined]>) => {
      for (const [key, updatedAt] of pairs) {
        const current = (await table.get(key)) as Syncable | undefined
        if (current && current.updatedAt === updatedAt) await table.update(key, { dirty: 0 })
      }
    }
    await clean(db.workouts as Table, workouts.map((r) => [r.id!, r.updatedAt]))
    await clean(db.sets as Table, sets.map((r) => [r.id!, r.updatedAt]))
    await clean(db.exercises as Table, exercises.map((r) => [r.id, r.updatedAt]))
    await clean(db.achievements as Table, achievements.map((r) => [r.id, r.updatedAt]))
    if (settings && settingsDirty) await clean(db.settings as Table, [['app', settings.updatedAt]])
    await db.tombstones.bulkDelete(tombstones.map((t) => t.id!))
  })
}

// ---------- download ----------
type Cursor = { s: number; n: number }

function readCursor(uid: string, c: SyncCollection): Timestamp {
  try {
    const v = JSON.parse(lsGet(cursorKey(uid, c)) ?? 'null') as Cursor | null
    if (v) return new Timestamp(v.s, v.n)
  } catch {
    /* fall through */
  }
  return new Timestamp(0, 0)
}

const PAGE = 300

async function pull(uid: string) {
  for (const coll of COLLECTIONS) {
    let cursor = readCursor(uid, coll)
    for (;;) {
      const snap = await getDocs(
        query(collection(firestore, 'users', uid, coll), where('syncedAt', '>', cursor), orderBy('syncedAt'), limit(PAGE)),
      )
      if (snap.empty) break
      await applyRemote(coll, snap.docs.map((d) => ({ key: d.id, data: d.data() })))
      const last = snap.docs[snap.docs.length - 1].data().syncedAt as Timestamp
      cursor = last
      lsSet(cursorKey(uid, coll), JSON.stringify({ s: last.seconds, n: last.nanoseconds }))
      if (snap.size < PAGE) break
    }
  }
}

/** Is the local copy a newer, not-yet-uploaded edit than what the cloud has? */
function localWins(local: Syncable | undefined, remote: DocumentData): boolean {
  return !!local && local.dirty === 1 && (local.updatedAt ?? 0) > (Number(remote.updatedAt) || 0)
}

function fromRemote(data: DocumentData): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...data }
  delete rest.syncedAt
  delete rest.deleted
  delete rest.workoutUid
  return { ...rest, dirty: 0 }
}

async function applyRemote(coll: SyncCollection, docs: Array<{ key: string; data: DocumentData }>) {
  await runAsSync(db, ALL_TABLES(), async () => {
    for (const { key, data } of docs) {
      switch (coll) {
        case 'workouts': {
          const local = await db.workouts.where('uid').equals(key).first()
          if (localWins(local, data)) break
          if (data.deleted) {
            if (local) {
              await db.sets.where('workoutId').equals(local.id!).delete()
              await db.workouts.delete(local.id!)
            }
            break
          }
          const rec = { ...fromRemote(data), uid: key } as never
          if (local) await db.workouts.put({ ...(rec as object), id: local.id } as never)
          else await db.workouts.add(rec)
          break
        }
        case 'sets': {
          const local = await db.sets.where('uid').equals(key).first()
          if (localWins(local, data)) break
          if (data.deleted) {
            if (local) await db.sets.delete(local.id!)
            break
          }
          const parent = await db.workouts.where('uid').equals(String(data.workoutUid)).first()
          if (!parent) break // its workout was deleted
          const rec = { ...fromRemote(data), uid: key, workoutId: parent.id! }
          if (local) await db.sets.put({ ...rec, id: local.id } as never)
          else await db.sets.add(rec as never)
          break
        }
        case 'exercises': {
          const local = await db.exercises.get(key)
          if (localWins(local, data)) break
          if (data.deleted) {
            if (local?.isCustom) await db.exercises.delete(key)
            break
          }
          await db.exercises.put({ ...fromRemote(data), id: key, isCustom: true } as never)
          break
        }
        case 'achievements': {
          const local = await db.achievements.get(key)
          if (localWins(local, data)) break
          if (data.deleted) {
            if (local) await db.achievements.delete(key)
            break
          }
          await db.achievements.put({ ...fromRemote(data), id: key } as never)
          break
        }
        case 'settings': {
          const local = await db.settings.get('app')
          if (localWins(local, data) || data.deleted) break
          await db.settings.put({ ...fromRemote(data), id: 'app' } as never)
          break
        }
      }
    }
  })
}
