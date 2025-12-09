'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { ProgressRing } from './ProgressRing'
import { SparklineChart } from './SparklineChart'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

interface HeroSectionProps {
  projectId: string
  projectName: string
  tasksCompleted: number
  healthScore: number
  velocity: number
  velocityChange: number
  insightMessage: string
  timeline?: TimelineEvent[]
}

// Animated count-up hook
function useCountUp(target: number, duration: number = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) {
      setCount(0)
      return
    }

    let start = 0
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(easeOut * target)

      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(target)
      }
    }

    requestAnimationFrame(animate)
  }, [target, duration])

  return count
}

// Calculate 7-day activity data from timeline
function getWeeklyActivityData(timeline: TimelineEvent[]): number[] {
  const today = new Date()
  const counts: number[] = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const count = timeline.filter(e => {
      if (!e.ts) return false
      return e.ts.startsWith(dateStr)
    }).length

    counts.push(count)
  }

  return counts
}

export function HeroSection({
  projectId,
  projectName,
  tasksCompleted,
  healthScore,
  velocity,
  velocityChange,
  insightMessage,
  timeline = [],
}: HeroSectionProps) {
  const animatedCount = useCountUp(tasksCompleted)
  const weeklyData = useMemo(() => getWeeklyActivityData(timeline), [timeline])

  const healthColor = healthScore >= 70 ? 'success' : healthScore >= 40 ? 'warning' : 'destructive'

  return (
    <div className="relative mb-8">
      {/* Background gradient based on health */}
      <div
        className={cn(
          'absolute inset-0 -m-8 rounded-2xl opacity-30 blur-3xl transition-colors duration-1000',
          healthScore >= 70 && 'bg-gradient-to-br from-emerald-500/20 to-transparent',
          healthScore >= 40 && healthScore < 70 && 'bg-gradient-to-br from-amber-500/20 to-transparent',
          healthScore < 40 && 'bg-gradient-to-br from-destructive/20 to-transparent'
        )}
      />

      <div className="relative flex items-start justify-between">
        {/* Left: Health ring + Main metric */}
        <div className="flex items-start gap-6">
          <ProgressRing
            value={healthScore}
            size="xl"
            accentColor={healthColor}
          />

          <div>
            {/* Tasks completed - big number */}
            <div className="flex items-baseline gap-3">
              <span className="text-7xl font-bold tracking-tighter tabular-nums">
                {animatedCount}
              </span>
              <span className="text-lg text-muted-foreground">tasks completed</span>
            </div>

            {/* Velocity trend */}
            {velocityChange !== 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-md',
                    velocityChange >= 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {velocityChange >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {velocityChange >= 0 ? '+' : ''}{velocityChange}%
                </span>
                <span className="text-sm text-muted-foreground">vs last week</span>
              </div>
            )}

            {/* Insight message */}
            <p className="text-muted-foreground mt-3 max-w-md">{insightMessage}</p>
          </div>
        </div>

        {/* Right: Sparkline + Navigation */}
        <div className="flex flex-col items-end gap-4">
          <Link
            href={`/project/${projectId}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {projectName}
          </Link>

          {/* 7-day sparkline */}
          <div className="w-32">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-right">
              7-day activity
            </p>
            <SparklineChart data={weeklyData} height={40} />
          </div>
        </div>
      </div>
    </div>
  )
}
