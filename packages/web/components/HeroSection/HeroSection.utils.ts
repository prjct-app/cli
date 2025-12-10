export type AccentColor = 'default' | 'success' | 'warning' | 'destructive'

export function getHealthColor(score: number): AccentColor {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'destructive'
}
