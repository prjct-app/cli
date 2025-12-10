import type { AccentColor } from './HealthGradientBackground.types'

export function getHealthColor(score: number): AccentColor {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'destructive'
}

export function getHealthGradient(score: number): string {
  if (score >= 70) return 'bg-gradient-to-br from-emerald-500/20 to-transparent'
  if (score >= 40) return 'bg-gradient-to-br from-amber-500/20 to-transparent'
  return 'bg-gradient-to-br from-destructive/20 to-transparent'
}
