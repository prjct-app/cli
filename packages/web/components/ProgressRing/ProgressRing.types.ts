export type ProgressRingSize = 'sm' | 'md' | 'lg' | 'xl'
export type AccentColor = 'default' | 'success' | 'warning' | 'destructive'

export interface ProgressRingProps {
  value: number
  size?: ProgressRingSize
  showValue?: boolean
  strokeWidth?: number
  className?: string
  accentColor?: AccentColor
}
