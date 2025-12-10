'use client'

import { ProgressRing } from '@/components/ProgressRing'
import { BackLink } from '@/components/BackLink'
import { TasksCounter } from '@/components/TasksCounter'
import { VelocityBadge } from '@/components/VelocityBadge'
import { InsightMessage } from '@/components/InsightMessage'
import { WeeklySparkline } from '@/components/WeeklySparkline'
import { HealthGradientBackground } from '@/components/HealthGradientBackground'
import { useCountUp, useWeeklyActivity } from './hooks'
import { getHealthColor } from './HeroSection.utils'
import type { HeroProps } from './HeroSection.types'

export function HeroSection({
  projectId,
  projectName,
  tasksCompleted,
  healthScore,
  velocityChange,
  insightMessage,
  timeline = [],
}: HeroProps) {
  const animatedCount = useCountUp(tasksCompleted)
  const weeklyData = useWeeklyActivity(timeline)
  const healthColor = getHealthColor(healthScore)

  return (
    <div className="relative mb-6 md:mb-8">
      <HealthGradientBackground score={healthScore} />
      <BackLink projectId={projectId} projectName={projectName} className="md:hidden mb-4" />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-0">
        <div className="flex items-center md:items-start gap-4 md:gap-6">
          <ProgressRing
            value={healthScore}
            size="xl"
            accentColor={healthColor}
            className="shrink-0"
          />

          <div className="flex-1 min-w-0">
            <TasksCounter count={animatedCount} />
            <VelocityBadge change={velocityChange} />
            <InsightMessage message={insightMessage} />
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3 md:gap-4">
          <BackLink projectId={projectId} projectName={projectName} className="hidden md:flex" />
          <WeeklySparkline data={weeklyData} />
        </div>
      </div>
    </div>
  )
}
