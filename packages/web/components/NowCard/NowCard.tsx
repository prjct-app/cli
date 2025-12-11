'use client'

import { EmptyState } from '@/components/EmptyState'
import { Target, Clock, Bot, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NowCardProps } from './NowCard.types'

export function NowCard({ currentTask, codeHref, className }: NowCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Now
          </span>
        </div>
        {currentTask && (
          <div className="flex items-center gap-2">
            {currentTask.pausedAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <Pause className="w-2.5 h-2.5" />
                Paused
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full">
                <Play className="w-2.5 h-2.5 fill-current" />
                Working
              </span>
            )}
          </div>
        )}
      </div>

      {currentTask ? (
        <div className="space-y-3">
          <p className="text-sm font-medium leading-tight">
            {currentTask.task}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {currentTask.agent && (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                <Bot className="h-3 w-3" />
                <span className="font-mono">{currentTask.agent}</span>
              </div>
            )}

            {currentTask.startedAt && (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Started {new Date(currentTask.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}

            {currentTask.estimatedDuration && (
              <span className="text-xs text-muted-foreground">
                Est. {currentTask.estimatedDuration}
              </span>
            )}
          </div>

          {/* Progress indicator */}
          <div className="pt-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-foreground"
                style={{ width: currentTask.pausedAt ? '30%' : '60%' }}
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
          href={codeHref}
        />
      )}
    </div>
  )
}
