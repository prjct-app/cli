'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/EmptyState'
import { ExpandButton } from '@/components/ExpandButton'
import { Lightbulb, Sparkles, Rocket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IdeasCardProps } from './IdeasCard.types'

const COLLAPSED_LIMIT = 8
const EXPANDED_LIMIT = 30

export function IdeasCard({ ideas, codeHref, className }: IdeasCardProps) {
  const [expanded, setExpanded] = useState(false)
  const limit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT
  const displayIdeas = ideas.slice(0, limit)
  const highImpactCount = ideas.filter(i => i.impact === 'HIGH').length
  const hasMore = ideas.length > limit

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card p-4',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Ideas
          </span>
        </div>
        <div className="flex items-center gap-2">
          {highImpactCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {highImpactCount} high impact
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {ideas.length}
          </span>
        </div>
      </div>

      {ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          command="/p:idea"
          href={codeHref}
          compact
        />
      ) : (
        <div className="space-y-1">
          {displayIdeas.map((idea, i) => {
            const featureHref = codeHref
              ? `${codeHref}?cmd=${encodeURIComponent(`p. feature "${idea.title}"`)}`
              : undefined
            const deleteHref = codeHref
              ? `${codeHref}?cmd=${encodeURIComponent(`p. idea remove ${i + 1}`)}`
              : undefined

            return (
              <div
                key={i}
                className="flex items-start gap-2 py-1.5 group hover:bg-muted/50 rounded px-1 -mx-1"
              >
                {idea.impact === 'HIGH' ? (
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <p className={cn(
                  'text-sm flex-1 min-w-0',
                  idea.impact === 'HIGH' && 'font-medium'
                )}>
                  {idea.title}
                </p>
                {/* Always visible action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {featureHref && (
                    <Link
                      href={featureHref}
                      className="p-1 rounded hover:bg-blue-500/20 text-muted-foreground hover:text-blue-600 transition-colors"
                      title="Convert to feature"
                    >
                      <Rocket className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {deleteHref && (
                    <Link
                      href={deleteHref}
                      className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Delete idea"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {(hasMore || expanded) && ideas.length > COLLAPSED_LIMIT && (
            <ExpandButton
              expanded={expanded}
              totalCount={ideas.length}
              collapsedLimit={COLLAPSED_LIMIT}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </div>
      )}
    </div>
  )
}
