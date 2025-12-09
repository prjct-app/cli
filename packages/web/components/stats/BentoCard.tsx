import * as React from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type BentoSize = '1x1' | '1x2' | '2x1' | '2x2' | 'full'

const sizeClasses: Record<BentoSize, string> = {
  '1x1': 'col-span-1 row-span-1',
  '1x2': 'col-span-1 row-span-2',
  '2x1': 'col-span-2 row-span-1',
  '2x2': 'col-span-2 row-span-2',
  'full': 'col-span-full',
}

export interface BentoCardProps {
  size?: BentoSize
  title?: string
  count?: number | string
  icon?: LucideIcon
  accentColor?: 'default' | 'success' | 'warning' | 'destructive'
  className?: string
  headerClassName?: string
  children: React.ReactNode
}

const accentStyles: Record<NonNullable<BentoCardProps['accentColor']>, string> = {
  default: '',
  success: 'border-emerald-500/20 bg-emerald-500/5',
  warning: 'border-amber-500/20 bg-amber-500/5',
  destructive: 'border-destructive/20 bg-destructive/5',
}

export function BentoCard({
  size = '1x1',
  title,
  count,
  icon: Icon,
  accentColor = 'default',
  className,
  headerClassName,
  children,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-4 transition-all duration-200',
        'hover:shadow-md hover:border-foreground/20',
        sizeClasses[size],
        accentStyles[accentColor],
        className
      )}
    >
      {(title || count !== undefined || Icon) && (
        <div className={cn('flex items-center justify-between mb-3', headerClassName)}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            {title && (
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {title}
              </span>
            )}
          </div>
          {count !== undefined && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function BentoCardSkeleton({ size = '1x1' }: { size?: BentoSize }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 animate-pulse',
        sizeClasses[size]
      )}
    >
      <div className="h-3 w-16 bg-muted rounded mb-3" />
      <div className="h-6 w-24 bg-muted rounded mb-2" />
      <div className="h-3 w-full bg-muted rounded" />
    </div>
  )
}
