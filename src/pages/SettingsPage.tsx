import { useEffect, useRef, useState } from 'react'
import { requestPersistentStorage, updateSettings } from '../db/db'
import { checkAchievements } from '../db/workouts'
import { useSettings } from '../hooks'
import { backupFileName, downloadBlob, exportBackup, importBackup } from '../lib/backup'
import { isIOS, isStandalone, parseNum } from '../lib/format'
import { fromDisplayWeight, toDisplayWeight } from '../lib/units'
import { useToast } from '../components/Toasts'
import { DEFAULT_SETTINGS, type Unit } from '../db/types'

export function SettingsPage() {
  const s = useSettings()
  const toast = useToast()
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
      toast({ title: '✅ Backup restored', body: `${workouts} workout${workouts === 1 ? '' : 's'} imported` })
    } catch (e) {
      toast({ title: 'Import failed', body: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}><h1>Settings</h1></div>

      <div className="card stack">
        <h2>Training</h2>
        <label className="field">
          Units
          <div className="chips">
            {(['kg', 'lb'] as Unit[]).map((u) => (
              <button key={u} className={`chip ${s.unit === u ? 'on' : ''}`} style={{ textTransform: 'none' }} onClick={() => updateSettings({ unit: u })}>{u}</button>
            ))}
          </div>
        </label>
        <label className="field">
          Weekly goal (workouts per week)
          <div className="chips">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={`chip ${s.weeklyGoal === n ? 'on' : ''}`} onClick={() => updateSettings({ weeklyGoal: n })}>{n}</button>
            ))}
          </div>
        </label>
        <label className="field">
          Default rest timer
          <div className="chips">
            {[0, 60, 90, 120, 180, 240].map((n) => (
              <button key={n} className={`chip ${s.defaultRestSec === n ? 'on' : ''}`} style={{ textTransform: 'none' }} onClick={() => updateSettings({ defaultRestSec: n })}>
                {n === 0 ? 'Off' : n < 120 ? `${n}s` : `${n / 60} min`}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          Bodyweight ({s.unit}) <span className="tiny muted" style={{ fontWeight: 400 }}>optional, for future strength levels</span>
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
          <div className="chips">
            {[20, 15, 10].map((n) => (
              <button key={n} className={`chip ${s.barWeightKg === n ? 'on' : ''}`} style={{ textTransform: 'none' }} onClick={() => updateSettings({ barWeightKg: n })}>{n} kg</button>
            ))}
          </div>
        </label>
      </div>

      <div className="card stack">
        <h2>Your data</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Everything is stored only on this device. Make a backup now and then, especially before changing phones.
        </p>
        <button
          className="btn block"
          onClick={async () => {
            downloadBlob(await exportBackup(), backupFileName())
            toast({ title: '💾 Backup downloaded' })
          }}
        >
          ⬇ Export backup
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
        <div className="small">
          Storage protection:{' '}
          {persisted ? (
            <b style={{ color: 'var(--success)' }}>On ✓</b>
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
          <p className="small" style={{ margin: 0 }}>✅ Installed. You're using the app version.</p>
        ) : isIOS() ? (
          <p className="small" style={{ margin: 0 }}>In <b>Safari</b>, tap <b>Share</b> → <b>Add to Home Screen</b>. Installing keeps your data safe and makes it work like a real app, even offline.</p>
        ) : (
          <p className="small" style={{ margin: 0 }}>Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
        )}
      </div>

      <p className="tiny muted center">
        FitnessApp v{__APP_VERSION__} · Exercise data from free-exercise-db (public domain)
      </p>
    </div>
  )
}
