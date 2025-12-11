'use client'

import { SparklineChart } from '@/components/SparklineChart'
import type { WeeklySparklineProps } from './WeeklySparkline.types'

const sizeConfig = {
  sm: { width: 'w-full sm:w-24', height: 32 },
  md: { width: 'w-full sm:w-32', height: 40 },
  lg: { width: 'w-full sm:w-48', height: 56 },
}

export function WeeklySparkline({ data, size = 'md' }: WeeklySparklineProps) {
  const config = sizeConfig[size]

  return (
    <div className={config.width}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 md:text-right">
        7-day activity
      </p>
      <SparklineChart data={data} height={config.height} />
    </div>
  )
}
