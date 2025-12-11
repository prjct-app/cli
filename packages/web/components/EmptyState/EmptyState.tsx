'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import type { EmptyStateProps } from './EmptyState.types'

export function EmptyState({
  icon: Icon,
  title,
  description,
  command,
  href,
  className,
  compact = false,
}: EmptyStateProps) {
  // Command button content
  const CommandButton = href ? (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors group border border-emerald-500/20"
    >
      {command}
      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  ) : command ? (
    <button
      onClick={() => navigator.clipboard.writeText(command)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono hover:bg-muted/80"
    >
      {command}
    </button>
  ) : null

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Icon className="h-4 w-4" />
        <span className="text-sm">{title}</span>
        {CommandButton}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-4', className)}>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
      )}
      {command && (
        <div className="mt-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors group border border-emerald-500/20"
            >
              {command}
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={() => navigator.clipboard.writeText(command)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs font-mono text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              {command}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
