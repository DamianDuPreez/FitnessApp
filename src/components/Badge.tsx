import { Award } from 'lucide-react'
import { TIERS, type Family } from '../lib/achievements'
import { ICONS } from './Icons'

/** Bronze, Silver, Gold, Platinum, Diamond, Legend (CodeSolve blue) */
export const TIER_COLORS = ['#c98b5a', '#b9c4d4', '#f0c35a', '#7fe0d6', '#9fb0ff', '#536dfe']

export function Badge({ family, level, locked, size = 60 }: { family: Family; level: number; locked?: boolean; size?: number }) {
  const l = family.levels[level]
  const Icon = ICONS[l.icon] ?? Award
  return (
    <div
      className={`badge ${locked ? 'locked' : ''}`}
      style={{ ['--tier' as string]: TIER_COLORS[Math.min(level, TIER_COLORS.length - 1)], width: size, height: size * 1.08 }}
      title={`${family.name}: ${l.title} (${TIERS[Math.min(level, TIERS.length - 1)]})`}
    >
      <Icon size={size * 0.4} strokeWidth={1.8} />
    </div>
  )
}
