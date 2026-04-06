import { useMemo, useState } from 'react'
import { Check, Lightbulb, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/ui/icon-button'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { priorityColor } from '@/lib/taskStyles'
import { formatDate } from '@/lib/dates'

export function IdeasTab() {
  const { data, projectId, refresh } = useTabCtx()
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])

  const pending = (data.ideas?.ideas || []).filter(i => i.status === 'pending')
  const priorities = useMemo(
    () => Array.from(new Set(pending.map(i => i.priority).filter(Boolean))),
    [pending]
  )
  const tags = useMemo(
    () => Array.from(new Set(pending.flatMap(i => i.tags || []))),
    [pending]
  )

  const filtered = pending.filter(i => {
    if (search && !`${i.text} ${(i.tags || []).join(' ')} ${i.priority}`.toLowerCase().includes(search.toLowerCase())) return false
    if (priorityFilter.length > 0 && !priorityFilter.includes(i.priority)) return false
    if (tagFilter.length > 0 && !(i.tags || []).some(t => tagFilter.includes(t))) return false
    return true
  })

  const hasActiveFilter = !!(search || priorityFilter.length || tagFilter.length)

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ideas…"
              className="h-8 text-sm pl-8"
            />
          </div>
          <FilterDropdown label="Priority" options={priorities} value={priorityFilter} onChange={setPriorityFilter} />
          <FilterDropdown label="Tags" options={tags} value={tagFilter} onChange={setTagFilter} />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPriorityFilter([]); setTagFilter([]) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 h-8"
            >
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={hasActiveFilter ? 'No matches' : 'No ideas yet'}
            description={hasActiveFilter ? 'Try adjusting your filters' : 'Ask Claude to capture ideas for you'}
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((idea) => (
              <div
                key={idea.id}
                className="group rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-foreground/15"
              >
                {/* Row 1: Priority badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium capitalize", priorityColor(idea.priority))}>
                    {idea.priority}
                  </span>
                </div>
                {/* Row 2: Icon + text */}
                <div className="flex items-start gap-2">
                  <Lightbulb className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", priorityColor(idea.priority))} />
                  <p className="text-[13px] leading-snug text-foreground/90 flex-1">{idea.text}</p>
                </div>
                {/* Row 3: Tags + actions */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button type="button" className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors">
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                  {(idea.tags || []).map(tag => (
                    <span key={tag} className="text-micro text-muted-foreground bg-surface-2 rounded-full px-2 py-0.5">
                      #{tag}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted-foreground/40 ml-auto">Created {formatDate(idea.addedAt)}</span>
                </div>
                {/* Row 4: Hover actions */}
                <div className="flex gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton
                    label="Archive"
                    icon={Check}
                    size="sm"
                    onClick={() => api.archiveIdea(projectId, idea.id).then(refresh)}
                  />
                  <IconButton
                    label="Delete"
                    icon={Trash2}
                    size="sm"
                    tone="destructive"
                    onClick={() => api.deleteIdea(projectId, idea.id).then(refresh)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
