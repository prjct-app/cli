import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useClaudeTerminal } from '@/hooks/useClaudeTerminal'
import {
  Loader2,
  AlertCircle,
  Play,
  Square,
  Maximize2,
  Target
} from 'lucide-react'

export function Terminal() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Get project info
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await fetch(`/api/projects/${projectId}`)
      const json = await res.json()
      return json.data
    },
    enabled: !!projectId
  })

  // Get current session
  const { data: session } = useQuery({
    queryKey: ['session', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await fetch(`/api/sessions/current?projectId=${projectId}`)
      const json = await res.json()
      return json.data
    },
    enabled: !!projectId,
    refetchInterval: 5000
  })

  const sessionId = `term_${projectId}_${Date.now()}`
  const projectDir = project?.path || '/tmp'

  const {
    initTerminal,
    connect,
    disconnect,
    isConnected,
    isLoading
  } = useClaudeTerminal({
    sessionId,
    projectDir,
    onConnect: () => setError(null),
    onDisconnect: () => console.log('Disconnected'),
    onError: (err) => setError(err)
  })

  // Initialize terminal when container is ready
  useEffect(() => {
    if (containerRef.current && project) {
      initTerminal(containerRef.current)
    }
  }, [initTerminal, project])

  // Handle connect button
  const handleConnect = useCallback(() => {
    connect()
  }, [connect])

  // No project selected
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Target className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select a Project</h2>
        <p className="text-muted-foreground mb-4">
          Choose a project from the dashboard to start a terminal session.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // Loading project
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-medium">{project?.id || 'Terminal'}</h1>
            <p className="text-xs text-muted-foreground">Claude Code CLI</p>
          </div>

          {/* Session info */}
          {session && (
            <div className="flex items-center gap-2 text-sm bg-accent px-3 py-1 rounded-md">
              <div className={`w-2 h-2 rounded-full ${
                session.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="truncate max-w-[200px]">{session.task}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
            >
              <Square className="w-4 h-4" />
              Disconnect
            </button>
          )}

          <button
            className="p-1.5 rounded-md hover:bg-accent"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 bg-[#0a0a0f] overflow-hidden"
        style={{ minHeight: 0 }}
      />

      {/* Not connected overlay */}
      {!isConnected && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium mb-2">Ready to Connect</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Click Connect to start Claude Code CLI
            </p>
            <p className="text-xs text-muted-foreground">
              Using your Claude subscription - no API costs
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
