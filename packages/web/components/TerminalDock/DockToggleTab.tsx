'use client'

import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DockToggleTabProps {
  sessionCount: number
  connectedCount: number
  onClick: () => void
}

export function DockToggleTab({ sessionCount, connectedCount, onClick }: DockToggleTabProps) {
  const hasActiveSessions = sessionCount > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-2 px-4 py-2 rounded-t-lg',
        'bg-orange-500 hover:bg-orange-600 text-white',
        'shadow-lg transition-all duration-200',
        'hover:-translate-y-0.5'
      )}
    >
      <ChevronUp className="w-4 h-4" />
    </button>
  )
}
