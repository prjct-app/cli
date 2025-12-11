import type { ProgressRingSize, AccentColor } from './ProgressRing.types'

export const PROGRESS_RING_SIZES: Record<ProgressRingSize, {
  container: string
  text: string
  viewBox: number
  radius: number
}> = {
  sm: { container: 'h-8 w-8', text: 'text-xs', viewBox: 36, radius: 14 },
  md: { container: 'h-12 w-12', text: 'text-xs', viewBox: 36, radius: 14 },
  lg: { container: 'h-16 w-16', text: 'text-sm', viewBox: 36, radius: 14 },
  xl: { container: 'h-20 w-20', text: 'text-base', viewBox: 36, radius: 14 },
}

export const PROGRESS_RING_COLOR_STYLES: Record<AccentColor, string> = {
  default: 'text-foreground',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  destructive: 'text-destructive',
}
