import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  command?: string
  href?: string
  className?: string
  compact?: boolean
}
