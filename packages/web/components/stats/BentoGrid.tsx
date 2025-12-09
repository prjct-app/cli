import * as React from 'react'
import { cn } from '@/lib/utils'

interface BentoGridProps {
  className?: string
  children: React.ReactNode
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        'auto-rows-[minmax(140px,auto)]',
        className
      )}
    >
      {children}
    </div>
  )
}
