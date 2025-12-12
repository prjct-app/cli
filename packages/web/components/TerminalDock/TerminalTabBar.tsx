'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GlobalTerminalSession } from '@/context/GlobalTerminalContext'

interface TerminalTabBarProps {
  sessions: GlobalTerminalSession[]
  activeSessionId: string | null
  onSwitchSession: (sessionId: string) => void
  onCloseSession: (sessionId: string) => void
  onNewTerminal: () => void
  onRenameSession: (sessionId: string, newLabel: string) => void
}

export function TerminalTabBar({
  sessions,
  activeSessionId,
  onSwitchSession,
  onCloseSession,
  onNewTerminal,
  onRenameSession,
}: TerminalTabBarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Group sessions by project
  const sessionsByProject = sessions.reduce((acc, session) => {
    const existing = acc.find(g => g.projectId === session.projectId)
    if (existing) {
      existing.sessions.push(session)
    } else {
      acc.push({
        projectId: session.projectId,
        projectName: session.projectName,
        sessions: [session],
      })
    }
    return acc
  }, [] as { projectId: string; projectName: string; sessions: GlobalTerminalSession[] }[])

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSessionId])

  const handleDoubleClick = (session: GlobalTerminalSession) => {
    setEditingSessionId(session.id)
    setEditValue(session.label)
  }

  const handleBlur = () => {
    if (editingSessionId && editValue.trim()) {
      onRenameSession(editingSessionId, editValue.trim())
    }
    setEditingSessionId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditingSessionId(null)
    }
  }

  return (
    <div className="flex items-center gap-0.5 flex-1 overflow-x-auto py-1 px-1">
      {sessionsByProject.map((group, groupIndex) => (
        <div key={group.projectId} className="flex items-center">
          {/* Group separator */}
          {groupIndex > 0 && (
            <div className="w-px h-5 bg-border mx-2" />
          )}

          {/* Tabs for this project */}
          {group.sessions.map((session) => {
            const isActive = session.id === activeSessionId
            const isEditing = session.id === editingSessionId

            return (
              <button
                key={session.id}
                onClick={() => onSwitchSession(session.id)}
                onDoubleClick={() => handleDoubleClick(session)}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all relative',
                  // Chrome-style: rounded top corners, flat bottom
                  'rounded-t-md',
                  isActive
                    ? 'bg-card border-t border-l border-r border-border text-foreground -mb-px z-10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {/* Label - editable or display */}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-24 bg-transparent border-b border-orange-500 outline-none text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate max-w-[120px]">
                    {session.label}
                  </span>
                )}

                {/* Close button */}
                <X
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseSession(session.id)
                  }}
                />
              </button>
            )
          })}
        </div>
      ))}

      {/* Add Terminal Button */}
      <button
        onClick={onNewTerminal}
        className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors ml-1"
        title="New terminal"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}
