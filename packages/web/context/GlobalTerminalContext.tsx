'use client'

/**
 * Global Terminal Context - Manage terminal sessions across ALL projects
 *
 * Features:
 * - Multi-project session management (Map<projectId, sessions[]>)
 * - Bottom dock panel UI state (height, open/closed)
 * - Full-screen mode for code page
 * - Persistence to localStorage
 * - Cross-page navigation support
 */

import { createContext, useContext, useCallback, useState, useRef, useEffect, ReactNode } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface GlobalTerminalSession {
  id: string
  projectId: string
  projectName: string
  projectPath: string
  createdAt: Date
  isConnected: boolean
  isLoading: boolean
  label: string
  panel: 'left' | 'right'  // Which panel this session belongs to
}

export interface ProjectTerminals {
  projectId: string
  projectName: string
  projectPath: string
  sessions: GlobalTerminalSession[]
}

interface GlobalTerminalContextType {
  // Session management
  projectSessions: Map<string, ProjectTerminals>
  activeProjectId: string | null
  activeSessionId: string | null

  // Dock UI state
  isDockOpen: boolean
  dockHeight: number
  isFullScreen: boolean  // When true, terminal takes full main area (code page)
  isSplitEnabled: boolean  // Split view mode
  secondActiveSessionId: string | null  // Second panel session (for split)

  // Session actions
  createSessionForProject: (projectId: string, projectName: string, projectPath: string, panel?: 'left' | 'right') => string
  closeSession: (sessionId: string) => void
  switchProject: (projectId: string) => void
  switchSession: (sessionId: string, panel?: 'left' | 'right') => void
  updateSession: (sessionId: string, updates: Partial<GlobalTerminalSession>) => void

  // Dock UI actions
  openDock: () => void
  closeDock: () => void
  toggleDock: () => void
  setDockHeight: (height: number) => void
  setFullScreen: (isFullScreen: boolean) => void
  setSplitEnabled: (enabled: boolean) => void

  // Helpers
  getActiveSession: () => GlobalTerminalSession | null
  getSecondActiveSession: () => GlobalTerminalSession | null
  getProjectSessions: (projectId: string) => GlobalTerminalSession[]
  getTotalSessionCount: () => number
  getConnectedSessionCount: () => number
  getAllSessions: () => GlobalTerminalSession[]
  getLeftPanelSessions: () => GlobalTerminalSession[]
  getRightPanelSessions: () => GlobalTerminalSession[]
  moveSessionToPanel: (sessionId: string, panel: 'left' | 'right') => void

  // Input/focus refs
  sendCommandToActive: (command: string) => void
  registerSendInput: (sessionId: string, fn: (data: string) => void) => void
  registerFocusTerminal: (sessionId: string, fn: () => void) => void
  focusActiveTerminal: () => void
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  dockHeight: 'prjct-terminal-dock-height',
  dockOpen: 'prjct-terminal-dock-open',
  activeProject: 'prjct-terminal-active-project',
  splitEnabled: 'prjct-terminal-split-enabled',
}

const DEFAULT_DOCK_HEIGHT = 300
const MIN_DOCK_HEIGHT = 150
// Dynamic max height - 90% of viewport
const getMaxDockHeight = () => typeof window !== 'undefined' ? window.innerHeight * 0.9 : 800

// ============================================================================
// Context
// ============================================================================

const GlobalTerminalContext = createContext<GlobalTerminalContextType | null>(null)

let sessionCounter = 0

// ============================================================================
// Provider
// ============================================================================

export function GlobalTerminalProvider({ children }: { children: ReactNode }) {
  // Session state
  const [projectSessions, setProjectSessions] = useState<Map<string, ProjectTerminals>>(new Map())
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Dock UI state
  const [isDockOpen, setIsDockOpen] = useState(false)
  const [dockHeight, setDockHeightState] = useState(DEFAULT_DOCK_HEIGHT)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isSplitEnabled, setIsSplitEnabledState] = useState(false)
  const [secondActiveSessionId, setSecondActiveSessionId] = useState<string | null>(null)

  // Refs for input/focus functions per session
  const sendInputRefs = useRef<Map<string, (data: string) => void>>(new Map())
  const focusTerminalRefs = useRef<Map<string, () => void>>(new Map())

  // -------------------------------------------------------------------------
  // Load persisted state from localStorage
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const savedDockHeight = localStorage.getItem(STORAGE_KEYS.dockHeight)
      if (savedDockHeight) {
        const parsed = parseInt(savedDockHeight, 10)
        if (!isNaN(parsed)) {
          setDockHeightState(Math.max(MIN_DOCK_HEIGHT, Math.min(parsed, getMaxDockHeight())))
        }
      }

      const savedDockOpen = localStorage.getItem(STORAGE_KEYS.dockOpen)
      if (savedDockOpen) {
        setIsDockOpen(JSON.parse(savedDockOpen))
      }

      const savedActiveProject = localStorage.getItem(STORAGE_KEYS.activeProject)
      if (savedActiveProject) {
        setActiveProjectId(savedActiveProject)
      }
    } catch (e) {
      console.warn('Failed to load terminal state from localStorage:', e)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Persist state to localStorage
  // -------------------------------------------------------------------------
  const setDockHeight = useCallback((newHeight: number) => {
    const maxHeight = getMaxDockHeight()
    const clampedHeight = Math.max(MIN_DOCK_HEIGHT, Math.min(newHeight, maxHeight))
    setDockHeightState(clampedHeight)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.dockHeight, String(clampedHeight))
    }
  }, [])

  const setSplitEnabled = useCallback((enabled: boolean) => {
    setIsSplitEnabledState(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.splitEnabled, String(enabled))
    }
    // If disabling split, clear second panel
    if (!enabled) {
      setSecondActiveSessionId(null)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------
  const createSessionForProject = useCallback((projectId: string, projectName: string, projectPath: string, panel: 'left' | 'right' = 'left') => {
    sessionCounter++
    const newSession: GlobalTerminalSession = {
      id: `pty_${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      projectName,
      projectPath,
      createdAt: new Date(),
      isConnected: false,
      isLoading: true,
      label: `Terminal ${sessionCounter}`,
      panel,
    }

    setProjectSessions(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(projectId)

      if (existing) {
        newMap.set(projectId, {
          ...existing,
          sessions: [...existing.sessions, newSession],
        })
      } else {
        newMap.set(projectId, {
          projectId,
          projectName,
          projectPath,
          sessions: [newSession],
        })
      }

      return newMap
    })

    // Set as active based on panel
    setActiveProjectId(projectId)
    if (panel === 'right') {
      setSecondActiveSessionId(newSession.id)
    } else {
      setActiveSessionId(newSession.id)
    }
    localStorage.setItem(STORAGE_KEYS.activeProject, projectId)

    // Open dock if not open
    setIsDockOpen(true)
    localStorage.setItem(STORAGE_KEYS.dockOpen, 'true')

    return newSession.id
  }, [])

  const closeSession = useCallback((sessionId: string) => {
    setProjectSessions(prev => {
      const newMap = new Map(prev)

      // Find which project this session belongs to
      for (const [projectId, project] of newMap) {
        const sessionIndex = project.sessions.findIndex(s => s.id === sessionId)
        if (sessionIndex !== -1) {
          const newSessions = project.sessions.filter(s => s.id !== sessionId)

          if (newSessions.length === 0) {
            // Remove project entirely if no sessions left
            newMap.delete(projectId)
          } else {
            newMap.set(projectId, { ...project, sessions: newSessions })
          }

          // Update active session if needed
          if (sessionId === activeSessionId) {
            if (newSessions.length > 0) {
              setActiveSessionId(newSessions[newSessions.length - 1].id)
            } else {
              // Switch to another project's session or null
              const remainingProjects = Array.from(newMap.values())
              if (remainingProjects.length > 0) {
                const nextProject = remainingProjects[0]
                setActiveProjectId(nextProject.projectId)
                setActiveSessionId(nextProject.sessions[nextProject.sessions.length - 1]?.id || null)
              } else {
                setActiveProjectId(null)
                setActiveSessionId(null)
              }
            }
          }

          break
        }
      }

      return newMap
    })

    // Cleanup refs
    sendInputRefs.current.delete(sessionId)
    focusTerminalRefs.current.delete(sessionId)
  }, [activeSessionId])

  const switchProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId)
    localStorage.setItem(STORAGE_KEYS.activeProject, projectId)

    // Switch to first session of this project
    const project = projectSessions.get(projectId)
    if (project && project.sessions.length > 0) {
      setActiveSessionId(project.sessions[0].id)
    }
  }, [projectSessions])

  const switchSession = useCallback((sessionId: string, panel: 'left' | 'right' = 'left') => {
    if (panel === 'right' && isSplitEnabled) {
      setSecondActiveSessionId(sessionId)
    } else {
      setActiveSessionId(sessionId)

      // Also update active project if session is from different project
      for (const [projectId, project] of projectSessions) {
        if (project.sessions.some(s => s.id === sessionId)) {
          if (projectId !== activeProjectId) {
            setActiveProjectId(projectId)
            localStorage.setItem(STORAGE_KEYS.activeProject, projectId)
          }
          break
        }
      }
    }
  }, [projectSessions, activeProjectId, isSplitEnabled])

  const updateSession = useCallback((sessionId: string, updates: Partial<GlobalTerminalSession>) => {
    setProjectSessions(prev => {
      const newMap = new Map(prev)

      for (const [projectId, project] of newMap) {
        const sessionIndex = project.sessions.findIndex(s => s.id === sessionId)
        if (sessionIndex !== -1) {
          const newSessions = [...project.sessions]
          newSessions[sessionIndex] = { ...newSessions[sessionIndex], ...updates }
          newMap.set(projectId, { ...project, sessions: newSessions })
          break
        }
      }

      return newMap
    })
  }, [])

  // -------------------------------------------------------------------------
  // Dock UI actions
  // -------------------------------------------------------------------------
  const openDock = useCallback(() => {
    setIsDockOpen(true)
    localStorage.setItem(STORAGE_KEYS.dockOpen, 'true')
  }, [])

  const closeDock = useCallback(() => {
    setIsDockOpen(false)
    localStorage.setItem(STORAGE_KEYS.dockOpen, 'false')
  }, [])

  const toggleDock = useCallback(() => {
    const newValue = !isDockOpen
    setIsDockOpen(newValue)
    localStorage.setItem(STORAGE_KEYS.dockOpen, String(newValue))
  }, [isDockOpen])

  const setFullScreen = useCallback((value: boolean) => {
    setIsFullScreen(value)
  }, [])

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const getActiveSession = useCallback((): GlobalTerminalSession | null => {
    if (!activeSessionId) return null
    for (const project of projectSessions.values()) {
      const session = project.sessions.find(s => s.id === activeSessionId)
      if (session) return session
    }
    return null
  }, [projectSessions, activeSessionId])

  const getSecondActiveSession = useCallback((): GlobalTerminalSession | null => {
    if (!secondActiveSessionId) return null
    for (const project of projectSessions.values()) {
      const session = project.sessions.find(s => s.id === secondActiveSessionId)
      if (session) return session
    }
    return null
  }, [projectSessions, secondActiveSessionId])

  const getProjectSessions = useCallback((projectId: string): GlobalTerminalSession[] => {
    return projectSessions.get(projectId)?.sessions || []
  }, [projectSessions])

  const getAllSessions = useCallback((): GlobalTerminalSession[] => {
    const allSessions: GlobalTerminalSession[] = []
    for (const project of projectSessions.values()) {
      allSessions.push(...project.sessions)
    }
    return allSessions
  }, [projectSessions])

  const getTotalSessionCount = useCallback((): number => {
    let count = 0
    for (const project of projectSessions.values()) {
      count += project.sessions.length
    }
    return count
  }, [projectSessions])

  const getConnectedSessionCount = useCallback((): number => {
    let count = 0
    for (const project of projectSessions.values()) {
      count += project.sessions.filter(s => s.isConnected).length
    }
    return count
  }, [projectSessions])

  const getLeftPanelSessions = useCallback((): GlobalTerminalSession[] => {
    return getAllSessions().filter(s => s.panel === 'left')
  }, [getAllSessions])

  const getRightPanelSessions = useCallback((): GlobalTerminalSession[] => {
    return getAllSessions().filter(s => s.panel === 'right')
  }, [getAllSessions])

  const moveSessionToPanel = useCallback((sessionId: string, panel: 'left' | 'right') => {
    setProjectSessions(prev => {
      const newMap = new Map(prev)
      for (const [projectId, project] of newMap) {
        const sessionIndex = project.sessions.findIndex(s => s.id === sessionId)
        if (sessionIndex !== -1) {
          const newSessions = [...project.sessions]
          newSessions[sessionIndex] = { ...newSessions[sessionIndex], panel }
          newMap.set(projectId, { ...project, sessions: newSessions })
          break
        }
      }
      return newMap
    })
  }, [])

  // -------------------------------------------------------------------------
  // Input/Focus management
  // -------------------------------------------------------------------------
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
    const session = getActiveSession()
    if (sendFn && session?.isConnected) {
      sendFn(command + '\n')
      // Auto-focus terminal after sending command
      const focusFn = focusTerminalRefs.current.get(activeSessionId)
      if (focusFn) focusFn()
    }
  }, [activeSessionId, getActiveSession])

  // -------------------------------------------------------------------------
  // Page unload protection
  // -------------------------------------------------------------------------
  const hasConnectedSessions = getConnectedSessionCount() > 0

  useEffect(() => {
    if (!hasConnectedSessions) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have active terminal sessions. Are you sure you want to leave?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasConnectedSessions])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <GlobalTerminalContext.Provider value={{
      // Session state
      projectSessions,
      activeProjectId,
      activeSessionId,

      // Dock UI state
      isDockOpen,
      dockHeight,
      isFullScreen,
      isSplitEnabled,
      secondActiveSessionId,

      // Session actions
      createSessionForProject,
      closeSession,
      switchProject,
      switchSession,
      updateSession,

      // Dock UI actions
      openDock,
      closeDock,
      toggleDock,
      setDockHeight,
      setFullScreen,
      setSplitEnabled,

      // Helpers
      getActiveSession,
      getSecondActiveSession,
      getProjectSessions,
      getTotalSessionCount,
      getConnectedSessionCount,
      getAllSessions,
      getLeftPanelSessions,
      getRightPanelSessions,
      moveSessionToPanel,

      // Input/focus
      sendCommandToActive,
      registerSendInput,
      registerFocusTerminal,
      focusActiveTerminal,
    }}>
      {children}
    </GlobalTerminalContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useGlobalTerminal() {
  const context = useContext(GlobalTerminalContext)
  if (!context) {
    throw new Error('useGlobalTerminal must be used within GlobalTerminalProvider')
  }
  return context
}
