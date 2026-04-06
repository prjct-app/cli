import { Check, Circle, Clock, Cpu, Inbox, Lightbulb, Pause, Play, Rocket, TrendingUp, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { typeColor, typeBg, TYPE_LABEL } from '@/lib/taskStyles'

export function OverviewTab() {
  const { data, projectId, refresh } = useTabCtx()
  const state = data.state || { currentTask: null, lastUpdated: '' }
  const stats = data.stats || { tasksToday: 0, tasksThisWeek: 0, queueCount: 0, ideasCount: 0, shippedCount: 0 }
  const analysis = data.analysis

  // Analytics data — lazy loaded, each section hides if no data
  const { data: metricsData } = useApi(() => api.metrics(projectId).catch(() => null), [projectId])
  const { data: velocityData } = useApi(() => api.velocity(projectId).catch(() => null), [projectId])
  const { data: healthData } = useApi(() => api.contextHealth(projectId).catch(() => null), [projectId])
  const { data: indexData } = useApi(() => api.projectIndex(projectId).catch(() => null), [projectId])
  const { data: stateFullData } = useApi(() => api.stateFull(projectId).catch(() => null), [projectId])
  const { data: roadmapData } = useApi(() => api.roadmapFull(projectId).catch(() => null), [projectId])

  const pausedTasks = (stateFullData as any)?.pausedTasks || []
  const metrics = metricsData as any
  const velocity = velocityData as any
  const health = healthData as any
  const idx = indexData as any

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="max-w-5xl mx-auto space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Today" value={stats.tasksToday} icon={Clock} />
        <StatCard label="This week" value={stats.tasksThisWeek} icon={Clock} />
        <StatCard label="Queue" value={stats.queueCount} icon={Inbox} href="../board" />
        <StatCard label="Ideas" value={stats.ideasCount} icon={Lightbulb} href="../ideas" />
        <StatCard label="Shipped" value={stats.shippedCount} icon={Rocket} href="../shipped" />
      </div>

      {/* Active task */}
      {state.currentTask ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-status-active animate-ping opacity-60" />
                    <span className="relative h-2 w-2 rounded-full bg-status-active" />
                  </span>
                  <span className="text-micro font-medium text-status-active uppercase tracking-wider">Active</span>
                  {state.currentTask.type && (
                    <span className={cn("text-micro font-medium rounded px-1.5 py-0.5", typeColor(state.currentTask.type), typeBg(state.currentTask.type))}>
                      {TYPE_LABEL[state.currentTask.type] || state.currentTask.type}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{state.currentTask.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-micro text-muted-foreground">
                  {state.currentTask.branch && <span className="font-mono">{state.currentTask.branch}</span>}
                  {state.currentTask.duration && <span>{state.currentTask.duration}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => api.pauseTask(projectId).then(refresh)}>
                  <Pause className="h-3 w-3 mr-1.5" /> Pause
                </Button>
                <Button size="sm" onClick={() => api.completeTask(projectId).then(refresh)}>
                  <Check className="h-3 w-3 mr-1.5" /> Done
                </Button>
              </div>
            </div>
            {state.currentTask.subtasks && state.currentTask.subtasks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {state.currentTask.subtasks.map((s, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-xs py-0.5", s.status === 'completed' ? 'text-muted-foreground line-through' : i === state.currentTask!.currentSubtaskIndex ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                    {s.status === 'completed'
                      ? <Check className="h-3 w-3 text-status-active shrink-0" />
                      : <Circle className={cn("h-3 w-3 shrink-0", i === state.currentTask!.currentSubtaskIndex && 'text-foreground')} />}
                    {s.description}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-0">
            <EmptyState icon={Zap} title="No active task" description="Start one from the Board, or run `prjct task` in your terminal"
              action={<Button size="sm" variant="outline" asChild><Link to="../board">Go to Board</Link></Button>} size="sm" />
          </CardContent>
        </Card>
      )}

      {/* Paused tasks */}
      {pausedTasks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-micro font-medium text-muted-foreground uppercase tracking-wider px-1">Paused</p>
          {pausedTasks.map((t: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-card px-3.5 py-3 flex items-center gap-3">
              <Pause className="h-3.5 w-3.5 text-status-blocked shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/70">{t.description}</p>
                {t.pauseReason && <p className="text-micro text-muted-foreground mt-0.5">{t.pauseReason}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => api.resumeTask(projectId).then(refresh)}>
                <Play className="h-3 w-3 mr-1.5" /> Resume
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Metrics row */}
      {metrics && (metrics.syncCount > 0 || metrics.totalTokensSaved > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Token Savings</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-semibold tabular-nums">{formatNum(metrics.totalTokensSaved)}</span>
                <span className="text-micro text-muted-foreground">tokens saved</span>
                {metrics.trend !== 0 && (
                  <span className={cn("text-micro font-medium px-1.5 py-0.5 rounded", metrics.trend > 0 ? "text-status-active bg-status-active-bg" : "text-destructive bg-destructive/10")}>
                    {metrics.trend > 0 ? '+' : ''}{metrics.trend.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(metrics.compressionRate * 100).toFixed(0)}% compression</span>
                <span>{metrics.syncCount} syncs</span>
              </div>
              {metrics.dailyStats && metrics.dailyStats.length > 0 && (
                <div className="flex items-end gap-px mt-3 h-8">
                  {metrics.dailyStats.slice(-30).map((d: any, i: number) => {
                    const max = Math.max(...metrics.dailyStats.slice(-30).map((x: any) => x.tokensSaved || 0), 1)
                    return <div key={i} className="flex-1 bg-foreground/10 rounded-sm min-w-[2px]" style={{ height: `${Math.max(2, (d.tokensSaved / max) * 100)}%` }} />
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Sync Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-semibold tabular-nums">{metrics.syncCount}</span>
                <span className="text-micro text-muted-foreground">total syncs</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Avg {(metrics.avgSyncDuration / 1000).toFixed(1)}s per sync</p>
              {metrics.topAgents && metrics.topAgents.length > 0 && (
                <div className="space-y-1">
                  {metrics.topAgents.slice(0, 3).map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate">{a.agentName}</span>
                      <span className="tabular-nums font-medium">{a.usageCount}x</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Velocity */}
      {velocity && velocity.sprints && velocity.sprints.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-2xl font-semibold tabular-nums">{velocity.averageVelocity.toFixed(1)}</span>
              <span className="text-micro text-muted-foreground">pts/sprint</span>
              <span className={cn("text-micro font-medium px-1.5 py-0.5 rounded capitalize",
                velocity.velocityTrend === 'improving' ? "text-status-active bg-status-active-bg" :
                velocity.velocityTrend === 'declining' ? "text-destructive bg-destructive/10" :
                "text-muted-foreground bg-muted"
              )}>{velocity.velocityTrend}</span>
              <span className="text-micro text-muted-foreground ml-auto">{velocity.estimationAccuracy.toFixed(0)}% accuracy</span>
            </div>
            <div className="space-y-1.5">
              {velocity.sprints.slice(-6).map((s: any) => {
                const max = Math.max(...velocity.sprints.map((x: any) => x.pointsCompleted), 1)
                return (
                  <div key={s.sprintNumber} className="flex items-center gap-2 text-xs">
                    <span className="w-12 text-muted-foreground tabular-nums shrink-0">S{s.sprintNumber}</span>
                    <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-foreground/60 rounded-full" style={{ width: `${(s.pointsCompleted / max) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right tabular-nums">{s.pointsCompleted} pts</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Health */}
      {health && health.summary && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              <Cpu className="h-3 w-3" /> Context Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex h-3 rounded-full overflow-hidden mb-2">
              {health.summary.smartPercent > 0 && <div className="bg-status-active" style={{ width: `${health.summary.smartPercent}%` }} />}
              {health.summary.warningPercent > 0 && <div className="bg-amber-500" style={{ width: `${health.summary.warningPercent}%` }} />}
              {health.summary.dumbPercent > 0 && <div className="bg-destructive" style={{ width: `${health.summary.dumbPercent}%` }} />}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-active" />{health.summary.smartPercent.toFixed(0)}% smart</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{health.summary.warningPercent.toFixed(0)}% warning</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />{health.summary.dumbPercent.toFixed(0)}% dumb</span>
              <span className="ml-auto">{health.summary.compactions} compactions</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Index */}
      {idx && idx.index && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Project Index</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {idx.index.detectedStack?.ecosystem && (
                <span className="text-micro font-medium text-foreground bg-surface-2 rounded px-1.5 py-0.5">{idx.index.detectedStack.ecosystem}</span>
              )}
              {idx.index.detectedStack?.frameworks?.map((f: string) => (
                <span key={f} className="text-micro text-muted-foreground border border-border rounded px-1.5 py-0.5">{f}</span>
              ))}
              {idx.index.languages && Object.entries(idx.index.languages).slice(0, 6).map(([lang, count]: [string, any]) => (
                <span key={lang} className="text-micro text-muted-foreground border border-border rounded px-1.5 py-0.5">{lang}: {count}</span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {idx.index.totalFiles && <span>{idx.index.totalFiles} files</span>}
              {idx.index.totalLines && <span>{formatNum(idx.index.totalLines)} lines</span>}
              {idx.index.detectedStack?.hasTests && <span>has tests</span>}
              {idx.index.detectedStack?.hasDocker && <span>Docker</span>}
              {idx.index.detectedStack?.hasCi && <span>CI</span>}
            </div>
            {idx.domains && Object.keys(idx.domains).length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {Object.keys(idx.domains).slice(0, 8).map((d: string) => (
                  <span key={d} className="text-micro text-muted-foreground/70 bg-surface-2 rounded-full px-2 py-0.5">{d}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysis.architecture && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Architecture</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  <span className="text-micro font-medium text-foreground bg-surface-2 rounded px-1.5 py-0.5">{analysis.architecture.style}</span>
                  {analysis.stack?.languages?.map(l => (
                    <span key={l} className="text-micro text-muted-foreground border border-border rounded px-1.5 py-0.5">{l}</span>
                  ))}
                </div>
                {analysis.architecture.insights.slice(0, 3).map((ins, i) => (
                  <p key={i} className="text-xs text-muted-foreground leading-relaxed">— {ins}</p>
                ))}
              </CardContent>
            </Card>
          )}
          {(analysis.patterns || analysis.antiPatterns) && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Patterns & Risks</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1">
                {(analysis.patterns || []).slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-active shrink-0" />
                    <span>{p.name}</span>
                  </div>
                ))}
                {(analysis.antiPatterns || []).slice(0, 2).map((a, i) => (
                  <div key={`a-${i}`} className="flex items-center gap-2 text-xs text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    <span>{a.issue}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Roadmap — enhanced with backlog */}
      {(roadmapData || data.roadmap) && (() => {
        const rd = roadmapData as any || data.roadmap
        const features = rd?.features || []
        const backlog = rd?.backlog || []
        if (features.length === 0 && backlog.length === 0) return null
        return (
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Roadmap</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {features.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3">
                  <span className="text-xs flex-1 truncate">{f.name}</span>
                  <span className={cn("text-micro font-medium rounded px-1.5 py-0.5", f.status === 'completed' ? "text-status-active bg-status-active-bg" : "text-muted-foreground bg-surface-2")}>{f.status}</span>
                  <div className="w-24 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-foreground/80 rounded-full transition-all" style={{ width: `${f.progress || 0}%` }} />
                  </div>
                  <span className="text-micro text-muted-foreground tabular-nums w-8 text-right">{f.progress || 0}%</span>
                </div>
              ))}
              {backlog.length > 0 && (
                <>
                  <p className="text-micro text-muted-foreground/50 uppercase tracking-wider pt-2">Backlog</p>
                  {backlog.slice(0, 5).map((f: any) => (
                    <div key={f.id || f.name} className="flex items-center gap-3 opacity-60">
                      <span className="text-xs flex-1 truncate">{f.name}</span>
                      <span className="text-micro text-muted-foreground bg-surface-2 rounded px-1.5 py-0.5">{f.status || 'planned'}</span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )
      })()}

        </div>
      </div>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
