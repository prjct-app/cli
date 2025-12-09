'use client'

import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number // 0-100
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showValue?: boolean
  strokeWidth?: number
  className?: string
  accentColor?: 'default' | 'success' | 'warning' | 'destructive'
}

const sizes = {
  sm: { container: 'h-8 w-8', text: 'text-[10px]', viewBox: 36, radius: 14 },
  md: { container: 'h-12 w-12', text: 'text-xs', viewBox: 36, radius: 14 },
  lg: { container: 'h-16 w-16', text: 'text-sm', viewBox: 36, radius: 14 },
  xl: { container: 'h-20 w-20', text: 'text-base', viewBox: 36, radius: 14 },
}

const colorStyles = {
  default: 'text-foreground',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  destructive: 'text-destructive',
}

export function ProgressRing({
  value,
  size = 'md',
  showValue = true,
  strokeWidth = 3,
  className,
  accentColor = 'default',
}: ProgressRingProps) {
  const { container, text, viewBox, radius } = sizes[size]
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className={cn('relative', container, className)}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${viewBox} ${viewBox}`}>
        {/* Background ring */}
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-foreground/10"
        />
        {/* Progress ring */}
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
          className={cn('transition-all duration-700 ease-out', colorStyles[accentColor])}
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
