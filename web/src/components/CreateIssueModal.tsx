import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { api } from '@/api/client'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusIcon } from '@/components/shared/StatusIcon'
import { PriorityIcon } from '@/components/shared/PriorityIcon'
import { TYPE_DOT } from '@/components/shared/constants'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PRIORITY_LABEL, TYPE_LABEL } from '@/lib/taskStyles'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'active', label: 'In Progress' },
]
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const TYPES = ['bug', 'feature', 'improvement', 'chore', 'security']

export function CreateIssueModal({ projectId, open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('backlog')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await api.addQueueTask(projectId, {
        description: title.trim(),
        priority: priority || 'medium',
        type: type || 'feature',
        section: status,
      })
      // Update body if description provided
      setTitle('')
      setDescription('')
      setStatus('backlog')
      setPriority('')
      setType('')
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[580px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="bg-surface-2 rounded px-1.5 py-0.5 font-medium">P.</span>
          <span>New issue</span>
        </div>

        {/* Title */}
        <div className="px-5">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Issue title"
            autoFocus
            className="w-full text-base font-medium bg-transparent outline-none border-none placeholder:text-muted-foreground/30"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && title.trim()) handleCreate() }}
          />
        </div>

        {/* Description */}
        <div className="px-5 pb-3">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add description…"
            rows={3}
            className="w-full text-sm bg-transparent outline-none border-none resize-none placeholder:text-muted-foreground/30 text-foreground/80"
          />
        </div>

        {/* Bottom bar */}
        <div className="px-4 py-3 border-t border-border flex items-center gap-1.5">
          {/* Status chip */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-xs hover:bg-surface-2 transition-colors outline-none">
              <StatusIcon section={status} size="xs" />
              {STATUSES.find(s => s.value === status)?.label || 'Backlog'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {STATUSES.map(s => (
                <DropdownMenuItem key={s.value} onClick={() => setStatus(s.value)} className="text-xs gap-2">
                  <StatusIcon section={s.value} size="xs" /> {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority chip */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-xs hover:bg-surface-2 transition-colors outline-none">
              {priority ? <PriorityIcon priority={priority} size="sm" /> : <span className="text-muted-foreground/50">···</span>}
              {priority ? PRIORITY_LABEL[priority] : 'Priority'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {PRIORITIES.map(p => (
                <DropdownMenuItem key={p} onClick={() => setPriority(p)} className="text-xs gap-2">
                  <PriorityIcon priority={p} size="sm" /> {PRIORITY_LABEL[p]}
                  <span className="ml-auto text-muted-foreground/40 tabular-nums text-[10px]">
                    {p === 'critical' ? 1 : p === 'high' ? 2 : p === 'medium' ? 3 : 4}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type/Label chip */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-xs hover:bg-surface-2 transition-colors outline-none">
              {type
                ? <><span className={cn("h-[6px] w-[6px] rounded-full", TYPE_DOT[type])} />{TYPE_LABEL[type]}</>
                : <span className="text-muted-foreground/50">Label</span>
              }
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {TYPES.map(t => (
                <DropdownMenuItem key={t} onClick={() => setType(t)} className="text-xs gap-2">
                  <span className={cn("h-[7px] w-[7px] rounded-full", TYPE_DOT[t])} />
                  {TYPE_LABEL[t] || t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground/30 cursor-pointer hover:text-muted-foreground transition-colors" />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!title.trim() || saving}
              className="h-7 px-4 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
            >
              {saving ? 'Creating…' : 'Create issue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
