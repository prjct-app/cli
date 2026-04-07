import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Inbox, Lightbulb, Pencil, Rocket, Search, Trash2, Zap } from 'lucide-react'
import { api, type ProjectSummary } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { StatCard } from '@/components/ui/stat-card'
import { timeAgo } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function ProjectsPage() {
  const { data: projects, loading, refresh } = useApi(() => api.projects())
  const { data: globalStats } = useApi(() => api.globalStats().catch(() => null))
  const [filter, setFilter] = useState('')
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)
  const navigate = useNavigate()

  const all = projects || []
  const filtered = filter
    ? all.filter(p => `${p.name} ${p.path || ''} ${p.stack || ''}`.toLowerCase().includes(filter.toLowerCase()))
    : all

  function shortPath(p: string | null) {
    if (!p) return ''
    return p.replace(/^\/Users\/[^/]+\//, '~/')
  }

  async function handleRename() {
    if (!renaming || !newName.trim()) return
    await api.renameProject(renaming.id, newName.trim())
    setRenaming(null)
    refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    await api.deleteProject(deleting.id)
    setDeleting(null)
    refresh()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Global stats */}
        {globalStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <StatCard label="Projects" value={(globalStats as any).totalProjects} icon={FolderOpen} />
            <StatCard label="Active" value={(globalStats as any).activeProjects} icon={Zap} />
            <StatCard label="Tasks" value={(globalStats as any).totalTasks} icon={Inbox} />
            <StatCard label="Ideas" value={(globalStats as any).totalIdeas} icon={Lightbulb} />
            <StatCard label="Shipped" value={(globalStats as any).totalShipped} icon={Rocket} />
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{all.length} {all.length === 1 ? 'project' : 'projects'}</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects…"
              className="h-8 text-sm pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-border overflow-hidden">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-surface-2/40 border-b border-border last:border-0 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={filter ? 'No projects match your filter' : 'No projects yet'}
            description={filter ? 'Try a different search term' : 'Run `prjct init` in a terminal to start'}
            className="rounded-lg border border-dashed border-border"
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((p) => {
              const s = p.stats || { queueCount: 0, ideasCount: 0, shippedCount: 0 }
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}/board`)}
                  className="group rounded-lg border border-border bg-card px-3.5 py-3 cursor-pointer transition-colors hover:border-foreground/15"
                >
                  {/* Row 1: Name + active dot */}
                  <div className="flex items-center gap-2 min-w-0 mb-1">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", p.currentTask ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {p.stack && <span className="text-micro text-muted-foreground bg-surface-2 rounded-full px-2 py-0.5 shrink-0">{p.stack}</span>}
                  </div>
                  {/* Row 2: Path */}
                  {p.path && <p className="text-[11px] text-muted-foreground/50 font-mono truncate mb-1.5">{shortPath(p.path)}</p>}
                  {/* Row 3: Stats + actions */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {s.queueCount > 0 && <span className="tabular-nums"><span className="font-medium text-foreground/70">{s.queueCount}</span> queue</span>}
                    {s.ideasCount > 0 && <span className="tabular-nums"><span className="font-medium text-foreground/70">{s.ideasCount}</span> ideas</span>}
                    {s.shippedCount > 0 && <span className="tabular-nums"><span className="font-medium text-foreground/70">{s.shippedCount}</span> shipped</span>}
                    <span className="text-muted-foreground/40 tabular-nums">{timeAgo(p.lastSync)}</span>
                    <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <IconButton label="Rename" icon={Pencil} size="sm" onClick={() => { setRenaming(p); setNewName(p.name) }} />
                      <IconButton label="Delete" icon={Trash2} size="sm" tone="destructive" onClick={() => setDeleting(p)} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Rename project</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleRename() }} className="space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus className="h-8 text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={!newName.trim()}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Delete {deleting?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Permanently delete this project and all its data.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
