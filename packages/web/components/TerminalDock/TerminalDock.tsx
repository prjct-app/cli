'use client'

/**
 * TerminalDock v3.1
 * - Drawer with native overlay when >50% (respects sidebar)
 * - Commands on left side inside drawer
 * - Chrome-style tabs
 * - Rename tabs via double-click
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useParams } from 'next/navigation'
import { useGlobalTerminal } from '@/context/GlobalTerminalContext'
import { TerminalDockTab } from './TerminalDockTab'
import { TerminalTabBar } from './TerminalTabBar'
import { DockToggleTab } from './DockToggleTab'
import { ProjectSelectorModal } from '@/components/ProjectSelectorModal'
import { CommandBar } from '@/components/CommandBar'
import { cn } from '@/lib/utils'
import { Minus, SplitSquareHorizontal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'

// Threshold for showing drawer with overlay (50% of viewport)
const DRAWER_THRESHOLD = 0.5

export function TerminalDock() {
  const pathname = usePathname()
  const params = useParams()
  const {
    isDockOpen,
    dockHeight,
    isFullScreen,
    isSplitEnabled,
    setDockHeight,
    openDock,
    closeDock,
    setSplitEnabled,
    projectSessions,
    activeSessionId,
    secondActiveSessionId,
    switchSession,
    closeSession,
    createSessionForProject,
    sendCommandToActive,
    getActiveSession,
    getAllSessions,
    getLeftPanelSessions,
    getRightPanelSessions,
    getTotalSessionCount,
    getConnectedSessionCount,
    updateSession,
  } = useGlobalTerminal()

  const dockRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [projectSelectorPanel, setProjectSelectorPanel] = useState<'left' | 'right'>('left')
  const [viewportHeight, setViewportHeight] = useState(800)


  // Update viewport height on mount and resize
  useEffect(() => {
    const updateViewport = () => setViewportHeight(window.innerHeight)
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Get all sessions
  const allSessions = getAllSessions()
  const activeSession = getActiveSession()
  const isConnected = activeSession?.isConnected ?? false
  const totalSessions = getTotalSessionCount()
  const connectedSessions = getConnectedSessionCount()

  // Always use drawer mode
  const useDrawerMode = true

  // Hide dock on code page (full-screen terminal)
  const isCodePage = pathname?.includes('/code')

  // Get current project context from URL
  const currentProjectId = params?.id as string | undefined

  // Resize handlers (only for non-drawer mode)
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY
      setDockHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setDockHeight])

  // Handle new terminal - creates session directly in the specified panel
  const handleNewTerminal = useCallback((panel: 'left' | 'right' = 'left') => {
    if (currentProjectId) {
      const project = projectSessions.get(currentProjectId)
      if (project) {
        createSessionForProject(project.projectId, project.projectName, project.projectPath, panel)
        return
      }
    }
    setProjectSelectorPanel(panel)
    setShowProjectSelector(true)
  }, [currentProjectId, projectSessions, createSessionForProject])

  // Handle project selection from modal
  const handleSelectProject = useCallback((projectId: string, projectName: string, projectPath: string) => {
    createSessionForProject(projectId, projectName, projectPath, projectSelectorPanel)
    setShowProjectSelector(false)
  }, [createSessionForProject, projectSelectorPanel])

  // Handle command click
  const handleCommand = useCallback((cmd: string) => {
    sendCommandToActive(cmd)
  }, [sendCommandToActive])

  // Handle close session
  const handleCloseSession = useCallback((sessionId: string) => {
    const disconnectKey = `terminal_disconnect_${sessionId}`
    const disconnectFn = (window as unknown as Record<string, () => void>)[disconnectKey]
    if (disconnectFn) {
      disconnectFn()
    }
    closeSession(sessionId)
  }, [closeSession])

  // Handle rename session
  const handleRenameSession = useCallback((sessionId: string, newLabel: string) => {
    updateSession(sessionId, { label: newLabel })
  }, [updateSession])

  // Don't render if on code page (full-screen mode)
  if (isCodePage || isFullScreen) {
    return null
  }

  // Show toggle tab when dock is closed
  if (!isDockOpen) {
    return (
      <DockToggleTab
        sessionCount={totalSessions}
        connectedCount={connectedSessions}
        onClick={openDock}
      />
    )
  }


  // Terminal content (sessions)
  const TerminalContent = (
    <div className="flex-1 relative overflow-hidden">
      {allSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
          <span>No terminal sessions</span>
          <button
            onClick={() => handleNewTerminal('left')}
            className="text-muted-foreground hover:text-foreground underline"
          >
            Open a terminal
          </button>
        </div>
      ) : isSplitEnabled ? (
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="border-b border-border bg-muted/30">
                <TerminalTabBar
                  sessions={getLeftPanelSessions()}
                  activeSessionId={activeSessionId}
                  onSwitchSession={(id) => switchSession(id, 'left')}
                  onCloseSession={handleCloseSession}
                  onNewTerminal={() => handleNewTerminal('left')}
                  onRenameSession={handleRenameSession}
                />
              </div>
              <div className="flex-1 relative">
                {getLeftPanelSessions().length > 0 ? (
                  getLeftPanelSessions().map((session) => (
                    <TerminalDockTab
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                    />
                  ))
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/95 text-muted-foreground text-sm">
                    <button
                      onClick={() => handleNewTerminal('left')}
                      className="text-muted-foreground hover:text-foreground underline"
                    >
                      Open terminal in left panel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-muted transition-colors" />

          <Panel defaultSize={50} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="border-b border-border bg-muted/30">
                <TerminalTabBar
                  sessions={getRightPanelSessions()}
                  activeSessionId={secondActiveSessionId}
                  onSwitchSession={(id) => switchSession(id, 'right')}
                  onCloseSession={handleCloseSession}
                  onNewTerminal={() => handleNewTerminal('right')}
                  onRenameSession={handleRenameSession}
                />
              </div>
              <div className="flex-1 relative">
                {getRightPanelSessions().length > 0 ? (
                  getRightPanelSessions().map((session) => (
                    <TerminalDockTab
                      key={`right-${session.id}`}
                      session={session}
                      isActive={session.id === secondActiveSessionId}
                    />
                  ))
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/95 text-muted-foreground text-sm">
                    <button
                      onClick={() => handleNewTerminal('right')}
                      className="text-muted-foreground hover:text-foreground underline"
                    >
                      Open terminal in right panel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        <div className="h-full flex flex-col">
          <div className="border-b border-border bg-muted/30">
            <TerminalTabBar
              sessions={allSessions}
              activeSessionId={activeSessionId}
              onSwitchSession={(id) => switchSession(id)}
              onCloseSession={handleCloseSession}
              onNewTerminal={() => handleNewTerminal('left')}
              onRenameSession={handleRenameSession}
            />
          </div>
          <div className="flex-1 relative">
            {allSessions.map((session) => (
              <TerminalDockTab
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Header with split/minimize (right side)
  const HeaderActions = (
    <div className="flex items-center gap-1 px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setSplitEnabled(!isSplitEnabled)}
            className={cn(
              'p-1.5 rounded transition-colors',
              isSplitEnabled
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <SplitSquareHorizontal className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{isSplitEnabled ? 'Single view' : 'Split view'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={closeDock}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Minimize</TooltipContent>
      </Tooltip>
    </div>
  )

  return (
    <TooltipProvider>
      {useDrawerMode ? (
        // Simple drawer
        <Drawer open={isDockOpen} onOpenChange={(open) => !open && closeDock()}>
          <DrawerContent className="h-[60vh] flex flex-col">
            <VisuallyHidden>
              <DrawerTitle>Terminal</DrawerTitle>
            </VisuallyHidden>

            {/* Header: commands left, actions right */}
            <div className="flex items-center justify-between border-b border-border bg-card/95 shrink-0">
              <CommandBar isConnected={isConnected} onCommand={handleCommand} />
              {HeaderActions}
            </div>

            {TerminalContent}
          </DrawerContent>
        </Drawer>
      ) : (
        // Regular dock when <=50%
        <div
          ref={dockRef}
          className={cn(
            'relative flex flex-col shrink-0',
            'bg-card border-t border-border',
            isResizing && 'select-none'
          )}
          style={{ height: dockHeight }}
        >
          {/* Resize Handle */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10',
              'hover:bg-muted transition-colors',
              'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border',
              isResizing && 'bg-muted'
            )}
            onMouseDown={startResize}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header: commands left, actions right */}
          <div className="flex items-center justify-between border-b border-border bg-card/95 shrink-0 mt-2">
            <CommandBar isConnected={isConnected} onCommand={handleCommand} />
            {HeaderActions}
          </div>

          {TerminalContent}
        </div>
      )}

      <ProjectSelectorModal
        isOpen={showProjectSelector}
        onClose={() => setShowProjectSelector(false)}
        onSelectProject={handleSelectProject}
      />
    </TooltipProvider>
  )
}
