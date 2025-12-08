'use client'

import { useEffect, useRef, useState, use, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useClaudeTerminal } from '@/hooks/useClaudeTerminal'
import { useTerminalContext } from '@/context/TerminalContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import {
  Loader2,
  Play,
  Square,
  Target,
  Lightbulb,
  ChevronRight,
  Send,
  RefreshCw,
  ListTodo,
  Rocket,
  Sparkles,
  CheckCircle2,
  Terminal as TerminalIcon,
  AlertTriangle
} from 'lucide-react'

// Quick action shortcuts - use "p. X" format, execute directly when no params needed
const QUICK_ACTIONS = [
  { label: 'Sync', command: 'p. sync', icon: RefreshCw, description: 'Analyze & sync project', autoExec: true },
  { label: 'Next', command: 'p. next', icon: ListTodo, description: 'Show priority queue', autoExec: true },
  { label: 'Ship', command: 'p. ship', icon: Rocket, description: 'Ship current work', autoExec: true },
  { label: 'Done', command: 'p. done', icon: CheckCircle2, description: 'Complete task', autoExec: true },
]

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [reconnectInfo, setReconnectInfo] = useState<{ attempt: number; max: number } | null>(null)
  const { sendCommand, setIsConnected, registerSendInput } = useTerminalContext()

  // Get project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      const json = await res.json()
      return json.data
    },
    enabled: !!projectId,
    refetchInterval: 10000
  })

  // Get project status
  const { data: status } = useQuery({
    queryKey: ['project-status', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/status`)
      const json = await res.json()
      return json.data
    },
    enabled: !!projectId,
    refetchInterval: 5000
  })

  // Use stable sessionId based on projectId only - each project has ONE session
  // This allows multiple tabs to share the same session for a project
  // and enables reconnection after server restarts
  const sessionId = `pty_${projectId}`

  const handleReconnecting = useCallback((attempt: number, max: number) => {
    setReconnectInfo({ attempt, max })
  }, [])

  const {
    initTerminal,
    connect,
    disconnect,
    sendInput,
    isConnected,
    isLoading: terminalLoading,
    isReconnecting
  } = useClaudeTerminal({
    sessionId,
    projectDir: project?.repoPath || project?.path || '/tmp',
    onConnect: () => {
      setError(null)
      setReconnectInfo(null)
      setIsConnected(true)
    },
    onDisconnect: () => {
      setIsConnected(false)
      setReconnectInfo(null)
    },
    onError: (err) => setError(err),
    onReconnecting: handleReconnecting
  })

  // Handle Stop button click - show confirmation
  const handleStopClick = useCallback(() => {
    setShowStopConfirm(true)
  }, [])

  // Confirm stop - actually disconnect
  const handleConfirmStop = useCallback(() => {
    disconnect()
    setShowStopConfirm(false)
  }, [disconnect])

  // Prevent accidental page close when connected
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isConnected) {
        e.preventDefault()
        e.returnValue = 'You have an active Claude session. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isConnected])

  // Register sendInput with context
  useEffect(() => {
    registerSendInput(sendInput)
  }, [sendInput, registerSendInput])

  // Sync connection state
  useEffect(() => {
    setIsConnected(isConnected)
  }, [isConnected, setIsConnected])

  // Initialize terminal when container is ready
  useEffect(() => {
    if (containerRef.current && project) {
      initTerminal(containerRef.current)
    }
  }, [initTerminal, project])

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-full">
        {/* Sidebar - Project Tools */}
        <aside className="w-72 border-r border-border flex flex-col bg-card/50">
          {/* Project Header */}
          <div className="p-4 border-b border-border">
            <h1 className="font-bold text-lg truncate">{project.name || projectId}</h1>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {project.path}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-b border-border">
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Tooltip key={action.command}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendCommand(action.command)}
                      disabled={!isConnected}
                      className="flex flex-col items-center gap-1 h-auto py-2"
                    >
                      <action.icon className="w-4 h-4" />
                      <span className="text-[10px]">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{action.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Current Task */}
              {status?.session && (
                <div>
                  <h2 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Target className="w-3 h-3" />
                    CURRENT
                  </h2>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{status.session.task}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={status.session.status === 'active' ? 'default' : 'secondary'}>
                          {status.session.status === 'active' ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Up Next */}
              {status?.nextTasks && status.nextTasks.length > 0 && (
                <div>
                  <h2 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3" />
                    UP NEXT
                  </h2>
                  <div className="space-y-1">
                    {status.nextTasks.slice(0, 5).map((task: string, i: number) => {
                      const cleanTask = task.replace(/^-\s*\[.\]\s*/, '').replace(/^-\s*/, '').trim()
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendCommand(`p. now ${cleanTask}`)}
                              disabled={!isConnected}
                              className="w-full justify-start text-left h-auto py-2 px-2 group"
                            >
                              <Badge variant="outline" className="mr-2 font-mono text-[10px]">
                                {i + 1}
                              </Badge>
                              <span className="flex-1 truncate text-muted-foreground group-hover:text-foreground">
                                {cleanTask}
                              </span>
                              <Send className="w-3 h-3 opacity-0 group-hover:opacity-50 ml-2" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Start: {cleanTask}</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Ideas */}
              {status?.ideas && status.ideas.length > 0 && (
                <div>
                  <h2 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="w-3 h-3" />
                    IDEAS
                  </h2>
                  <div className="space-y-1">
                    {status.ideas.slice(0, 5).map((idea: string, i: number) => {
                      const cleanIdea = idea.replace(/^-\s*/, '').trim()
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendCommand(cleanIdea)}
                              disabled={!isConnected}
                              className="w-full justify-start text-left h-auto py-2 px-2 group"
                            >
                              <Sparkles className="w-3 h-3 text-yellow-500 mr-2 shrink-0" />
                              <span className="flex-1 truncate text-muted-foreground group-hover:text-foreground">
                                {cleanIdea}
                              </span>
                              <Send className="w-3 h-3 opacity-0 group-hover:opacity-50 ml-2" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Send to Claude</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quick Commands */}
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-2">
                  COMMANDS
                </h2>
                <div className="space-y-0.5">
                  {[
                    { cmd: 'p. recap', label: 'Project overview' },
                    { cmd: 'p. progress', label: 'Show metrics' },
                    { cmd: 'p. idea', label: 'Capture idea' },
                    { cmd: 'p. bug', label: 'Report bug' },
                    { cmd: 'p. help', label: 'Get help' },
                  ].map(({ cmd, label }) => (
                    <Tooltip key={cmd}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendCommand(cmd)}
                          disabled={!isConnected}
                          className="w-full justify-start text-left h-8 px-2"
                        >
                          <code className="text-xs text-primary font-mono">{cmd}</code>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{label}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main - Terminal */}
        <main className="flex-1 flex flex-col">
          {/* Terminal Header */}
          <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <TerminalIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Claude Code</span>
              {isConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500/50">
                  Connected
                </Badge>
              )}
              {isReconnecting && reconnectInfo && (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 animate-pulse">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Reconnecting ({reconnectInfo.attempt}/{reconnectInfo.max})
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isConnected && !isReconnecting ? (
                <Button onClick={connect} disabled={terminalLoading} size="sm">
                  {terminalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {terminalLoading ? 'Connecting...' : 'Start'}
                </Button>
              ) : (
                <Button onClick={handleStopClick} variant="destructive" size="sm">
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              )}
            </div>
          </header>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Terminal */}
          <div className="flex-1 relative">
            <div
              ref={containerRef}
              className="absolute inset-0 bg-[#0a0a0f]"
            />

            {/* Not connected overlay */}
            {!isConnected && !terminalLoading && !isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <TerminalIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-medium mb-2">Claude Code CLI</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Click &quot;Start&quot; to begin
                  </p>
                </div>
              </div>
            )}

            {/* Reconnecting overlay */}
            {isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 text-yellow-500 animate-spin mx-auto mb-4" />
                  <h2 className="text-lg font-medium mb-2">Reconnecting...</h2>
                  {reconnectInfo && (
                    <p className="text-muted-foreground text-sm">
                      Attempt {reconnectInfo.attempt} of {reconnectInfo.max}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Stop Confirmation Dialog */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Stop Claude Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate the current Claude Code session. Any unsaved work in the terminal will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
