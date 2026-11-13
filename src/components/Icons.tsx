import {
  Bus, CalendarCheck, CalendarDays, CalendarHeart, CalendarRange, Car, CloudLightning, Compass, Crown, Disc3,
  Dumbbell, Flame, Gauge, Landmark, Layers, Library, Link2, Map, Medal, Mountain, Plane, Repeat, Shield,
  Ship, Sprout, Swords, Timer, TrainFront, Trophy, Truck, Zap, type LucideIcon,
} from 'lucide-react'
import type { RecordType } from '../db/types'

/** Icons referenced by name from pure logic (achievements). */
export const ICONS: Record<string, LucideIcon> = {
  Bus, CalendarCheck, CalendarDays, CalendarHeart, CalendarRange, Car, CloudLightning, Compass, Crown, Disc3,
  Dumbbell, Flame, Gauge, Landmark, Layers, Library, Link2, Map, Medal, Mountain, Plane, Repeat, Shield,
  Ship, Sprout, Swords, Timer, TrainFront, Trophy, Truck, Zap,
}

export const RECORD_ICONS: Record<RecordType, LucideIcon> = {
  e1rm: Trophy,
  weight: Dumbbell,
  reps: Repeat,
  volume: Layers,
  duration: Timer,
}

export function RecordIcons({ types, size = 13 }: { types: RecordType[]; size?: number }) {
  return (
    <span className="medals" aria-label="Personal records">
      {types.map((t) => {
        const I = RECORD_ICONS[t]
        return <I key={t} size={size} strokeWidth={2.2} />
      })}
    </span>
  )
}

/** App mark: angular dumbbell in the CodeSolve style. */
export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d90ff" />
          <stop offset="1" stopColor="#3d4fd6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0d1119" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="rgba(255,255,255,.1)" />
      <path d="M8 25 L14 21 L14 43 L8 39 Z" fill="#607d8b" />
      <path d="M16 15 L23 11 L23 53 L16 49 Z" fill="url(#mk)" />
      <path d="M23 29 L41 29 L41 35 L23 35 Z" fill="#e9edf6" opacity="0.9" />
      <path d="M41 11 L48 15 L48 49 L41 53 Z" fill="url(#mk)" />
      <path d="M50 21 L56 25 L56 39 L50 43 Z" fill="#607d8b" />
    </svg>
  )
}
