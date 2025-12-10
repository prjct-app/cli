'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useClaudeTerminal } from '@/hooks/useClaudeTerminal'
import { useTerminalTabs, type TerminalSession } from '@/context/TerminalTabsContext'

interface TerminalTabProps {
  session: TerminalSession
  projectDir: string
  isActive: boolean
}

export function TerminalTab({ session, projectDir, isActive }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const hasConnectedRef = useRef(false)
  const { updateSession, registerSendInput, registerFocusTerminal } = useTerminalTabs()

  const handleConnect = useCallback(() => {
    updateSession(session.id, { isConnected: true, isLoading: false })
  }, [session.id, updateSession])

  const handleDisconnect = useCallback(() => {
    updateSession(session.id, { isConnected: false, isLoading: false })
  }, [session.id, updateSession])

  const handleError = useCallback((error: string) => {
    console.error(`[Terminal ${session.id}] Error:`, error)
    updateSession(session.id, { isLoading: false })
  }, [session.id, updateSession])

  const {
    initTerminal,
    connect,
    disconnect,
    sendInput,
    focusTerminal,
    fit,
  } = useClaudeTerminal({
    sessionId: session.id,
    projectDir,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  })

  // Initialize terminal AND connect - only once
  useEffect(() => {
    if (containerRef.current && !hasInitializedRef.current) {
      hasInitializedRef.current = true

      initTerminal(containerRef.current).then(() => {
        if (!hasConnectedRef.current) {
          hasConnectedRef.current = true
          connect()
        }
      })
    }
  }, []) // Empty deps - run only on mount

  // Re-fit terminal when tab becomes active (fixes resize issues when tab was hidden)
  useEffect(() => {
    if (isActive && hasInitializedRef.current) {
      // Use requestAnimationFrame to ensure container is fully visible
      requestAnimationFrame(() => {
        fit()
      })
    }
  }, [isActive, fit])

  // Register sendInput and focusTerminal for this session
  useEffect(() => {
    registerSendInput(session.id, sendInput)
    registerFocusTerminal(session.id, focusTerminal)
  }, [session.id, sendInput, focusTerminal, registerSendInput, registerFocusTerminal])

  // Expose disconnect for external use
  useEffect(() => {
    // Store disconnect function on window for access from parent
    const key = `terminal_disconnect_${session.id}`
    ;(window as unknown as Record<string, () => void>)[key] = disconnect
    return () => {
      delete (window as unknown as Record<string, () => void>)[key]
    }
  }, [session.id, disconnect])

  return (
    <div
      className="absolute inset-0 bg-[#0a0a0f] px-2 py-2"
      style={{ display: isActive ? 'block' : 'none' }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
