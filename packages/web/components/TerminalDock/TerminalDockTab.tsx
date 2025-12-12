'use client'

/**
 * TerminalDockTab - Single terminal instance for the dock
 * With ResizeObserver for proper fit on resize
 */

import { useEffect, useRef, useCallback } from 'react'
import { useClaudeTerminal } from '@/hooks/useClaudeTerminal'
import { useGlobalTerminal, type GlobalTerminalSession } from '@/context/GlobalTerminalContext'

interface TerminalDockTabProps {
  session: GlobalTerminalSession
  isActive: boolean
}

export function TerminalDockTab({ session, isActive }: TerminalDockTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const hasConnectedRef = useRef(false)
  const fitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { updateSession, registerSendInput, registerFocusTerminal, dockHeight } = useGlobalTerminal()

  const handleConnect = useCallback(() => {
    updateSession(session.id, { isConnected: true, isLoading: false })
  }, [session.id, updateSession])

  const handleDisconnect = useCallback(() => {
    updateSession(session.id, { isConnected: false, isLoading: false })
  }, [session.id, updateSession])

  const handleError = useCallback((error: string) => {
    console.error(`[TerminalDock ${session.id}] Error:`, error)
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
    projectDir: session.projectPath,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  })

  // Debounced fit function
  const debouncedFit = useCallback(() => {
    if (fitTimeoutRef.current) {
      clearTimeout(fitTimeoutRef.current)
    }
    fitTimeoutRef.current = setTimeout(() => {
      if (isActive && hasInitializedRef.current) {
        fit()
      }
    }, 50)
  }, [fit, isActive])

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

  // Re-fit terminal when tab becomes active or dock height changes
  useEffect(() => {
    if (isActive && hasInitializedRef.current) {
      requestAnimationFrame(() => {
        fit()
      })
    }
  }, [isActive, fit, dockHeight])

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!wrapperRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      debouncedFit()
    })

    resizeObserver.observe(wrapperRef.current)

    return () => {
      resizeObserver.disconnect()
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current)
      }
    }
  }, [debouncedFit])

  // Register sendInput and focusTerminal for this session
  useEffect(() => {
    registerSendInput(session.id, sendInput)
    registerFocusTerminal(session.id, focusTerminal)
  }, [session.id, sendInput, focusTerminal, registerSendInput, registerFocusTerminal])

  // Expose disconnect for external use
  useEffect(() => {
    const key = `terminal_disconnect_${session.id}`
    ;(window as unknown as Record<string, () => void>)[key] = disconnect
    return () => {
      delete (window as unknown as Record<string, () => void>)[key]
    }
  }, [session.id, disconnect])

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 bg-[#0a0a0f] px-2 py-2"
      style={{ display: isActive ? 'block' : 'none' }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
