import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, Clock, MoreHorizontal, Search } from 'lucide-react'
import { api } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { typeColor } from '@/lib/taskStyles'
import { formatDate, formatDuration } from '@/lib/dates'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function HistoryTab() {
  const { history, projectId } = useTabCtx()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Fetch normalized tasks with subtasks
  const { data: tasksData } = useApi(() => api.tasks(projectId).catch(() => ({ tasks: [], subtasks: [] })), [projectId])
  const subtasksMap = useMemo(() => {
    const map = new Map<string, { description: string; status: string }[]>()
    const subs = (tasksData as any)?.subtasks || []
    for (const s of subs) {
      const tid = s.task_id || s.taskId
      if (!tid) continue
      if (!map.has(tid)) map.set(tid, [])
      map.get(tid)!.push({ description: s.description, status: s.status || 'pending' })
    }
    return map
  }, [tasksData])

  const types = useMemo(
    () => Array.from(new Set(history.map(h => h.classification).filter(Boolean))),
    [history]
  )

  const filtered = history.filter(h => {
    if (search && !`${h.title} ${h.classification} ${h.branchName || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter.length > 0 && !typeFilter.includes(h.classification)) return false
    return true
  })

  const hasActiveFilter = !!(search || typeFilter.length)

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history…"
              className="h-8 text-sm pl-8"
            />
          </div>
          <FilterDropdown label="Type" options={types} value={typeFilter} onChange={setTypeFilter} />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setSearch(''); setTypeFilter([]) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 h-8"
            >
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={hasActiveFilter ? 'No matches' : 'No task history'}
            description={hasActiveFilter ? 'Try adjusting your filters' : 'Completed tasks will appear here'}
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((h, i) => {
              const dur = formatDuration(h.startedAt, h.completedAt)
              const subs = subtasksMap.get(h.taskId) || []
              const isExpanded = expanded.has(h.taskId)
              return (
                <div key={h.taskId || i} className="group rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
                  {/* Row 1: Type badge */}
                  <div className="mb-1">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium capitalize", typeColor(h.classification))}>
                      {h.classification}
                    </span>
                  </div>
                  {/* Row 2: Icon + title */}
                  <div className="flex items-start gap-2">
                    <Clock className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", typeColor(h.classification))} />
                    <p className="text-[13px] leading-snug text-foreground/90 flex-1">{h.title}</p>
                  </div>
                  {/* Row 3: ... + metadata */}
                  <div className="flex items-center gap-2 mt-2 text-micro text-muted-foreground">
                    <button type="button" className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                    {dur && <span className="font-mono">{dur}</span>}
                    {(h.tokensIn || h.tokensOut) && (
                      <span className="font-mono tabular-nums text-muted-foreground/80">
                        {formatTokens((h.tokensIn || 0) + (h.tokensOut || 0))} tok
                      </span>
                    )}
                    {h.branchName && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono truncate max-w-[200px] cursor-help">{h.branchName}</span>
                        </TooltipTrigger>
                        <TooltipContent>{h.branchName}</TooltipContent>
                      </Tooltip>
                    )}
                    {subs.length > 0 && (
                      <button type="button" onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(h.taskId) ? n.delete(h.taskId) : n.add(h.taskId); return n })}
                        className="flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {subs.length} subtasks
                      </button>
                    )}
                    <span className="ml-auto">{formatDate(h.completedAt)}</span>
                  </div>
                  {/* Subtasks */}
                  {isExpanded && subs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60 space-y-0.5 pl-5">
                      {subs.map((s, si) => (
                        <div key={si} className={cn("flex items-center gap-2 text-xs py-0.5", s.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground/70')}>
                          {s.status === 'completed' ? <Check className="h-3 w-3 text-status-active shrink-0" /> : <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                          {s.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
