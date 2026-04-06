import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Circle, Inbox, Play, Search, X } from 'lucide-react'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/icon-button'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { PRIORITY_LABEL, TYPE_LABEL } from '@/lib/taskStyles'
import { timeAgo } from '@/lib/dates'

const TYPE_DOT: Record<string, string> = {
  bug: 'bg-red-500', feature: 'bg-indigo-500', improvement: 'bg-teal-500', security: 'bg-purple-500', chore: 'bg-muted-foreground/50', fix: 'bg-red-500',
}

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

export function QueueTab() {
  const { data, projectId, refresh } = useTabCtx()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])

  const tasks = data.queue?.tasks || []
  const pending = tasks.filter(t => !t.completed)
  const types = useMemo(() => Array.from(new Set(pending.map(t => t.type).filter(Boolean))), [pending])
  const priorities = useMemo(() => Array.from(new Set(pending.map(t => t.priority).filter(Boolean))), [pending])

  const filtered = pending.filter(t => {
    if (search && !`${t.description} ${t.priority} ${t.type} ${t.section}`.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter.length && !typeFilter.includes(t.type)) return false
    if (priorityFilter.length && !priorityFilter.includes(t.priority)) return false
    return true
  })

  const hasFilter = !!(search || typeFilter.length || priorityFilter.length)

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-5 py-2.5 border-b border-border flex items-center gap-2">
        <div className="relative w-52">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-7 text-xs pl-7 bg-transparent border-border" />
        </div>
        <FilterDropdown label="Priority" options={priorities} value={priorityFilter} onChange={setPriorityFilter} />
        <FilterDropdown label="Type" options={types} value={typeFilter} onChange={setTypeFilter} />
        {hasFilter && <button type="button" onClick={() => { setSearch(''); setTypeFilter([]); setPriorityFilter([]) }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={Inbox} title={hasFilter ? 'No matches' : 'Queue is empty'} description={hasFilter ? 'Try adjusting your filters' : 'Issues will appear here'} />
        ) : (
          <div>
            {filtered.map(t => (
              <div
                key={t.id}
                onClick={() => navigate(`/project/${projectId}/task/${t.id}`)}
                className="flex items-center gap-3 px-5 py-2 border-b border-border cursor-pointer hover:bg-surface-2 transition-colors group"
              >
                <StatusIcon section={t.section} />
                <PriorityIcon p={t.priority} />
                <span className="text-[13px] flex-1 truncate text-foreground/90">{t.description}</span>
                {t.type && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                    <span className={cn("h-[7px] w-[7px] rounded-full", TYPE_DOT[t.type] || 'bg-muted-foreground/30')} />
                    {TYPE_LABEL[t.type] || t.type}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/50 shrink-0 w-20 text-right">{timeAgo(t.createdAt)}</span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {t.section !== 'active' && (
                    <IconButton label="Start" icon={Play} size="sm" onClick={() => api.updateQueueTask(projectId, t.id, { section: 'active' }).then(refresh)} />
                  )}
                  <IconButton label="Delete" icon={X} size="sm" tone="destructive" onClick={() => api.deleteQueueTask(projectId, t.id).then(refresh)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
