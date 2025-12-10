import { BentoCard } from '@/components/BentoCard'
import { EmptyState } from '@/components/EmptyState'
import { Target, Clock, Bot, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NowCardProps } from './NowCard.types'

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
          <div className="flex items-center gap-2 mb-3">
            {currentTask.pausedAt ? (
              <>
                <Pause className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Paused
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Working
                </span>
              </>
            )}
          </div>

          <p className="text-xl font-semibold leading-tight flex-1">
            {currentTask.task}
          </p>

          {currentTask.agent && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Bot className="h-3 w-3" />
              <span className="font-mono">{currentTask.agent}</span>
              {currentTask.agentConfidence !== undefined && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px]',
                  currentTask.agentConfidence >= 0.8 ? 'bg-emerald-500/10 text-emerald-600' :
                  currentTask.agentConfidence >= 0.5 ? 'bg-amber-500/10 text-amber-600' :
                  'bg-muted text-muted-foreground'
                )}>
                  {Math.round(currentTask.agentConfidence * 100)}% confidence
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-muted-foreground">
            {currentTask.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm">{currentTask.duration}</span>
              </div>
            )}
            {currentTask.estimatedDuration && (
              <span className="text-xs">
                / est. {currentTask.estimatedDuration}
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  currentTask.pausedAt ? "bg-muted-foreground" : "bg-amber-500 animate-pulse"
                )}
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
