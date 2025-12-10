import type { LucideIcon } from 'lucide-react'

export type BentoSize = '1x1' | '1x2' | '2x1' | '2x2' | 'full'
export type AccentColor = 'default' | 'success' | 'warning' | 'destructive'

export interface BentoCardProps {
  size?: BentoSize
  title?: string
  count?: number | string
  icon?: LucideIcon
  accentColor?: AccentColor
  className?: string
  headerClassName?: string
  children: React.ReactNode
}
