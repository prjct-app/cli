'use client'

import { useEffect, useState } from 'react'
import { SparklineChart } from '@/components/SparklineChart'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Flame, TrendingUp, Activity, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MomentumWidgetProps, MomentumData, MomentumStatus } from './MomentumWidget.types'

const statusConfig: Record<MomentumStatus, {
  color: string
  bgColor: string
  textColor: string
  icon: typeof Flame
}> = {
  // Growing - you're killing it!
  hot: {
    color: '#22c55e',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
    icon: Flame
  },
  // Normal activity - neutral tones
  active: {
    color: '#a1a1aa',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    icon: Activity
  },
  // Slight slowdown - still neutral
  cooling: {
    color: '#a1a1aa',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    icon: TrendingUp
  },
  // Abandoned (7+ days) - red alert
  cold: {
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
    icon: Heart
  }
}

export function MomentumWidget({ projectId }: MomentumWidgetProps) {
  const [data, setData] = useState<MomentumData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMomentum() {
      try {
        const res = await fetch(`/api/projects/${projectId}/momentum`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (error) {
        console.error('Failed to fetch momentum:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMomentum()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 animate-pulse">
        <div className="h-10 w-32 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
    )
  }

  if (!data) return null

  const config = statusConfig[data.status]
  const Icon = config.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-md cursor-default transition-colors',
          config.bgColor
        )}>
          {/* Mini sparkline - matching button width for visual weight */}
          <div className="w-32 h-10">
            <SparklineChart
              data={data.dailyTasks}
              color={config.color}
              height={40}
              showArea={true}
            />
          </div>

          {/* Status badge */}
          <div className={cn('flex items-center gap-1.5', config.textColor)}>
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">
              {data.message}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          <p className="font-medium">7-day activity</p>
          <p>{data.totalTasks} tasks, {data.totalShips} ships</p>
          {data.streak > 0 && (
            <p className="text-foreground font-medium">{data.streak} day streak!</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
