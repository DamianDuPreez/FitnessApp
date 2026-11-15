import { useEffect, useRef, useState } from 'react'
import { requestPersistentStorage, updateSettings } from '../db/db'
import { checkAchievements } from '../db/workouts'
import { useSettings } from '../hooks'
import { backupFileName, downloadBlob, exportBackup, importBackup } from '../lib/backup'
import { isIOS, isStandalone, parseNum } from '../lib/format'
import { fromDisplayWeight, toDisplayWeight } from '../lib/units'
import { useToast } from '../components/Toasts'
import { DEFAULT_SETTINGS, type Unit } from '../db/types'
import { CircleCheck, Cloud, CloudAlert, CloudOff, Download, ShieldCheck, Upload } from 'lucide-react'
import { AppMark } from '../components/Icons'
import { showIntro } from '../components/Intro'
import { requestSignIn, useAuth } from '../sync/auth'
import { pendingChangeCount, signOutAndClear, syncNow, useSyncStatus, type SyncStatus } from '../sync/sync'

function ago(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function statusLine(st: SyncStatus): { text: string; tone: 'ok' | 'muted' | 'error' } {
  switch (st.state) {
    case 'syncing':
      return { text: 'Backing up…', tone: 'muted' }
    case 'offline':
      return { text: "You're offline. Changes will upload when you're back online.", tone: 'muted' }
    case 'error':
      return { text: `Couldn't back up: ${st.error ?? 'unknown error'}`, tone: 'error' }
    default:
      return st.lastSyncedAt ? { text: `Backed up ${ago(st.lastSyncedAt)}`, tone: 'ok' } : { text: 'Waiting to back up…', tone: 'muted' }
  }
}

function AccountCard() {
  const { user } = useAuth()
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)

  if (!user) {
    return (
      <div className="card stack">
        <h2>Account</h2>
        <p className="small" style={{ margin: 0 }}>
          You're not signed in, so your workouts only live on this phone. Sign in to back them up and use them on other devices.
        </p>
        <button className="btn primary block" onClick={requestSignIn}>Sign in or create account</button>
      </div>
    )
  }

  const line = statusLine(status)
  const signOut = async () => {
    setBusy(true)
    try {
      await syncNow()
      const pending = await pendingChangeCount()
      const msg = pending
        ? `${pending} change${pending === 1 ? " hasn't" : "s haven't"} been backed up yet and will be lost. Sign out anyway?`
        : 'Sign out? Your data stays safe in your account and is removed from this phone until you sign in again.'
      if (confirm(msg)) await signOutAndClear()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <h2>Account</h2>
      <div>
        <div style={{ fontWeight: 600 }} className="ellipsis">{user.displayName || user.email}</div>
        {user.displayName && <div className="small muted ellipsis">{user.email}</div>}
      </div>
      <div className="row small" style={{ gap: 8, color: line.tone === 'error' ? 'var(--danger)' : line.tone === 'ok' ? 'var(--text-2)' : 'var(--muted)' }}>
        {line.tone === 'ok' ? <Cloud size={16} className="brand" /> : line.tone === 'error' ? <CloudAlert size={16} /> : <CloudOff size={16} />}
        <span>{line.text}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn grow" disabled={busy || status.state === 'syncing'} onClick={() => void syncNow()}>Back up now</button>
        <button className="btn danger grow" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const s = useSettings()
  const toast = useToast()
  const signedIn = !!useAuth().user
  const fileRef = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const onImport = async (file: File | undefined) => {
    if (!file) return
    if (!confirm('Importing replaces ALL workouts on this device with the backup. Continue?')) return
    try {
      const { workouts } = await importBackup(file)
      await checkAchievements()
      toast({ kind: 'success', title: 'Backup restored', body: `${workouts} workout${workouts === 1 ? '' : 's'} imported` })
    } catch (e) {
      toast({ kind: 'error', title: 'Import failed', body: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}><h1>Settings</h1></div>

      <AccountCard />

      <div className="card stack">
        <h2>Training</h2>
        <label className="field">
          Units
          <div className="segmented">
            {(['kg', 'lb'] as Unit[]).map((u) => (
              <button key={u} type="button" className={s.unit === u ? 'on' : ''} onClick={() => updateSettings({ unit: u })}>{u}</button>
            ))}
          </div>
        </label>
        <label className="field">
          Weekly goal (workouts per week)
          <div className="segmented">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" className={s.weeklyGoal === n ? 'on' : ''} onClick={() => updateSettings({ weeklyGoal: n })}>{n}</button>
            ))}
          </div>
        </label>
        <label className="field">
          Default rest timer
          <div className="segmented">
            {[0, 60, 90, 120, 180, 240].map((n) => (
              <button key={n} type="button" className={s.defaultRestSec === n ? 'on' : ''} onClick={() => updateSettings({ defaultRestSec: n })}>
                {n === 0 ? 'Off' : n < 120 ? `${n}s` : `${n / 60}m`}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          Bodyweight ({s.unit}) <span className="hint tiny">optional, for future strength levels</span>
          <input
            className="input"
            inputMode="decimal"
            defaultValue={s.bodyweightKg ? toDisplayWeight(s.bodyweightKg, s.unit) : ''}
            // remount only when units change or real settings finish loading, not on every keystroke
            key={`${s.unit}-${s === DEFAULT_SETTINGS ? 'loading' : 'loaded'}`}
            onChange={(e) => {
              const n = parseNum(e.target.value)
              void updateSettings({ bodyweightKg: n ? fromDisplayWeight(n, s.unit) : null })
            }}
          />
        </label>
        <label className="field">
          Barbell weight (kg)
          <div className="segmented">
            {[20, 15, 10].map((n) => (
              <button key={n} type="button" className={s.barWeightKg === n ? 'on' : ''} onClick={() => updateSettings({ barWeightKg: n })}>{n} kg</button>
            ))}
          </div>
        </label>
      </div>

      <div className="card stack">
        <h2>Your data</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Your data lives on this phone{signedIn ? ' and is backed up to your account automatically' : ''}. You can also save a backup file, for example before changing phones.
        </p>
        <button
          className="btn block"
          onClick={async () => {
            downloadBlob(await exportBackup(), backupFileName())
            toast({ kind: 'success', title: 'Backup downloaded' })
          }}
        >
          <Download size={17} /> Export backup
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}><Upload size={17} /> Import backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
        <div className="small row" style={{ gap: 6 }}>
          <ShieldCheck size={16} className="brand" /> Storage protection:{' '}
          {persisted ? (
            <b style={{ color: 'var(--success)' }}>On</b>
          ) : (
            <>
              <b className="muted">Not guaranteed</b>{' '}
              <button className="btn sm" onClick={async () => setPersisted(await requestPersistentStorage())}>Request</button>
            </>
          )}
        </div>
      </div>

      <div className="card stack">
        <h2>Install</h2>
        {isStandalone() ? (
          <p className="small row" style={{ margin: 0, gap: 6 }}><CircleCheck size={16} style={{ color: 'var(--success)' }} /> Installed. You're using the app version.</p>
        ) : isIOS() ? (
          <p className="small" style={{ margin: 0 }}>In <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>. Installing keeps your data safe and makes it work like a real app, even offline.</p>
        ) : (
          <p className="small" style={{ margin: 0 }}>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
        )}
      </div>

      <div className="card stack">
        <h2>Help</h2>
        <p className="small" style={{ margin: 0 }}>New here, or showing someone else how it works?</p>
        <button
          className="btn block"
          onClick={() => {
            try {
              localStorage.removeItem('hint-logging')
            } catch {
              /* ignore */
            }
            showIntro()
          }}
        >
          Replay the intro guide
        </button>
      </div>

      <div className="center" style={{ display: 'grid', justifyItems: 'center', gap: 8, marginTop: 8 }}><AppMark size={28} /></div>
      <p className="tiny muted center" style={{ marginTop: 0 }}>
        FitnessApp v{__APP_VERSION__} · Exercise data from free-exercise-db (public domain)
      </p>
    </div>
  )
}
