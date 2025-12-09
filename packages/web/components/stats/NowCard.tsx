'use client'

import { BentoCard } from './BentoCard'
import { EmptyState } from './EmptyState'
import { Target, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CurrentTask {
  task: string
  duration?: string
  startedAt?: string
}

interface NowCardProps {
  currentTask: CurrentTask | null
  className?: string
}

export function NowCard({ currentTask, className }: NowCardProps) {
  return (
    <BentoCard
      size="2x2"
      title="Now"
      icon={Target}
      accentColor={currentTask ? 'warning' : 'default'}
      className={className}
    >
      {currentTask ? (
        <div className="flex flex-col h-full">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Working
            </span>
          </div>

          {/* Task name */}
          <p className="text-xl font-semibold leading-tight flex-1">
            {currentTask.task}
          </p>

          {/* Duration */}
          {currentTask.duration && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm">{currentTask.duration} elapsed</span>
            </div>
          )}

          {/* Progress visualization - simple bar */}
          <div className="mt-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="No active task"
          description="Start working on something"
          command="/p:now"
        />
      )}
    </BentoCard>
  )
}
