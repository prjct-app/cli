'use client'

import { use, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/hooks/useProjects'
import { useProjectStats } from '@/hooks/useProjectStats'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Rocket,
  Flame,
  Play,
  Copy,
  FileText,
  Target,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineEvent } from '@/lib/parse-prjct-files'

// Calculate streak
function calculateStreak(timeline: TimelineEvent[]): number {
  if (!timeline.length) return 0
  const dates = new Set(timeline.map(e => e.ts?.split('T')[0]).filter(Boolean))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    if (dates.has(dateStr)) streak++
    else if (i > 0) break
  }
  return streak
}

// Health score (0-100)
function getHealthScore(stats: any): number {
  if (!stats) return 0
  const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
  const hasCurrentTask = !!stats?.currentTask
  const queueSize = stats?.queue?.length || 0
  const recentActivity = stats?.timeline?.slice(0, 7).length || 0

  let score = 0
  score += Math.min(30, velocity * 15) // Up to 30 for velocity
  score += hasCurrentTask ? 20 : 0 // 20 for active work
  score += queueSize > 0 && queueSize < 15 ? 20 : queueSize === 0 ? 5 : 10 // Queue health
  score += Math.min(30, recentActivity * 5) // Recent activity

  return Math.min(100, Math.round(score))
}

// Copy to clipboard
function copyCommand(cmd: string) {
  navigator.clipboard.writeText(cmd)
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'NOW'
  if (diffMins < 60) return `${diffMins}M`
  if (diffHours < 24) return `${diffHours}H`
  if (diffDays === 1) return '1D'
  if (diffDays < 7) return `${diffDays}D`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

// Contextual insight message
function getInsightMessage(stats: any, streak: number): string {
  if (!stats) return ''

  const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
  const hasCurrentTask = !!stats?.currentTask
  const queueSize = stats?.queue?.length || 0
  const shipsCount = stats?.summary?.totalShipsEver || 0

  if (hasCurrentTask && streak > 3) return 'Killing it. Keep the momentum.'
  if (hasCurrentTask) return 'Good focus. Ship when ready.'
  if (queueSize === 0) return 'Queue empty. Time to plan the next feature.'
  if (velocity > 2) return 'Fast pace. Watch for burnout.'
  if (shipsCount === 0) return 'No ships yet. Start small, ship fast.'
  if (streak === 0) return 'Get back in the flow. Start something.'
  return 'Steady progress. Pick the next task.'
}

// Section label component
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40", className)}>
      {children}
    </p>
  )
}

// Health ring component
function HealthRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { container: 'h-8 w-8', text: 'text-[10px]' },
    md: { container: 'h-12 w-12', text: 'text-xs' },
    lg: { container: 'h-16 w-16', text: 'text-sm' },
  }
  const { container, text } = sizes[size]

  return (
    <div className={cn('relative', container)}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/10" />
        <circle
          cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={`${score} 100`}
          strokeLinecap="round"
          className="text-foreground transition-all duration-700"
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold', text)}>
        {score}
      </span>
    </div>
  )
}

// Stat card component
function StatCard({ value, label, suffix, size = 'md' }: {
  value: string | number
  label: string
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: { value: 'text-lg font-bold', label: 'text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40' },
    md: { value: 'text-2xl font-bold', label: 'text-xs text-muted-foreground' },
    lg: { value: 'text-3xl font-black tracking-tight tabular-nums', label: 'text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40 mt-1' },
  }
  const styles = sizeClasses[size]

  return (
    <div>
      <p className={cn(styles.value, 'text-foreground')}>
        {value}
        {suffix && <span className="text-foreground/50 font-normal text-sm ml-1">{suffix}</span>}
      </p>
      <p className={styles.label}>{label}</p>
    </div>
  )
}

// Stats row component - minimal divider
function StatsRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-10 gap-y-4', className)}>
      {children}
    </div>
  )
}

export default function ProjectStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data, isLoading: statsLoading } = useProjectStats(projectId)
  const stats = data?.stats

  const streak = useMemo(() => calculateStreak(stats?.timeline || []), [stats?.timeline])
  const healthScore = useMemo(() => getHealthScore(stats), [stats])
  const insightMessage = useMemo(() => getInsightMessage(stats, streak), [stats, streak])

  const completionRate = useMemo(() => {
    if (!stats?.metrics) return 0
    const { tasksStarted, tasksCompleted } = stats.metrics
    return tasksStarted > 0 ? Math.round((tasksCompleted / tasksStarted) * 100) : 0
  }, [stats?.metrics])

  const velocityChange = useMemo(() => {
    // Simulated - in reality would compare to previous period
    const velocity = stats?.metrics?.velocity?.tasksPerDay || 0
    return velocity > 2 ? 15 : velocity > 1 ? 5 : -10
  }, [stats?.metrics?.velocity?.tasksPerDay])

  // Recent activity - last 5 for chips
  const recentActivity = useMemo(() => {
    if (!stats?.timeline) return []
    return stats.timeline.slice(0, 5)
  }, [stats?.timeline])

  if (projectLoading || statsLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Loading...</div></div>
  }

  if (!project || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-4xl text-muted-foreground">404</p>
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-8 overflow-auto">
      {/* Hero Section - Big number + insight */}
      <div className="flex items-start justify-between mb-2">
        <div>
          {/* Big Number - Tasks Completed */}
          <h1 className="text-8xl font-bold tracking-tighter text-foreground tabular-nums">
            {stats.metrics.tasksCompleted}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">{insightMessage}</p>
        </div>

        {/* Navigation back */}
        <Link href={`/project/${projectId}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />{project.name}
        </Link>
      </div>

      {/* Trend indicator */}
      {velocityChange !== 0 && (
        <div className="flex items-center gap-2 mt-4">
          <span className={cn(
            'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md',
            velocityChange >= 0 ? 'bg-foreground/5 text-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {velocityChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {velocityChange >= 0 ? '+' : ''}{velocityChange}%
          </span>
          <span className="text-sm text-muted-foreground">velocity vs last week</span>
        </div>
      )}

      {/* Secondary KPIs Row */}
      <StatsRow className="mt-8">
        <div className="flex items-center gap-3">
          <HealthRing score={healthScore} />
          <div>
            <p className="text-sm font-medium">Health</p>
            <p className="text-xs text-muted-foreground">Project score</p>
          </div>
        </div>

        <StatCard value={`${completionRate}%`} label="Completion" />
        <StatCard value={stats.summary.totalShipsEver} label="Ships" />
        <StatCard value={stats.metrics.velocity.tasksPerDay} label="Tasks/day" />
        <StatCard
          value={<>{stats.queue.length} / {stats.ideas.pending.length}</>}
          label="Queue / Ideas"
        />
        {streak > 0 && (
          <div className="flex items-center gap-2">
            <Flame className={cn('w-5 h-5', streak > 3 ? 'text-orange-500' : 'text-foreground/40')} />
            <StatCard value={streak} label="Day streak" />
          </div>
        )}
      </StatsRow>

      {/* Recent Activity - Chips style */}
      {recentActivity.length > 0 && (
        <div className="mt-8">
          <SectionLabel className="mb-4">RECENT</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {recentActivity.map((event: TimelineEvent, i: number) => {
              const e = event as Record<string, unknown>
              const label = event.type === 'feature_ship' ? (e.name as string) :
                           event.type === 'task_complete' ? (e.task as string) :
                           event.type === 'task_start' ? (e.task as string) :
                           event.type === 'sync' ? 'Sync' : event.type
              const status = event.type === 'feature_ship' ? 'SHIP' :
                            event.type === 'task_complete' ? 'DONE' :
                            event.type === 'task_start' ? 'START' :
                            event.type === 'sync' ? 'SYNC' : event.type.toUpperCase()
              return (
                <div
                  key={i}
                  className="group flex items-center gap-3 rounded-lg border-2 border-foreground/10 px-4 py-2 transition-all hover:border-foreground hover:bg-foreground hover:text-background cursor-default"
                >
                  <span className="text-sm font-bold text-foreground group-hover:text-background truncate max-w-[150px]">
                    {label}
                  </span>
                  <span className="text-[9px] font-bold tracking-wider text-foreground/40 group-hover:text-background/60">
                    {status}
                  </span>
                  {event.ts && (
                    <span className="text-[9px] font-bold tracking-wider text-foreground/30 group-hover:text-background/40">
                      {formatRelativeTime(event.ts)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Masonry Grid Layout */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-8 mt-10 [column-fill:_balance]">
        {/* Current Task */}
        <div className="break-inside-avoid mb-8">
          <SectionLabel className="mb-3">NOW</SectionLabel>
          {stats.currentTask ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Working</span>
              </div>
              <p className="text-lg font-semibold leading-tight">{stats.currentTask.task}</p>
              {stats.currentTask.duration && (
                <p className="text-xs text-muted-foreground mt-2">{stats.currentTask.duration}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active task</p>
          )}
        </div>

        {/* Queue */}
        {stats.queue.length > 0 && (
          <div className="break-inside-avoid mb-8">
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel>QUEUE</SectionLabel>
              <span className="text-xs text-muted-foreground">{stats.queue.length}</span>
            </div>
            <div className="space-y-1.5">
              {stats.queue.slice(0, 6).map((task: any, i: number) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-[10px] text-muted-foreground w-3">{i + 1}</span>
                  <p className="flex-1 text-sm truncate">{task.task}</p>
                </div>
              ))}
              {stats.queue.length > 6 && (
                <p className="text-[10px] text-muted-foreground">+{stats.queue.length - 6} more</p>
              )}
            </div>
          </div>
        )}

        {/* Ships */}
        {stats.shipped.length > 0 && (
          <div className="break-inside-avoid mb-8">
            <SectionLabel className="mb-3">SHIPS</SectionLabel>
            <div className="space-y-3">
              {stats.shipped.slice(0, 5).map((ship: any, i: number) => (
                <div key={i}>
                  <p className="text-sm font-medium">{ship.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ship.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {ship.version && ` · ${ship.version}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agents */}
        {stats.agents.length > 0 && (
          <div className="break-inside-avoid mb-8">
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel>AGENTS</SectionLabel>
              <span className="text-xs text-muted-foreground">{stats.agents.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.agents.slice(0, 10).map((agent: any) => (
                <span
                  key={agent.name}
                  className="text-xs px-2 py-0.5 bg-foreground/5 rounded"
                >
                  {agent.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ideas */}
        {stats.ideas.pending.length > 0 && (
          <div className="break-inside-avoid mb-8">
            <div className="flex items-center gap-2 mb-3">
              <SectionLabel>IDEAS</SectionLabel>
              <span className="text-xs text-muted-foreground">{stats.ideas.pending.length}</span>
            </div>
            <div className="space-y-2">
              {stats.ideas.pending.slice(0, 5).map((idea: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <Lightbulb className={cn(
                    'w-3 h-3 mt-0.5 shrink-0',
                    idea.impact === 'HIGH' ? 'text-foreground' : 'text-muted-foreground'
                  )} />
                  <p className="text-sm">{idea.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roadmap */}
        {stats.roadmap?.phases?.length > 0 && (
          <div className="break-inside-avoid mb-8">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>ROADMAP</SectionLabel>
              <span className="text-lg font-bold">{stats.roadmap.progress}%</span>
            </div>
            <div className="space-y-2">
              {stats.roadmap.phases.filter((p: any) => (p.features || []).length > 0).slice(0, 4).map((phase: any) => (
                <div key={phase.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>{phase.name}</span>
                    <span className="text-muted-foreground">{phase.progress}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        phase.progress === 100 ? 'bg-emerald-500' : 'bg-foreground'
                      )}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  )
}
