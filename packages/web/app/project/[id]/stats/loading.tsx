import { BentoGrid } from '@/components/BentoGrid'
import { BentoCardSkeleton } from '@/components/BentoCardSkeleton'

export default function StatsLoading() {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Hero skeleton */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pl-10 md:pl-0">
        <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-muted animate-pulse" />
        <div className="space-y-3 text-center sm:text-left">
          <div className="h-12 md:h-16 w-24 md:w-32 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
          <div className="h-4 w-40 md:w-48 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
        </div>
      </div>

      {/* Bento grid skeleton */}
      <BentoGrid>
        <BentoCardSkeleton size="2x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="2x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="1x2" />
        <BentoCardSkeleton size="1x2" />
        <BentoCardSkeleton size="1x1" />
        <BentoCardSkeleton size="1x1" />
      </BentoGrid>

      {/* Timeline skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
              <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
