'use client'

import { cn } from '@/lib/utils'
import { Copy } from 'lucide-react'
import type { EmptyStateProps } from './EmptyState.types'

export function EmptyState({
  icon: Icon,
  title,
  description,
  command,
  className,
  compact = false,
}: EmptyStateProps) {
  const handleCopy = () => {
    if (command) {
      navigator.clipboard.writeText(command)
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Icon className="h-4 w-4" />
        <span className="text-sm">{title}</span>
        {command && (
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono hover:bg-muted/80"
          >
            {command}
          </button>
        )}
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
        <button
          onClick={handleCopy}
          className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs font-mono text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors group"
        >
          {command}
          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  )
}
