import { TIERS, type Family } from '../lib/achievements'

export const TIER_COLORS = ['#cd7f32', '#b8c2cc', '#ffc83d', '#7fe0d6', '#8ab4ff', '#ff6b2c']

export function Badge({ family, level, locked, size = 56 }: { family: Family; level: number; locked?: boolean; size?: number }) {
  const l = family.levels[level]
  return (
    <div
      className={`badge ${locked ? 'locked' : ''}`}
      style={{ ['--tier' as string]: TIER_COLORS[Math.min(level, TIER_COLORS.length - 1)], width: size, height: size, fontSize: size * 0.48 }}
      title={`${family.name}: ${l.title} (${TIERS[Math.min(level, TIERS.length - 1)]})`}
    >
      {l.emoji}
    </div>
  )
}
