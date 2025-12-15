'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ExpandButton } from '@/components/ExpandButton'
import { Rocket, Clock, FileCode, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatShipDate } from './ShipsCard.utils'
import type { ShipsCardProps } from './ShipsCard.types'

const COLLAPSED_LIMIT = 10

export function ShipsCard({ ships, totalShips = 0, codeHref, className }: ShipsCardProps) {
  const [expanded, setExpanded] = useState(false)
  const displayShips = expanded ? ships : ships.slice(0, COLLAPSED_LIMIT)
  const hasMore = ships.length > COLLAPSED_LIMIT

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Shipped
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {totalShips} total
        </span>
      </div>

      {ships.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nothing shipped yet"
          description="Ship your first feature"
          command="/p:ship"
          href={codeHref}
          compact
        />
      ) : (
        <div className="space-y-2">
          {displayShips.map((ship, i) => (
            <div key={i} className="group py-1.5 hover:bg-muted/50 rounded px-2 -mx-2 border-l-2 border-transparent hover:border-foreground/20">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium truncate">
                      {ship.name}
                    </p>
                    {ship.version && (
                      <Badge variant="outline" className="text-xs px-1 py-0 font-mono shrink-0 h-4">
                        {ship.version}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-5">
                    <span className="text-xs text-muted-foreground">
                      {formatShipDate(ship.date)}
                    </span>
                    {ship.duration && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {ship.duration}
                      </span>
                    )}
                    {ship.filesChanged && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <FileCode className="h-2.5 w-2.5" />
                        {ship.filesChanged} files
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <ExpandButton
              expanded={expanded}
              totalCount={ships.length}
              collapsedLimit={COLLAPSED_LIMIT}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </div>
      )}
    </div>
  )
}
