'use client'

import Link from 'next/link'
import { Play, FileText } from 'lucide-react'
import { ProgressRing } from '@/components/ProgressRing'
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

      <div className="relative z-10 flex items-center justify-between my-16">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">{projectName}</h1>

        <div className="flex items-center gap-3">
          {/* Reports Link */}
          <Link
            href={`/project/${projectId}/reports`}
            className="inline-flex items-center gap-2 px-4 py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-all duration-200 hover:scale-105"
          >
            <FileText className="h-5 w-5" />
            <span>Reports</span>
          </Link>

          {/* Start Working CTA */}
          <Link
            href={`/project/${projectId}/code`}
            className="group relative inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:scale-105"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Start Working</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
          </Link>
        </div>
      </div>

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
          <WeeklySparkline data={weeklyData} size="lg" />
        </div>
      </div>
    </div>
  )
}
