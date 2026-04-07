import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, type ProjectSummary } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { useSSE } from '@/hooks/useSSE'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function Layout({ onCreateIssue }: { onCreateIssue?: () => void }) {
  const { data: projects, loading, refresh } = useApi(() => api.projects())
  const { connected } = useSSE()
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)
  const navigate = useNavigate()

  const all = projects || []

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
    navigate('/')
    refresh()
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-[hsl(var(--sidebar))] border-r border-border">
        {/* Workspace */}
        <div className="h-11 px-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-sm font-bold text-foreground/90">P.</span>
          </NavLink>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-surface-2 transition-colors">
                  <Search className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search <kbd className="ml-1 text-[9px] font-mono">⌘K</kbd></TooltipContent>
            </Tooltip>
            {onCreateIssue && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={onCreateIssue}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-surface-2 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New issue</TooltipContent>
              </Tooltip>
            )}
            <span className={cn("h-1.5 w-1.5 rounded-full ml-1", connected ? "bg-emerald-500 shadow-[0_0_3px_theme(colors.emerald.500)]" : "bg-red-500")} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-1 px-2 text-[13px]">
          {/* All issues */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-2 py-[5px] rounded-[4px] transition-colors",
              isActive ? "text-foreground bg-surface-2" : "text-muted-foreground hover:text-foreground hover:bg-surface-2/30"
            )}
          >
            All projects
          </NavLink>

          <div className="mt-4 mb-1.5 px-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Your projects</span>
          </div>

          {loading && [1,2,3].map(i => <div key={i} className="h-[26px] bg-surface-2/40 rounded-[4px] mb-px animate-pulse" />)}

          {all.map((p) => (
            <div key={p.id} className="group flex items-center rounded-[4px]">
              <NavLink
                to={`/project/${p.id}/board`}
                className={({ isActive }) => cn(
                  "flex-1 flex items-center gap-2 px-2 py-[5px] min-w-0 rounded-[4px] transition-colors",
                  isActive ? "text-foreground bg-surface-2" : "text-muted-foreground hover:text-foreground hover:bg-surface-2/30"
                )}
              >
                <span className={cn(
                  "h-[7px] w-[7px] rounded-full shrink-0",
                  p.currentTask ? "bg-emerald-500 shadow-[0_0_3px_theme(colors.emerald.500)]" : "bg-muted-foreground/30"
                )} />
                <span className="truncate">{p.name}</span>
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 mr-1 rounded-[3px] transition-all text-muted-foreground">
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => { setRenaming(p); setNewName(p.name) }}><Pencil className="h-3 w-3 mr-2" />Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-3 w-3 mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </nav>

        <div className="px-3 py-2 text-[10px] text-muted-foreground/30">v1.54.0</div>
      </aside>

      <main className="flex-1 overflow-hidden bg-background">
        <Outlet />
      </main>

      {/* Rename */}
      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="text-sm">Rename project</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleRename() }} className="space-y-3">
            <Input value={newName} onChange={e => setNewName(e.target.value)} autoFocus className="h-8 text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={!newName.trim()}>Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="text-sm">Delete {deleting?.name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the project and all its data.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
