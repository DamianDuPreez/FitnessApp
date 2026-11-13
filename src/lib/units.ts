import type { Unit } from '../db/types'

export const KG_PER_LB = 0.45359237

export function toDisplayWeight(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / KG_PER_LB
  return Math.round(v * 10) / 10
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function formatWeight(kg: number, unit: Unit): string {
  return `${toDisplayWeight(kg, unit)} ${unit}`
}

/** Large totals: 12 345 kg → "12.3 t" (or "27,216 lb"). */
export function formatVolume(kg: number, unit: Unit): string {
  if (unit === 'kg') {
    if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 100_000 ? 0 : 1)} t`
    return `${Math.round(kg)} kg`
  }
  return `${Math.round(kg / KG_PER_LB).toLocaleString()} lb`
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Plates per side for a target barbell weight (kg). */
export function platesPerSide(targetKg: number, barKg = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]): number[] {
  let remaining = (targetKg - barKg) / 2
  const out: number[] = []
  if (remaining <= 0) return out
  for (const p of plates) {
    while (remaining >= p - 1e-9) {
      out.push(p)
      remaining -= p
    }
  }
  return out
}
