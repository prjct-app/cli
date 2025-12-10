import { cn } from '@/lib/utils'
import type { BentoGridProps } from './BentoGrid.types'

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid',
        'gap-3 sm:gap-4',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        'auto-rows-[minmax(120px,auto)] sm:auto-rows-[minmax(140px,auto)]',
        className
      )}
    >
      {children}
    </div>
  )
}
