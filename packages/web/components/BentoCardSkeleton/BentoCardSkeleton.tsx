import { cn } from '@/lib/utils'
import { BENTO_SIZE_CLASSES } from './BentoCardSkeleton.constants'
import type { BentoCardSkeletonProps } from './BentoCardSkeleton.types'

export function BentoCardSkeleton({ size = '1x1' }: BentoCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 animate-pulse',
        BENTO_SIZE_CLASSES[size]
      )}
    >
      <div className="h-3 w-16 bg-muted rounded mb-3" />
      <div className="h-6 w-24 bg-muted rounded mb-2" />
      <div className="h-3 w-full bg-muted rounded" />
    </div>
  )
}
