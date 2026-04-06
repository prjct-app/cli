import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check,
  Circle, Columns3, GripVertical, Inbox, List, MoreHorizontal, Play, Search, X
} from 'lucide-react'
import { api, type QueueTask } from '@/api/client'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/icon-button'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { PRIORITY_ORDER, PRIORITY_LABEL, TYPE_LABEL } from '@/lib/taskStyles'
import { timeAgo } from '@/lib/dates'
import { useBoardStore, type SortBy } from '@/stores/board-store'

// ═══════════════════════════════════════════════════════════════════════
// Icons
// ═══════════════════════════════════════════════════════════════════════

function PriorityIcon({ p }: { p: string }) {
  const n = p === 'critical' || p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0
  const clr = p === 'critical' || p === 'urgent' ? 'bg-orange-500' : p === 'high' ? 'bg-orange-400' : p === 'medium' ? 'bg-amber-400' : p === 'low' ? 'bg-blue-400' : 'bg-muted-foreground/20'
  if (!n) return <span className="h-3.5 w-3.5 inline-flex items-center justify-center text-muted-foreground/40 text-[9px]">—</span>
  return <span className="inline-flex items-end gap-[1.5px] h-3.5">{[1,2,3,4].map(i => <span key={i} className={cn("w-[2px] rounded-[0.5px]", i <= n ? clr : 'bg-muted-foreground/10')} style={{ height: `${35+i*16}%` }} />)}</span>
}

function StatusIcon({ section }: { section: string }) {
  if (section === 'active') return <span className="h-3.5 w-3.5 rounded-full border-[2px] border-amber-500 shrink-0" />
  if (section === 'previously_active') return <span className="h-3.5 w-3.5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Check className="h-2 w-2 text-white" strokeWidth={3} /></span>
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
}

const TYPE_DOT: Record<string, string> = { bug: 'bg-red-500', feature: 'bg-indigo-500', improvement: 'bg-teal-500', security: 'bg-purple-500', chore: 'bg-muted-foreground/50', fix: 'bg-red-500' }
const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'active', label: 'In Progress' },
  { key: 'previously_active', label: 'Done' },
] as const
const SORT_LABELS: Record<SortBy, string> = { priority: 'Priority', date: 'Date', type: 'Type', manual: 'Manual' }

// ═══════════════════════════════════════════════════════════════════════
// Sort
// ═══════════════════════════════════════════════════════════════════════

function sortTasks(tasks: QueueTask[], sortBy: SortBy, dir: 'asc' | 'desc', manualOrder: string[]): QueueTask[] {
  const sorted = [...tasks]
  const m = dir === 'asc' ? 1 : -1
  switch (sortBy) {
    case 'priority': sorted.sort((a, b) => m * ((PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5))); break
    case 'date': sorted.sort((a, b) => m * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())); break
    case 'type': sorted.sort((a, b) => m * (a.type || '').localeCompare(b.type || '')); break
    case 'manual': { const idx = new Map(manualOrder.map((id, i) => [id, i])); sorted.sort((a, b) => (idx.get(a.id) ?? 999999) - (idx.get(b.id) ?? 999999)); break }
  }
  return sorted
}

function groupByStatus(tasks: QueueTask[]): Record<string, QueueTask[]> {
  const g: Record<string, QueueTask[]> = { backlog: [], active: [], previously_active: [] }
  for (const t of tasks) {
    const col = t.completed ? 'previously_active' : (t.section || 'backlog')
    ;(g[col] || g.backlog).push(t)
  }
  return g
}

// ═══════════════════════════════════════════════════════════════════════
// Infinite scroll hook
// ═══════════════════════════════════════════════════════════════════════

function useInfiniteScroll(total: number, step: number) {
  const [visible, setVisible] = useState(step)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setVisible(step) }, [total, step])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(v => Math.min(v + step, total))
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [total, step])

  return { visible, sentinelRef, hasMore: visible < total }
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

export function BoardTab() {
  const { allTasks, projectId, refresh } = useTabCtx()
  const navigate = useNavigate()
  const store = useBoardStore()
  const prefs = store.getPrefs(projectId)
  const { view, sortBy, sortDir, manualOrder } = prefs

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])

  const types = useMemo(() => Array.from(new Set(allTasks.map(t => t.type).filter(Boolean))), [allTasks])
  const priorities = useMemo(() => Array.from(new Set(allTasks.map(t => t.priority).filter(Boolean))), [allTasks])

  const filtered = useMemo(() => allTasks.filter(t => {
    if (search && !`${t.description} ${t.priority} ${t.type} ${t.id}`.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter.length && !typeFilter.includes(t.type)) return false
    if (priorityFilter.length && !priorityFilter.includes(t.priority)) return false
    return true
  }), [allTasks, search, typeFilter, priorityFilter])

  const hasFilter = !!(search || typeFilter.length || priorityFilter.length)

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-5 py-2 border-b border-border flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-[4px] border border-border overflow-hidden mr-1">
          <button type="button" onClick={() => store.setView(projectId, 'board')}
            className={cn("inline-flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors", view === 'board' ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Columns3 className="h-3 w-3" /> Board
          </button>
          <button type="button" onClick={() => store.setView(projectId, 'table')}
            className={cn("inline-flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors border-l border-border", view === 'table' ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <List className="h-3 w-3" /> Table
          </button>
        </div>
        <div className="relative w-44">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-7 text-[11px] pl-7 bg-transparent border-border" />
        </div>
        <FilterDropdown label="Priority" options={priorities} value={priorityFilter} onChange={setPriorityFilter} />
        <FilterDropdown label="Type" options={types} value={typeFilter} onChange={setTypeFilter} />
        {hasFilter && <button type="button" onClick={() => { setSearch(''); setTypeFilter([]); setPriorityFilter([]) }} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>}
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded-[4px] hover:bg-surface-2 transition-colors outline-none">
              <ArrowUpDown className="h-3 w-3" /> {SORT_LABELS[sortBy]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {(['priority', 'date', 'type', 'manual'] as SortBy[]).map(s => (
                <DropdownMenuItem key={s} onClick={() => store.setSort(projectId, s)} className={cn("text-xs", sortBy === s && "font-medium")}>{SORT_LABELS[s]} {sortBy === s && '✓'}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={() => store.setSort(projectId, sortBy, sortDir === 'asc' ? 'desc' : 'asc')} className="p-1 rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {view === 'board'
        ? <KanbanView tasks={filtered} projectId={projectId} refresh={refresh} navigate={navigate} hasFilter={hasFilter} sortBy={sortBy} sortDir={sortDir} manualOrder={manualOrder} />
        : <TableView tasks={filtered} projectId={projectId} refresh={refresh} navigate={navigate} hasFilter={hasFilter} sortBy={sortBy} sortDir={sortDir} manualOrder={manualOrder} setManualOrder={(o) => store.setManualOrder(projectId, o)} />
      }
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Kanban — infinite scroll per column
// ═══════════════════════════════════════════════════════════════════════

function KanbanView({ tasks, projectId, refresh, navigate, hasFilter, sortBy, sortDir, manualOrder }: {
  tasks: QueueTask[]; projectId: string; refresh: () => void; navigate: (p: string) => void; hasFilter: boolean
  sortBy: SortBy; sortDir: 'asc' | 'desc'; manualOrder: string[]
}) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const g = groupByStatus(tasks)
    for (const key of Object.keys(g)) g[key] = sortTasks(g[key], sortBy, sortDir, manualOrder)
    return g
  }, [tasks, sortBy, sortDir, manualOrder])

  const handleDrop = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id) api.updateQueueTask(projectId, id, { section: col }).then(refresh)
    setDragOverCol(null); setDraggingId(null)
  }

  return (
    <div className="flex-1 flex overflow-x-auto min-h-0">
      {COLUMNS.map(({ key, label }) => (
        <KanbanColumn key={key} colKey={key} label={label} items={grouped[key]} isOver={dragOverCol === key} draggingId={draggingId} hasFilter={hasFilter} projectId={projectId}
          onDragOver={() => setDragOverCol(key)} onDragLeave={() => setDragOverCol(null)} onDrop={e => handleDrop(e, key)}
          onDragStart={id => setDraggingId(id)} onDragEnd={() => setDraggingId(null)} onClickTask={id => navigate(`/project/${projectId}/task/${id}`)} />
      ))}
    </div>
  )
}

function KanbanColumn({ colKey, label, items, isOver, draggingId, hasFilter, projectId, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onClickTask }: {
  colKey: string; label: string; items: QueueTask[]; isOver: boolean; draggingId: string | null; hasFilter: boolean; projectId: string
  onDragOver: () => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void
  onDragStart: (id: string) => void; onDragEnd: () => void; onClickTask: (id: string) => void
}) {
  const { visible, sentinelRef, hasMore } = useInfiniteScroll(items.length, 25)
  const shown = items.slice(0, visible)

  return (
    <div className={cn("flex-1 min-w-[280px] flex flex-col border-r border-border last:border-r-0", isOver && "bg-surface-2/40")}
      onDragOver={e => { e.preventDefault(); onDragOver() }} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="flex items-center gap-2 px-4 py-2 text-[13px] shrink-0">
        <StatusIcon section={colKey} />
        <span className="font-medium text-foreground/90">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums ml-0.5">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 pb-2.5 space-y-px">
        {shown.map(t => (
          <div key={t.id} draggable
            onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); onDragStart(t.id) }}
            onDragEnd={onDragEnd} onClick={() => onClickTask(t.id)}
            className={cn("rounded-[4px] px-3 py-2.5 cursor-pointer transition-colors hover:bg-surface-2", draggingId === t.id && "opacity-40")}>
            {t.id.length < 20 && <p className="text-[11px] text-muted-foreground/50 mb-0.5">{t.id}</p>}
            <div className="flex items-start gap-2">
              <StatusIcon section={t.completed ? 'previously_active' : t.section} />
              <p className="text-[13px] leading-snug text-foreground/90 line-clamp-2 flex-1">{t.description}</p>
            </div>
            <div className="flex items-center gap-2 mt-1.5 pl-[22px]">
              <PriorityIcon p={t.priority} />
              {t.type && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn("h-[6px] w-[6px] rounded-full", TYPE_DOT[t.type] || 'bg-muted-foreground/30')} />{TYPE_LABEL[t.type] || t.type}</span>}
              <span className="text-[11px] text-muted-foreground/40 ml-auto">{timeAgo(t.createdAt)}</span>
            </div>
          </div>
        ))}
        {hasMore && <div ref={sentinelRef} className="h-4" />}
        {items.length === 0 && !hasFilter && <div className="py-8 text-center text-[11px] text-muted-foreground/30">No issues</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Table — grouped by status + infinite scroll + drag reorder
// ═══════════════════════════════════════════════════════════════════════

function TableView({ tasks, projectId, refresh, navigate, hasFilter, sortBy, sortDir, manualOrder, setManualOrder }: {
  tasks: QueueTask[]; projectId: string; refresh: () => void; navigate: (p: string) => void; hasFilter: boolean
  sortBy: SortBy; sortDir: 'asc' | 'desc'; manualOrder: string[]; setManualOrder: (o: string[]) => void
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const g = groupByStatus(tasks)
    for (const key of Object.keys(g)) g[key] = sortTasks(g[key], sortBy, sortDir, manualOrder)
    return g
  }, [tasks, sortBy, sortDir, manualOrder])

  // Flatten for drag reorder
  const allSorted = useMemo(() => [...grouped.active, ...grouped.backlog, ...grouped.previously_active], [grouped])

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const ids = allSorted.map(t => t.id)
    const from = ids.indexOf(draggingId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, draggingId)
    setManualOrder(ids)
    setDraggingId(null); setDragOverId(null)
  }

  if (tasks.length === 0) {
    return <EmptyState icon={Inbox} title={hasFilter ? 'No matches' : 'No issues'} description={hasFilter ? 'Adjust your filters' : 'Issues will appear here'} />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {COLUMNS.map(({ key, label }) => {
        const items = grouped[key]
        if (items.length === 0) return null
        return (
          <StatusSection key={key} colKey={key} label={label} items={items} projectId={projectId} refresh={refresh}
            navigate={navigate} draggingId={draggingId} dragOverId={dragOverId}
            onDragStart={setDraggingId} onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
            onDragOver={setDragOverId} onDrop={handleDrop} />
        )
      })}
    </div>
  )
}

function StatusSection({ colKey, label, items, projectId, refresh, navigate, draggingId, dragOverId, onDragStart, onDragEnd, onDragOver, onDrop }: {
  colKey: string; label: string; items: QueueTask[]; projectId: string; refresh: () => void; navigate: (p: string) => void
  draggingId: string | null; dragOverId: string | null
  onDragStart: (id: string) => void; onDragEnd: () => void; onDragOver: (id: string) => void; onDrop: (id: string) => void
}) {
  const { visible, sentinelRef, hasMore } = useInfiniteScroll(items.length, 25)
  const shown = items.slice(0, visible)

  return (
    <div>
      {/* Section header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-1.5 bg-background/95 backdrop-blur-sm border-b border-border">
        <StatusIcon section={colKey} />
        <span className="text-[12px] font-medium text-foreground/70">{label}</span>
        <span className="text-[11px] text-muted-foreground/50 tabular-nums">{items.length}</span>
      </div>
      {shown.map(t => (
        <div key={t.id} draggable
          onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); onDragStart(t.id) }}
          onDragEnd={onDragEnd}
          onDragOver={e => { e.preventDefault(); onDragOver(t.id) }}
          onDrop={e => { e.preventDefault(); onDrop(t.id) }}
          onClick={() => navigate(`/project/${projectId}/task/${t.id}`)}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2 border-b border-border cursor-pointer hover:bg-surface-2 transition-colors group",
            draggingId === t.id && "opacity-30",
            dragOverId === t.id && draggingId && draggingId !== t.id && "border-t-2 border-t-indigo-500"
          )}>
          <GripVertical className="h-3 w-3 text-muted-foreground/15 group-hover:text-muted-foreground/40 shrink-0 cursor-grab" />
          <PriorityIcon p={t.priority} />
          {t.id.length < 20 && <span className="text-[11px] text-muted-foreground/40 shrink-0 w-14 tabular-nums">{t.id}</span>}
          <span className="text-[13px] flex-1 truncate text-foreground/90">{t.description}</span>
          {t.type && <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0"><span className={cn("h-[6px] w-[6px] rounded-full", TYPE_DOT[t.type] || 'bg-muted-foreground/30')} />{TYPE_LABEL[t.type] || t.type}</span>}
          <span className="text-[11px] text-muted-foreground/40 shrink-0 w-14 text-right">{timeAgo(t.createdAt)}</span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            {t.section !== 'active' && !t.completed && <IconButton label="Start" icon={Play} size="sm" onClick={() => api.updateQueueTask(projectId, t.id, { section: 'active' }).then(refresh)} />}
            <IconButton label="Delete" icon={X} size="sm" tone="destructive" onClick={() => api.deleteQueueTask(projectId, t.id).then(refresh)} />
          </div>
        </div>
      ))}
      {hasMore && <div ref={sentinelRef} className="h-4" />}
    </div>
  )
}
