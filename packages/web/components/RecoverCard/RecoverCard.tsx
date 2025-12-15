'use client'

import Link from 'next/link'
import { AlertCircle, ChevronRight, Clock, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RecoverCardProps } from './RecoverCard.types'

export function RecoverCard({ abandonedSessions, codeHref, className }: RecoverCardProps) {
  if (abandonedSessions.length === 0) return null

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 min-w-0 max-w-full',
      className
    )}>
      <div className="flex items-center justify-between mb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-yellow-600 dark:text-yellow-500 truncate">
            Recover
          </span>
        </div>
        <Badge variant="outline" className="text-yellow-600 dark:text-yellow-500 border-yellow-500/50 shrink-0">
          {abandonedSessions.length}
        </Badge>
      </div>

      <div className="space-y-2 min-w-0 max-w-full">
        {abandonedSessions.slice(0, 3).map((session) => (
          <Link
            key={session.id}
            href={`${codeHref}?cmd=p.%20recover`}
            className="block py-2 px-2 -mx-2 hover:bg-yellow-500/10 rounded-lg transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate group-hover:text-foreground transition-colors">
                  {session.task}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{session.hoursAgo}h ago</span>
                  {session.projectName && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="truncate">{session.projectName}</span>
                    </>
                  )}
                </div>
                {session.prompt && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground/70 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground/70 italic line-clamp-2">
                      &quot;{session.prompt.slice(0, 80)}{session.prompt.length > 80 ? '...' : ''}&quot;
                    </p>
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
            </div>
          </Link>
        ))}
        {abandonedSessions.length > 3 && (
          <p className="text-xs text-yellow-600/70 dark:text-yellow-500/70 text-center pt-1">
            +{abandonedSessions.length - 3} more abandoned sessions
          </p>
        )}
      </div>
    </div>
  )
}
