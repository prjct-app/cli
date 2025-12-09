'use client'

/**
 * Terminal Tabs Context - Manage multiple terminal sessions
 */

import { createContext, useContext, useCallback, useState, useRef, ReactNode } from 'react'

export interface TerminalSession {
  id: string
  createdAt: Date
  isConnected: boolean
  isLoading: boolean
  label: string
}

interface TerminalTabsContextType {
  sessions: TerminalSession[]
  activeSessionId: string | null
  createSession: () => string
  closeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<TerminalSession>) => void
  getActiveSession: () => TerminalSession | null
  sendCommandToActive: (command: string) => void
  registerSendInput: (sessionId: string, fn: (data: string) => void) => void
  registerFocusTerminal: (sessionId: string, fn: () => void) => void
  focusActiveTerminal: () => void
}

const TerminalTabsContext = createContext<TerminalTabsContextType | null>(null)

let sessionCounter = 0

export function TerminalTabsProvider({ children, projectId }: { children: ReactNode; projectId: string }) {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const sendInputRefs = useRef<Map<string, (data: string) => void>>(new Map())
  const focusTerminalRefs = useRef<Map<string, () => void>>(new Map())

  const createSession = useCallback(() => {
    sessionCounter++
    const newSession: TerminalSession = {
      id: `pty_${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
      isConnected: false,
      isLoading: true,
      label: `Terminal ${sessionCounter}`
    }

    setSessions(prev => [...prev, newSession])
    setActiveSessionId(newSession.id)
    return newSession.id
  }, [projectId])

  const closeSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId)
      // If closing active session, switch to last remaining
      if (sessionId === activeSessionId && filtered.length > 0) {
        setActiveSessionId(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveSessionId(null)
      }
      return filtered
    })
    sendInputRefs.current.delete(sessionId)
    focusTerminalRefs.current.delete(sessionId)
  }, [activeSessionId])

  const setActiveSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  const updateSession = useCallback((sessionId: string, updates: Partial<TerminalSession>) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, ...updates } : s
    ))
  }, [])

  const getActiveSession = useCallback(() => {
    return sessions.find(s => s.id === activeSessionId) || null
  }, [sessions, activeSessionId])

  const registerSendInput = useCallback((sessionId: string, fn: (data: string) => void) => {
    sendInputRefs.current.set(sessionId, fn)
  }, [])

  const registerFocusTerminal = useCallback((sessionId: string, fn: () => void) => {
    focusTerminalRefs.current.set(sessionId, fn)
  }, [])

  const focusActiveTerminal = useCallback(() => {
    if (!activeSessionId) return
    const focusFn = focusTerminalRefs.current.get(activeSessionId)
    if (focusFn) focusFn()
  }, [activeSessionId])

  const sendCommandToActive = useCallback((command: string) => {
    if (!activeSessionId) return
    const sendFn = sendInputRefs.current.get(activeSessionId)
    const session = sessions.find(s => s.id === activeSessionId)
    if (sendFn && session?.isConnected) {
      sendFn(command + '\n')
      // Auto-focus terminal after sending command
      const focusFn = focusTerminalRefs.current.get(activeSessionId)
      if (focusFn) focusFn()
    }
  }, [activeSessionId, sessions])

  return (
    <TerminalTabsContext.Provider value={{
      sessions,
      activeSessionId,
      createSession,
      closeSession,
      setActiveSession,
      updateSession,
      getActiveSession,
      sendCommandToActive,
      registerSendInput,
      registerFocusTerminal,
      focusActiveTerminal
    }}>
      {children}
    </TerminalTabsContext.Provider>
  )
}

export function useTerminalTabs() {
  const context = useContext(TerminalTabsContext)
  if (!context) {
    throw new Error('useTerminalTabs must be used within TerminalTabsProvider')
  }
  return context
}
