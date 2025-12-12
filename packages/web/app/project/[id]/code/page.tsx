'use client'

import { useState, use, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProject, useDeleteProject } from '@/hooks/useProjects'
import { useGlobalTerminal } from '@/context/GlobalTerminalContext'
import { TerminalDockTab } from '@/components/TerminalDock/TerminalDockTab'
import { TerminalTabBar } from '@/components/TerminalDock/TerminalTabBar'
import { CommandBar } from '@/components/CommandBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
import { ProjectAvatar } from '@/components/ProjectAvatar'
import { TechStackBadges } from '@/components/TechStackBadges'
import { MomentumWidget } from '@/components/MomentumWidget'
import { formatPath } from '@/lib/format'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import {
  Loader2,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  FolderGit2,
  Plus,
  Terminal,
  SplitSquareHorizontal,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Inner component that uses the terminal context
function ProjectPageContent({ projectId, project }: { projectId: string; project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const commandExecutedRef = useRef(false)

  // Global terminal context
  const {
    activeSessionId,
    secondActiveSessionId,
    isSplitEnabled,
    setSplitEnabled,
    createSessionForProject,
    getProjectSessions,
    switchSession,
    closeSession,
    sendCommandToActive,
    getActiveSession,
    setFullScreen,
    getAllSessions,
    getLeftPanelSessions,
    getRightPanelSessions,
    updateSession,
  } = useGlobalTerminal()

  const sessions = getProjectSessions(projectId)
  const allSessions = getAllSessions()
  const activeSession = getActiveSession()
  const hasActiveSessions = sessions.length > 0
  const isActiveConnected = activeSession?.isConnected ?? false

  const projectPath = project.repoPath || project.path || '/tmp'
  const projectName = project.name || projectId

  // Set full-screen mode when entering code page
  useEffect(() => {
    setFullScreen(true)
    return () => setFullScreen(false)
  }, [setFullScreen])

  // Handle new terminal - creates session directly in the specified panel
  const handleNewTerminal = useCallback((panel: 'left' | 'right' = 'left') => {
    createSessionForProject(projectId, projectName, projectPath, panel)
  }, [projectId, projectName, projectPath, createSessionForProject])

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

  // Auto-execute command from URL param (e.g., ?cmd=p.%20done)
  useEffect(() => {
    const cmd = searchParams.get('cmd')
    if (cmd && isActiveConnected && !commandExecutedRef.current) {
      commandExecutedRef.current = true
      const decoded = decodeURIComponent(cmd)
      setTimeout(() => {
        sendCommandToActive(decoded)
        router.replace(`/project/${projectId}/code`)
      }, 500)
    }
  }, [searchParams, isActiveConnected, sendCommandToActive, router, projectId])

  // Terminal content with split support
  const TerminalContent = (
    <div className="flex-1 relative overflow-hidden">
      {allSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
          <Terminal className="w-12 h-12 opacity-50" />
          <div className="text-center">
            <p className="text-lg font-medium">No terminal sessions</p>
            <p className="text-sm">Open a terminal to get started</p>
          </div>
          <button
            onClick={() => handleNewTerminal('left')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Open Terminal
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
                      className="text-orange-500 hover:text-orange-400 underline"
                    >
                      Open terminal in left panel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-orange-500/50 transition-colors" />

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
                      className="text-orange-500 hover:text-orange-400 underline"
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

  return (
    <div className="h-full">
      <TooltipProvider>
        <div className="flex flex-col h-full">
          {/* Header - Responsive */}
          <header className="h-auto md:h-14 flex flex-col md:flex-row md:items-center justify-between px-3 md:px-4 py-2 md:py-0 border-b border-border bg-card gap-2">
            {/* Left: Project info */}
            <div className="flex items-center gap-3">
              <ProjectAvatar
                projectId={projectId}
                name={project.name || projectId}
                iconPath={project.iconPath}
                size="sm"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold leading-tight truncate">{project.name || projectId}</span>
                  {project.version && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                      v{project.version}
                    </Badge>
                  )}
                </div>
                {project.repoPath && (
                  <span className="text-xs text-muted-foreground leading-tight flex items-center gap-1 truncate">
                    <FolderGit2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formatPath(project.repoPath)}</span>
                  </span>
                )}
              </div>
              {hasActiveSessions && (
                <Badge variant="outline" className="text-green-500 border-green-500/50 shrink-0">
                  {sessions.filter(s => s.isConnected).length} active
                </Badge>
              )}
            </div>

            {/* Center: Momentum widget - desktop only */}
            <div className="hidden md:flex items-center justify-center flex-1">
              <MomentumWidget projectId={projectId} />
            </div>

            {/* Right: metadata and tech stack - desktop only */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {project.filesCount && (
                  <span><span className="font-medium text-foreground">{project.filesCount}</span> files</span>
                )}
                {project.commitsCount && (
                  <span><span className="font-medium text-foreground">{project.commitsCount}</span> commits</span>
                )}
              </div>
              <TechStackBadges techStack={project.techStack || []} />
            </div>
          </header>

          {/* Command bar + actions - SAME AS DOCK */}
          <div className="flex items-center justify-between border-b border-border bg-card/95 shrink-0">
            <CommandBar isConnected={isActiveConnected} onCommand={sendCommandToActive} />

            {/* Header actions: split toggle, back button */}
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
                    onClick={() => router.push(`/project/${projectId}`)}
                    className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Back to project</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Terminal content area */}
          {TerminalContent}
        </div>
      </TooltipProvider>
    </div>
  )
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const deleteMutation = useDeleteProject()

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-medium">Project not found</h2>
            <p className="text-sm text-muted-foreground mt-1 break-all">ID: {projectId}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete from Storage
            </Button>
          </div>

          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Delete Project Data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will move the project storage to trash.
                  <br />
                  <span className="text-muted-foreground text-sm break-all">ID: {projectId}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel disabled={deleteMutation.isPending} className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(projectId, { onSuccess: () => router.push('/') })}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    )
  }

  return <ProjectPageContent projectId={projectId} project={project} />
}
