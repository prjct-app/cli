import { SparklineChart } from '@/components/SparklineChart'
import type { WeeklySparklineProps } from './WeeklySparkline.types'

export function WeeklySparkline({ data }: WeeklySparklineProps) {
  return (
    <div className="w-full sm:w-32">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 md:text-right">
        7-day activity
      </p>
      <SparklineChart data={data} height={40} />
    </div>
  )
}
