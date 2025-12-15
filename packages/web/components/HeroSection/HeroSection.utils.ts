export type AccentColor = 'default' | 'success' | 'warning' | 'destructive'

// Completion rate color: traffic light based on project progress
// Green >= 75% (almost done!)
// Yellow 25-74% (good progress)
// Red < 25% (just getting started)
export function getCompletionColor(rate: number): AccentColor {
  if (rate >= 75) return 'success'
  if (rate >= 25) return 'warning'
  return 'destructive'
}
