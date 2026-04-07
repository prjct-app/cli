import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  Columns3, FileText, FolderOpen, Lightbulb, Plus,
  Rocket, Search, Settings, Workflow, Calendar
} from 'lucide-react'
import { api, type QueueTask, type ProjectSummary } from '@/api/client'
import { StatusIcon } from '@/components/shared/StatusIcon'
import { PriorityIcon } from '@/components/shared/PriorityIcon'
import { TYPE_DOT } from '@/components/shared/constants'
import { cn } from '@/lib/utils'
import { TYPE_LABEL } from '@/lib/taskStyles'

interface CommandPaletteProps {
  onCreateIssue?: () => void
}

export function CommandPalette({ onCreateIssue }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [tasks, setTasks] = useState<QueueTask[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const navigate = useNavigate()

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Load projects on open
  useEffect(() => {
    if (!open) return
    api.projects().then(setProjects).catch(() => {})
  }, [open])

  // Load tasks when searching
  useEffect(() => {
    if (!open || !search) { setTasks([]); return }
    // Search across first project or active project
    const pid = activeProject || projects[0]?.id
    if (!pid) return
    api.project(pid).then(data => {
      const all = data.queue?.tasks || []
      const filtered = all.filter(t =>
        `${t.description} ${t.id} ${t.type} ${t.priority}`.toLowerCase().includes(search.toLowerCase())
      )
      setTasks(filtered.slice(0, 10))
    }).catch(() => {})
  }, [search, open, activeProject, projects])

  const go = useCallback((path: string) => { navigate(path); setOpen(false); setSearch('') }, [navigate])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[640px] max-h-[420px]">
        <Command
          className="rounded-xl border border-border bg-popover shadow-2xl shadow-black/40 overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search issues, projects, or type a command…"
              className="h-12 flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
            />
            <kbd className="text-[10px] text-muted-foreground/50 bg-surface-2 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Issues results */}
            {tasks.length > 0 && (
              <Command.Group heading={<span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 px-2">Issues</span>}>
                {tasks.map(t => (
                  <Command.Item
                    key={t.id}
                    value={t.id}
                    onSelect={() => go(`/project/${activeProject || projects[0]?.id}/task/${t.id}`)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] cursor-pointer text-sm aria-selected:bg-surface-2 transition-colors"
                  >
                    <PriorityIcon priority={t.priority} size="sm" />
                    <StatusIcon section={t.section} completed={t.completed} />
                    {t.id.length < 20 && <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">{t.id}</span>}
                    <span className="flex-1 truncate text-foreground/90">{t.description}</span>
                    {t.type && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                        <span className={cn("h-[6px] w-[6px] rounded-full", TYPE_DOT[t.type] || 'bg-muted-foreground/30')} />
                        {TYPE_LABEL[t.type] || t.type}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Projects */}
            {!search && (
              <Command.Group heading={<span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 px-2">Projects</span>}>
                {projects.slice(0, 8).map(p => (
                  <Command.Item
                    key={p.id}
                    value={`project-${p.name}`}
                    onSelect={() => go(`/project/${p.id}/board`)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] cursor-pointer text-sm aria-selected:bg-surface-2 transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.currentTask && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            <Command.Group heading={<span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 px-2">Actions</span>}>
              {onCreateIssue && (
                <Command.Item
                  value="create-issue"
                  onSelect={() => { setOpen(false); onCreateIssue() }}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] cursor-pointer text-sm aria-selected:bg-surface-2 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span>Create new issue</span>
                </Command.Item>
              )}
              <Command.Item value="go-board" onSelect={() => go('/')} className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] cursor-pointer text-sm aria-selected:bg-surface-2 transition-colors">
                <Columns3 className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span>All projects</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
