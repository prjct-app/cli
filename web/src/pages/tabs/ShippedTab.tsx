import { useMemo, useState } from 'react'
import { Rocket, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { typeColor } from '@/lib/taskStyles'
import { formatDate } from '@/lib/dates'

export function ShippedTab() {
  const { data } = useTabCtx()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const items = data.shipped?.shipped || []
  const types = useMemo(
    () => Array.from(new Set(items.map(i => i.type).filter(Boolean) as string[])),
    [items]
  )

  const filtered = items.filter(i => {
    if (search && !`${i.name} ${i.version || ''} ${i.type || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter.length > 0 && !typeFilter.includes(i.type || '')) return false
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
              placeholder="Search releases…"
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
            icon={Rocket}
            title={hasActiveFilter ? 'No matches' : 'Nothing shipped yet'}
            description={hasActiveFilter ? 'Try adjusting your filters' : 'Completed releases will appear here'}
          />
        ) : (
          <div>
            {filtered.map((item, i) => (
              <div key={item.id || i} className="flex gap-4 py-3 border-b border-border last:border-0">
                <div className="flex flex-col items-center pt-0.5">
                  <Rocket className={cn("h-4 w-4 shrink-0", typeColor(item.type))} />
                  {i < filtered.length - 1 && <div className="w-px flex-1 bg-border mt-1.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {item.version && (
                      <span className="font-mono text-micro bg-surface-2 text-foreground px-2 py-0.5 rounded-full">
                        {item.version}
                      </span>
                    )}
                    {item.type && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium capitalize", typeColor(item.type))}>
                        {item.type}
                      </span>
                    )}
                    <span className="text-micro text-muted-foreground ml-auto">{formatDate(item.shippedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
