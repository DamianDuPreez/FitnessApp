import { db } from '../db/db'

const FORMAT = 'fitness-app-backup'
const VERSION = 1

export async function exportBackup(): Promise<Blob> {
  const data = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
    customExercises: await db.exercises.filter((e) => !!e.isCustom).toArray(),
    achievements: await db.achievements.toArray(),
    settings: await db.settings.toArray(),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export function backupFileName(): string {
  return `fitnessapp-backup-${new Date().toISOString().slice(0, 10)}.json`
}

/** Replaces all workout data with the backup's contents. */
export async function importBackup(file: File): Promise<{ workouts: number }> {
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not a FitnessApp backup.')
  }
  if (data?.format !== FORMAT || !Array.isArray(data.workouts) || !Array.isArray(data.sets)) {
    throw new Error('This file is not a FitnessApp backup.')
  }
  await db.transaction('rw', [db.workouts, db.sets, db.exercises, db.achievements, db.settings], async () => {
    await db.workouts.clear()
    await db.sets.clear()
    await db.achievements.clear()
    await db.exercises.filter((e) => !!e.isCustom).delete()
    await db.workouts.bulkAdd(data.workouts)
    await db.sets.bulkAdd(data.sets)
    if (Array.isArray(data.customExercises)) await db.exercises.bulkPut(data.customExercises)
    if (Array.isArray(data.achievements)) await db.achievements.bulkPut(data.achievements)
    if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings)
  })
  return { workouts: data.workouts.length }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
