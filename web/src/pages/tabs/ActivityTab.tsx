import { useState } from 'react'
import { Activity, Archive, Brain, Clock, MoreHorizontal, Search } from 'lucide-react'
import { api, type ProjectEvent, type MemoryEntry, type SessionEntry, type ArchiveEntry } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { timeAgo, formatDate } from '@/lib/dates'

type View = 'events' | 'learnings' | 'sessions' | 'archives'

export function ActivityTab() {
  const { projectId } = useTabCtx()
  const [view, setView] = useState<View>('events')

  const views: { key: View; label: string }[] = [
    { key: 'events', label: 'Events' },
    { key: 'learnings', label: 'Learnings' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'archives', label: 'Archives' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Sub-nav */}
      <div className="shrink-0 px-5 py-2 border-b border-border flex items-center gap-1">
        {views.map(v => (
          <button key={v.key} type="button" onClick={() => setView(v.key)}
            className={cn(
              "px-2.5 py-1 text-[12px] rounded-[4px] transition-colors",
              view === v.key ? "bg-surface-2 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'events' && <EventsView projectId={projectId} />}
        {view === 'learnings' && <LearningsView projectId={projectId} />}
        {view === 'sessions' && <SessionsView projectId={projectId} />}
        {view === 'archives' && <ArchivesView projectId={projectId} />}
      </div>
    </div>
  )
}

// ─── Events ───

function EventsView({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0)
  const [allEvents, setAllEvents] = useState<ProjectEvent[]>([])
  const [search, setSearch] = useState('')
  const limit = 50

  const { data, loading } = useApi(() =>
    api.events(projectId, { limit, offset }).then(r => {
      if (offset === 0) setAllEvents(r.events)
      else setAllEvents(prev => [...prev, ...r.events])
      return r
    }), [projectId, offset])

  const total = (data as any)?.total || 0
  const filtered = search
    ? allEvents.filter(e => `${e.type} ${JSON.stringify(e)}`.toLowerCase().includes(search.toLowerCase()))
    : allEvents

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter events…" className="h-8 text-sm pl-8" />
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Activity} title="No events" description="Activity events will appear here as you work" />
        ) : (
          <div className="space-y-1.5">
            {filtered.map(evt => (
              <div key={evt.id} className="rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-micro font-medium text-foreground/70 bg-surface-2 rounded px-1.5 py-0.5">{evt.type}</span>
                  <span className="text-[11px] text-muted-foreground/40 ml-auto">{timeAgo(evt.timestamp)}</span>
                </div>
                <p className="text-[13px] text-foreground/80 leading-snug">
                  {(evt as any).description || (evt as any).data || evt.type.replace(/[_:]/g, ' ')}
                </p>
              </div>
            ))}
          </div>
        )}

        {allEvents.length < total && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setOffset(o => o + limit)} disabled={loading}>
              {loading ? 'Loading…' : `Load more (${allEvents.length}/${total})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Learnings ───

function LearningsView({ projectId }: { projectId: string }) {
  const { data, loading } = useApi(() => api.memory(projectId).catch(() => ({ items: [] })), [projectId])
  const items = (data as any)?.items || []

  if (!loading && items.length === 0) {
    return <div className="px-6 py-5"><EmptyState icon={Brain} title="No learnings" description="Project memory entries will appear here" /></div>
  }

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-1.5">
        {items.map((m: MemoryEntry) => (
          <div key={m.id} className="rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-foreground/80">{m.key}</span>
              {m.category && <span className="text-micro text-muted-foreground bg-surface-2 rounded-full px-2 py-0.5">{m.category}</span>}
              <span className="text-[11px] text-muted-foreground/40 ml-auto">{formatDate(m.updated_at)}</span>
            </div>
            <p className="text-[13px] text-foreground/70 leading-snug whitespace-pre-wrap">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sessions ───

function SessionsView({ projectId }: { projectId: string }) {
  const { data, loading } = useApi(() => api.sessions(projectId).catch(() => ({ sessions: [], agentSessions: [] })), [projectId])
  const sessions = (data as any)?.sessions || []
  const agentSessions = (data as any)?.agentSessions || []

  if (!loading && sessions.length === 0 && agentSessions.length === 0) {
    return <div className="px-6 py-5"><EmptyState icon={Clock} title="No sessions" description="Work sessions will appear here" /></div>
  }

  function durationStr(s: SessionEntry): string {
    if (s.duration_ms) {
      const min = Math.floor(s.duration_ms / 60000)
      if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`
      return `${min}m`
    }
    if (s.ended_at && s.started_at) {
      const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
      const min = Math.floor(ms / 60000)
      if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`
      return `${min}m`
    }
    return ''
  }

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-4">
        {sessions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-micro font-medium text-muted-foreground uppercase tracking-wider px-1">Work Sessions</p>
            {sessions.slice(0, 20).map((s: SessionEntry) => (
              <div key={s.id} className="rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
                <div className="flex items-center gap-3 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground/80">{formatDate(s.started_at)}</span>
                  {durationStr(s) && <span className="font-mono text-muted-foreground">{durationStr(s)}</span>}
                  <span className="text-muted-foreground/40 ml-auto">{timeAgo(s.started_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {agentSessions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-micro font-medium text-muted-foreground uppercase tracking-wider px-1">Agent Sessions</p>
            {agentSessions.slice(0, 20).map((s: SessionEntry) => (
              <div key={s.id} className="rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
                <div className="flex items-center gap-3 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground/80">{formatDate(s.started_at)}</span>
                  {durationStr(s) && <span className="font-mono text-muted-foreground">{durationStr(s)}</span>}
                  <span className="text-muted-foreground/40 ml-auto">{timeAgo(s.started_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Archives ───

function ArchivesView({ projectId }: { projectId: string }) {
  const { data, loading } = useApi(() => api.archives(projectId).catch(() => ({ items: [], stats: { total: 0, byType: {} } })), [projectId])
  const items = (data as any)?.items || []
  const stats = (data as any)?.stats || { total: 0, byType: {} }
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const types = Object.keys(stats.byType || {})
  const filtered = typeFilter.length > 0 ? items.filter((a: ArchiveEntry) => typeFilter.includes(a.entity_type)) : items

  if (!loading && items.length === 0) {
    return <div className="px-6 py-5"><EmptyState icon={Archive} title="No archives" description="Archived items will appear here" /></div>
  }

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center gap-2">
          <FilterDropdown label="Type" options={types} value={typeFilter} onChange={setTypeFilter} />
          <span className="text-xs text-muted-foreground ml-auto">{stats.total} total</span>
        </div>
        <div className="space-y-1.5">
          {filtered.map((a: ArchiveEntry) => (
            <div key={a.id} className="rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-micro font-medium text-foreground/70 bg-surface-2 rounded px-1.5 py-0.5">{a.entity_type}</span>
                {a.reason && <span className="text-micro text-muted-foreground">{a.reason}</span>}
                <span className="text-[11px] text-muted-foreground/40 ml-auto">{formatDate(a.archived_at)}</span>
              </div>
              <p className="text-[13px] text-foreground/70 leading-snug line-clamp-2">{a.summary || a.entity_id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
