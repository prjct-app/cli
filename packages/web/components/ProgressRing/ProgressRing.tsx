'use client'

import { cn } from '@/lib/utils'
import { PROGRESS_RING_SIZES, PROGRESS_RING_COLOR_STYLES } from './ProgressRing.constants'
import type { ProgressRingProps } from './ProgressRing.types'

export function ProgressRing({
  value,
  size = 'md',
  showValue = true,
  strokeWidth = 3,
  className,
  accentColor = 'default',
}: ProgressRingProps) {
  const { container, text, viewBox, radius } = PROGRESS_RING_SIZES[size]
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className={cn('relative', container, className)}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-foreground/10"
        />
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-700 ease-out', PROGRESS_RING_COLOR_STYLES[accentColor])}
        />
      </svg>
      {showValue && (
        <span className={cn('absolute inset-0 flex items-center justify-center font-bold tabular-nums', text)}>
          {value}
        </span>
      )}
    </div>
  )
}
