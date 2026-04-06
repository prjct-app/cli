import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ChevronRight, Pencil, Settings, Trash2 } from 'lucide-react'
import { api, type QueueTask, type Idea, type TaskHistory, type ProjectFull } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { useSSE } from '@/hooks/useSSE'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { typeColor, typeBg, PRIORITY_LABEL, TYPE_LABEL } from '@/lib/taskStyles'
import { CreateIssueModal } from '@/components/CreateIssueModal'
import { formatDate } from '@/lib/dates'

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

export interface TabCtx {
  data: ProjectFull
  projectId: string
  refresh: () => void
  onClickTask: (t: QueueTask) => void
  allTasks: QueueTask[]
  pending: QueueTask[]
  history: TaskHistory[]
}

export function useTabCtx() {
  return useOutletContext<TabCtx>()
}

// ═══════════════════════════════════════════════════════════════════════
// Shell
// ═══════════════════════════════════════════════════════════════════════

export function ProjectPage({ onCreateIssue, createOpen, onCloseCreate }: { onCreateIssue?: () => void; createOpen?: boolean; onCloseCreate?: () => void }) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useApi(() => api.project(projectId!), [projectId])
  const [editOpen, setEditOpen] = useState(false)

  useSSE(useCallback(() => refresh(), [refresh]))

  if (loading) return (
    <div className="h-full">
      <div className="h-11 border-b border-border" />
      <div className="p-6 space-y-4"><div className="h-6 w-48 bg-surface-2 rounded animate-pulse" /><div className="h-40 bg-surface-2 rounded animate-pulse" /></div>
    </div>
  )
  if (error || !data) return <div className="p-6"><p className="text-sm text-destructive">{error || 'Not found'}</p></div>

  const queue = data.queue || { tasks: [] }
  const ideas = data.ideas || { ideas: [] }
  const shipped = data.shipped || { shipped: [] }
  const history: TaskHistory[] = (data.state as any).taskHistory || []
  const allTasks = queue.tasks || []
  const pending = allTasks.filter((t) => !t.completed)
  const ideasPending = (ideas.ideas || []).filter(i => i.status === 'pending').length
  const ctx: TabCtx = { data, projectId: projectId!, refresh, onClickTask: (t) => navigate(`/project/${projectId}/task/${t.id}`), allTasks, pending, history }

  const tabs = [
    { to: 'board', label: 'Board', count: allTasks.length },
    { to: 'overview', label: 'Overview' },
    { to: 'ideas', label: 'Ideas', count: ideasPending },
    { to: 'shipped', label: 'Shipped', count: (shipped.shipped || []).length },
    { to: 'calendar', label: 'Calendar' },
    { to: 'workflows', label: 'Workflows' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header bar — Linear style */}
      <div className="shrink-0 h-11 border-b border-border px-4 flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground min-w-0">
          <Link to="/" className="hover:text-foreground transition-colors shrink-0">Projects</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="text-foreground font-medium truncate">{data.name}</span>
          {data.path && <span className="text-[11px] text-muted-foreground/40 font-mono truncate max-w-xs hidden md:inline">{data.path.replace(/^\/Users\/[^/]+\//, '~/')}</span>}
        </div>
        <IconButton label="Edit project" icon={Settings} size="sm" className="ml-1" onClick={() => setEditOpen(true)} />
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 border-b border-border flex items-center gap-0">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => cn(
              "inline-flex items-center gap-1 px-3 py-2 text-[13px] transition-colors border-b-2 -mb-px",
              isActive ? "border-b-foreground text-foreground font-medium" : "border-b-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="text-[11px] tabular-nums text-muted-foreground/60">{t.count}</span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <Outlet context={ctx} />
      </div>

      {editOpen && <EditProjectDialog data={data} projectId={projectId!} onClose={() => setEditOpen(false)} refresh={refresh} />}
      {createOpen && onCloseCreate && (
        <CreateIssueModal projectId={projectId!} open={createOpen} onClose={onCloseCreate} onCreated={refresh} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Edit Project Dialog
// ═══════════════════════════════════════════════════════════════════════

function EditProjectDialog({ data, projectId, onClose, refresh }: {
  data: ProjectFull; projectId: string; onClose: () => void; refresh: () => void
}) {
  const [name, setName] = useState(data.name || '')
  const [description, setDescription] = useState((data as any).description || '')
  const [path, setPath] = useState(data.path || '')
  const [saving, setSaving] = useState(false)
  const analysis = data.analysis
  const features = data.roadmap?.features || []

  async function handleSave() {
    setSaving(true)
    try { await api.updateProject(projectId, { name: name.trim(), description: description.trim(), repoPath: path.trim() }); refresh(); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-sm font-semibold">Edit project</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-2">
          <Sect title="General">
            <Fld label="Name"><Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" /></Fld>
            <Fld label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Project description…" /></Fld>
            <Fld label="Path"><Input value={path} onChange={e => setPath(e.target.value)} className="h-8 text-sm font-mono" /></Fld>
          </Sect>
          <Sect title="Stack">
            <div className="grid grid-cols-2 gap-4">
              <Ro label="Architecture" value={analysis?.architecture?.style || '—'} />
              <Ro label="Languages" value={analysis?.stack?.languages?.join(', ') || '—'} />
              <Ro label="Frameworks" value={analysis?.stack?.frameworks?.join(', ') || '—'} />
              <Ro label="Tech Stack" value={data.techStack?.join(', ') || '—'} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Detected during sync. Run <code className="bg-surface-2 px-1 py-0.5 rounded text-[11px]">prjct sync</code> to update.</p>
          </Sect>
          {features.length > 0 && (
            <Sect title="Roadmap">
              {features.map(f => (
                <div key={f.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <span className="text-[11px] text-muted-foreground capitalize">{f.status}</span>
                  <div className="w-20 h-1 rounded-full bg-surface-2 overflow-hidden"><div className="h-full bg-foreground/60 rounded-full" style={{ width: `${f.progress || 0}%` }} /></div>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">{f.progress || 0}%</span>
                </div>
              ))}
            </Sect>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">{title}</h3><div className="space-y-3">{children}</div></div>
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-muted-foreground">{label}</label>{children}</div>
}
function Ro({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1"><span className="text-xs text-muted-foreground">{label}</span><p className="text-sm">{value}</p></div>
}

export type { QueueTask, Idea, TaskHistory, ProjectFull }
