import { useMemo, useState } from 'react'
import { Clock, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { typeColor } from '@/lib/taskStyles'
import { formatDate, formatDuration } from '@/lib/dates'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function HistoryTab() {
  const { history } = useTabCtx()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const types = useMemo(
    () => Array.from(new Set(history.map(h => h.classification).filter(Boolean))),
    [history]
  )

  const filtered = history.filter(h => {
    if (search && !`${h.title} ${h.classification} ${h.branchName || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter.length > 0 && !typeFilter.includes(h.classification)) return false
    return true
  })

  const hasActiveFilter = !!(search || typeFilter.length)

  return (
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history…"
              className="h-8 text-sm pl-8"
            />
          </div>
          <FilterDropdown label="Type" options={types} value={typeFilter} onChange={setTypeFilter} />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setSearch(''); setTypeFilter([]) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 h-8"
            >
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={hasActiveFilter ? 'No matches' : 'No task history'}
            description={hasActiveFilter ? 'Try adjusting your filters' : 'Completed tasks will appear here'}
          />
        ) : (
          <div>
            {filtered.map((h, i) => {
              const dur = formatDuration(h.startedAt, h.completedAt)
              return (
                <div key={h.taskId || i} className="flex gap-3 py-2.5 border-b border-border last:border-0">
                  <Clock className={cn("h-3.5 w-3.5 mt-1 shrink-0", typeColor(h.classification))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{h.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-micro text-muted-foreground flex-wrap">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 font-medium capitalize", typeColor(h.classification))}>
                        {h.classification}
                      </span>
                      {dur && <span className="font-mono">{dur}</span>}
                      {(h.tokensIn || h.tokensOut) && (
                        <span className="font-mono tabular-nums text-muted-foreground/80">
                          {formatTokens((h.tokensIn || 0) + (h.tokensOut || 0))} tok
                        </span>
                      )}
                      {h.branchName && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono truncate max-w-[200px] cursor-help">{h.branchName}</span>
                          </TooltipTrigger>
                          <TooltipContent>{h.branchName}</TooltipContent>
                        </Tooltip>
                      )}
                      <span className="ml-auto">{formatDate(h.completedAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
