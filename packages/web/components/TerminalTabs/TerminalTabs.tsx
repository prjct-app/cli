'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { useTerminalTabs } from '@/context/TerminalTabsContext'
import { TerminalTab } from './TerminalTab'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { X, Terminal as TerminalIcon, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalTabsProps {
  projectDir: string
}

export function TerminalTabs({ projectDir }: TerminalTabsProps) {
  const {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    setActiveSession,
    updateSession
  } = useTerminalTabs()

  const [sessionToClose, setSessionToClose] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCloseTab = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const session = sessions.find(s => s.id === sessionId)
    if (session?.isConnected) {
      setSessionToClose(sessionId)
    } else {
      closeSession(sessionId)
    }
  }, [sessions, closeSession])

  const handleConfirmClose = useCallback(() => {
    if (sessionToClose) {
      // Call disconnect on the terminal
      const disconnectFn = (window as unknown as Record<string, () => void>)[`terminal_disconnect_${sessionToClose}`]
      if (disconnectFn) disconnectFn()
      closeSession(sessionToClose)
      setSessionToClose(null)
    }
  }, [sessionToClose, closeSession])

  const startEditing = useCallback((sessionId: string, currentLabel: string) => {
    setEditingSessionId(sessionId)
    setEditValue(currentLabel)
  }, [])

  const finishEditing = useCallback(() => {
    if (editingSessionId && editValue.trim()) {
      updateSession(editingSessionId, { label: editValue.trim() })
    }
    setEditingSessionId(null)
    setEditValue('')
  }, [editingSessionId, editValue, updateSession])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing()
    } else if (e.key === 'Escape') {
      setEditingSessionId(null)
      setEditValue('')
    }
  }, [finishEditing])

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSessionId])

  const hasNoSessions = sessions.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar - scrollable on mobile */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-border min-h-[44px] md:min-h-[40px] overflow-x-auto scrollbar-hide">
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            onDoubleClick={() => startEditing(session.id, session.label)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveSession(session.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-md text-sm transition-colors cursor-pointer shrink-0',
              'hover:bg-muted active:bg-muted/80',
              'min-h-[36px] md:min-h-0', // Touch-friendly height on mobile
              session.id === activeSessionId
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {session.isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : session.isConnected ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 shrink-0" />
            )}
            {editingSessionId === session.id ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-[100px] bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <span className="truncate max-w-[80px] md:max-w-[100px]">{session.label}</span>
            )}
            <button
              onClick={(e) => handleCloseTab(session.id, e)}
              className="p-1 md:p-0.5 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4 md:w-3 md:h-3" />
            </button>
          </div>
        ))}

        {/* New tab button - larger touch target on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:h-7 md:w-7 ml-1 shrink-0"
          onClick={createSession}
        >
          <Plus className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
      </div>

      {/* Terminal area */}
      <div className="flex-1 relative">
        {hasNoSessions ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
            <div className="text-center max-w-xs">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 md:mb-4">
                <TerminalIcon className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground" />
              </div>
              <h2 className="text-base md:text-lg font-medium mb-1.5 md:mb-2">No active sessions</h2>
              <p className="text-muted-foreground text-sm mb-3 md:mb-4">
                Tap + to create a new terminal
              </p>
              <Button onClick={createSession} className="min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                New Terminal
              </Button>
            </div>
          </div>
        ) : (
          sessions.map(session => (
            <TerminalTab
              key={session.id}
              session={session}
              projectDir={projectDir}
              isActive={session.id === activeSessionId}
            />
          ))
        )}
      </div>

      {/* Close confirmation dialog - responsive */}
      <AlertDialog open={!!sessionToClose} onOpenChange={(open: boolean) => !open && setSessionToClose(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              Close Terminal?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This terminal has an active session. Closing it will terminate the connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
            >
              Close Terminal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
