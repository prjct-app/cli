import { Check, Circle, Inbox, Lightbulb, Pause, Rocket, Zap, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
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

  return (
    <div className="px-6 py-5">
      <div className="max-w-5xl mx-auto space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Today" value={stats.tasksToday} icon={Clock} />
        <StatCard label="This week" value={stats.tasksThisWeek} icon={Clock} />
        <StatCard label="Queue" value={stats.queueCount} icon={Inbox} href="../queue" />
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
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 text-xs py-0.5",
                      s.status === 'completed' ? 'text-muted-foreground line-through' :
                        i === state.currentTask!.currentSubtaskIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
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
            <EmptyState
              icon={Zap}
              title="No active task"
              description="Start one from the Board, or run `prjct task` in your terminal"
              action={
                <Button size="sm" variant="outline" asChild>
                  <Link to="../board">Go to Board</Link>
                </Button>
              }
              size="sm"
            />
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
                  <span className="text-micro font-medium text-foreground bg-surface-2 rounded px-1.5 py-0.5">
                    {analysis.architecture.style}
                  </span>
                  {analysis.stack?.languages?.map(l => (
                    <span key={l} className="text-micro text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      {l}
                    </span>
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

      {/* Roadmap */}
      {data.roadmap && (data.roadmap.features || []).length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-micro uppercase tracking-wider text-muted-foreground font-medium">Roadmap</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {(data.roadmap.features || []).map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <span className="text-xs flex-1 truncate">{f.name}</span>
                <span className={cn(
                  "text-micro font-medium rounded px-1.5 py-0.5",
                  f.status === 'completed' ? "text-status-active bg-status-active-bg" : "text-muted-foreground bg-surface-2"
                )}>
                  {f.status}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-foreground/80 rounded-full transition-all"
                    style={{ width: `${f.progress || 0}%` }}
                  />
                </div>
                <span className="text-micro text-muted-foreground tabular-nums w-8 text-right">{f.progress || 0}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}
