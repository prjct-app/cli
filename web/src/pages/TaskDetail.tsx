import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Circle,
  Paperclip, Pencil, Smile, Trash2, X
} from 'lucide-react'
import { api, type QueueTask, type TaskComment } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/dates'
import { PRIORITY_LABEL, TYPE_LABEL, priorityDot } from '@/lib/taskStyles'

// ═══════════════════════════════════════════════════════════════════════
// Priority icons — Linear-style colored bars
// ═══════════════════════════════════════════════════════════════════════
function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const bars = priority === 'critical' || priority === 'urgent' ? 4
    : priority === 'high' ? 3
    : priority === 'medium' ? 2
    : priority === 'low' ? 1 : 0
  const color = priority === 'critical' || priority === 'urgent' ? 'bg-orange-500'
    : priority === 'high' ? 'bg-orange-400'
    : priority === 'medium' ? 'bg-amber-400'
    : priority === 'low' ? 'bg-blue-400' : 'bg-muted-foreground/30'
  if (bars === 0) return <span className={cn("inline-flex items-end gap-[1.5px] h-3.5 w-3.5", className)}><span className="text-micro text-muted-foreground">—</span></span>
  return (
    <span className={cn("inline-flex items-end gap-[1.5px] h-3.5", className)}>
      {[1,2,3,4].map(i => (
        <span key={i} className={cn("w-[2.5px] rounded-[0.5px]", i <= bars ? color : 'bg-muted-foreground/15')}
          style={{ height: `${40 + i * 15}%` }} />
      ))}
    </span>
  )
}

function StatusIcon({ section, size = 'sm' }: { section: string; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  if (section === 'active')
    return <span className={cn(s, "rounded-full border-[2px] border-amber-500 shrink-0")} />
  if (section === 'previously_active')
    return <span className={cn(s, "rounded-full bg-indigo-500 flex items-center justify-center shrink-0")}><Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /></span>
  return <Circle className={cn(s, "text-muted-foreground/60 shrink-0")} />
}

const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'active', label: 'In Progress' },
  { value: 'previously_active', label: 'Done' },
]
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const TYPES = ['bug', 'feature', 'improvement', 'chore', 'security']

const TYPE_DOT: Record<string, string> = {
  bug: 'bg-red-500', feature: 'bg-indigo-500', improvement: 'bg-teal-500',
  security: 'bg-purple-500', chore: 'bg-muted-foreground',
}

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useApi(
    () => api.getQueueTask(projectId!, taskId!), [projectId, taskId]
  )

  if (loading) return (
    <div className="h-full">
      <div className="h-11 border-b border-border" />
      <div className="max-w-3xl mx-auto px-10 py-10 space-y-4">
        <div className="h-8 w-[420px] bg-surface-2 rounded animate-pulse" />
        <div className="h-32 bg-surface-2 rounded animate-pulse" />
      </div>
    </div>
  )
  if (error || !data?.task) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-destructive">{error || 'Task not found'}</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go back
        </Button>
      </div>
    </div>
  )

  return <Detail task={data.task} comments={data.comments || []} projectId={projectId!} taskId={taskId!} refresh={refresh} />
}

// ═══════════════════════════════════════════════════════════════════════
// Detail view
// ═══════════════════════════════════════════════════════════════════════

function Detail({ task, comments, projectId, taskId, refresh }: {
  task: QueueTask; comments: TaskComment[]; projectId: string; taskId: string; refresh: () => void
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(task.description)
  const [body, setBody] = useState(task.body || '')
  const [titleDirty, setTitleDirty] = useState(false)
  const [bodyDirty, setBodyDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTitle(task.description); setBody(task.body || ''); setTitleDirty(false); setBodyDirty(false) }, [task.description, task.body])
  useEffect(() => { if (titleRef.current) { titleRef.current.style.height = 'auto'; titleRef.current.style.height = titleRef.current.scrollHeight + 'px' } }, [title])

  const save = useCallback(async (u: Record<string, string>) => {
    setSaveStatus('saving')
    await api.updateQueueTask(projectId, taskId, u)
    setSaveStatus('saved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
    refresh()
  }, [projectId, taskId, refresh])

  const meta = (field: string, value: string) => api.updateQueueTask(projectId, taskId, { [field]: value }).then(refresh)

  return (
    <div className="h-full flex flex-col">
      {/* ─── Top bar ─── */}
      <div className="shrink-0 h-11 border-b border-border px-4 flex items-center gap-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => navigate(-1)} className="hover:text-foreground transition-colors p-1 rounded hover:bg-surface-2">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="h-4 w-px bg-border mx-1" />
        <Link to={`/project/${projectId}/board`} className="hover:text-foreground transition-colors">Board</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-micro text-muted-foreground">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-micro text-status-active">Saved</span>}
        </span>
      </div>

      {/* ─── Body ─── */}
      <div className="flex-1 overflow-y-auto flex">
        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-10 py-8">
            {/* Title */}
            <textarea
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleDirty(true) }}
              onBlur={() => { if (titleDirty && title.trim() !== task.description) { save({ description: title.trim() }); setTitleDirty(false) } }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleRef.current?.blur() } }}
              rows={1}
              className="w-full text-xl font-semibold leading-tight bg-transparent outline-none border-none resize-none overflow-hidden placeholder:text-muted-foreground/30"
              placeholder="Issue title"
            />

            {/* Description */}
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setBodyDirty(true) }}
              onBlur={() => { if (bodyDirty && body !== (task.body || '')) { save({ body }); setBodyDirty(false) } }}
              rows={body ? Math.max(4, body.split('\n').length + 1) : 4}
              className="w-full mt-3 bg-transparent outline-none border-none resize-none text-sm leading-relaxed text-foreground/80 placeholder:text-muted-foreground/30"
              placeholder="Add description…"
            />

            {/* Toolbar */}
            <div className="flex items-center gap-1 mt-2 mb-6 text-muted-foreground/40">
              <Smile className="h-4 w-4 cursor-pointer hover:text-muted-foreground transition-colors" />
              <Paperclip className="h-4 w-4 cursor-pointer hover:text-muted-foreground transition-colors" />
            </div>

            <div className="border-t border-border" />

            {/* Activity */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Activity</h3>
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                <TimelineEvent icon={<Circle className="h-3 w-3 text-muted-foreground/60" />}>
                  <span className="text-muted-foreground">Issue created</span>
                  <span className="text-muted-foreground/60 ml-1">· {timeAgo(task.createdAt)}</span>
                </TimelineEvent>

                {comments.map(c => (
                  <Comment key={c.id} comment={c} projectId={projectId} taskId={taskId} refresh={refresh} />
                ))}
              </div>

              {/* New comment */}
              <NewComment projectId={projectId} taskId={taskId} refresh={refresh} />
            </div>
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="w-[260px] shrink-0 border-l border-border">
          <div className="sticky top-0 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Properties</p>

            {/* Status */}
            <SidebarProp label="Status">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 text-xs hover:bg-surface-2 rounded px-1.5 py-1 -mx-1.5 transition-colors outline-none w-full">
                  <StatusIcon section={task.section} />
                  <span>{STATUSES.find(s => s.value === task.section)?.label || task.section}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {STATUSES.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => meta('section', s.value)} className="text-xs gap-2">
                      <StatusIcon section={s.value} /> {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarProp>

            {/* Priority */}
            <SidebarProp label="Priority">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 text-xs hover:bg-surface-2 rounded px-1.5 py-1 -mx-1.5 transition-colors outline-none w-full">
                  <PriorityIcon priority={task.priority} />
                  <span>{PRIORITY_LABEL[task.priority] || task.priority}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {PRIORITIES.map(p => (
                    <DropdownMenuItem key={p} onClick={() => meta('priority', p)} className="text-xs gap-2">
                      <PriorityIcon priority={p} /> {PRIORITY_LABEL[p] || p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarProp>

            {/* Labels */}
            <div className="py-2.5 border-b border-border/60">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Labels</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 text-xs hover:bg-surface-2 rounded px-1.5 py-1 -mx-1.5 transition-colors outline-none">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", TYPE_DOT[task.type] || 'bg-muted-foreground')} />
                  <span>{TYPE_LABEL[task.type] || task.type || 'None'}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {TYPES.map(t => (
                    <DropdownMenuItem key={t} onClick={() => meta('type', t)} className="text-xs gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_DOT[t] || 'bg-muted-foreground')} />
                      {TYPE_LABEL[t] || t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Created */}
            <SidebarProp label="Created">
              <span className="text-xs text-muted-foreground px-1.5 py-1">{timeAgo(task.createdAt)}</span>
            </SidebarProp>

            {/* Actions */}
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => api.deleteQueueTask(projectId, taskId).then(() => navigate(`/project/${projectId}/board`))}
                className="flex items-center gap-2 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded px-1.5 py-1.5 -mx-1.5 transition-colors w-full"
              >
                <Trash2 className="h-3 w-3" /> Delete issue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarProp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-border/60">
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Activity
// ═══════════════════════════════════════════════════════════════════════

function TimelineEvent({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <div className="w-7 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 flex items-center">{children}</div>
    </div>
  )
}

function Comment({ comment, projectId, taskId, refresh }: {
  comment: TaskComment; projectId: string; taskId: string; refresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)

  return (
    <div className="group flex gap-3 py-3">
      <div className="w-7 flex justify-center shrink-0">
        <span className="h-7 w-7 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-bold text-foreground/70">
          {comment.author[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold">{comment.author}</span>
          <span className="text-micro text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          {comment.updatedAt !== comment.createdAt && <span className="text-micro text-muted-foreground">(edited)</span>}
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
            <IconButton label="Edit" icon={Pencil} size="sm" onClick={() => { setEditing(true); setEditContent(comment.content) }} />
            <IconButton label="Delete" icon={X} size="sm" tone="destructive" onClick={() => api.deleteComment(projectId, taskId, comment.id).then(refresh)} />
          </div>
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} autoFocus
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs px-2" onClick={async () => { await api.updateComment(projectId, taskId, comment.id, editContent.trim()); setEditing(false); refresh() }}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </div>
        )}
      </div>
    </div>
  )
}

function NewComment({ projectId, taskId, refresh }: { projectId: string; taskId: string; refresh: () => void }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim() || submitting) return
    setSubmitting(true)
    try { await api.addComment(projectId, taskId, value.trim()); setValue(''); refresh() }
    finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="rounded-lg border border-border focus-within:border-muted-foreground/30 transition-colors overflow-hidden">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Leave a comment…"
          rows={3}
          className="w-full bg-transparent px-3.5 py-2.5 text-sm resize-none outline-none placeholder:text-muted-foreground/40"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }}
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1 text-muted-foreground/40">
            <Paperclip className="h-3.5 w-3.5 cursor-pointer hover:text-muted-foreground transition-colors" />
          </div>
          <Button type="submit" size="sm" disabled={!value.trim() || submitting} className="h-6 text-xs px-3">
            Comment
          </Button>
        </div>
      </div>
    </form>
  )
}
