import { useQuery } from '@tanstack/react-query'
import { formatDuration, getRelativeTime } from '@prjct/shared'
import { Clock, Target, CheckCircle, PauseCircle, GitCommit, FileCode } from 'lucide-react'

export function Sessions() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      const json = await res.json()
      return json.data || []
    }
  })

  // Get sessions from first project (for demo)
  const projectId = projects?.[0]?.id

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await fetch(`/api/sessions?projectId=${projectId}`)
      const json = await res.json()
      return json.data || []
    },
    enabled: !!projectId
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Sessions
        </h1>
        <p className="text-muted-foreground mt-1">
          Your work session history
        </p>
      </header>

      {!sessions?.length ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No sessions yet. Start one with <code className="bg-muted px-2 py-1 rounded">/p:now</code>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session: any) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SessionCardProps {
  session: {
    id: string
    task: string
    status: 'active' | 'paused' | 'completed'
    startedAt: string
    completedAt?: string
    duration: number
    metrics: {
      filesChanged: number
      linesAdded: number
      linesRemoved: number
      commits: number
    }
  }
}

function SessionCard({ session }: SessionCardProps) {
  const statusConfig = {
    active: {
      icon: Target,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      label: 'Active'
    },
    paused: {
      icon: PauseCircle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      label: 'Paused'
    },
    completed: {
      icon: CheckCircle,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      label: 'Completed'
    }
  }

  const status = statusConfig[session.status]
  const StatusIcon = status.icon

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium mb-1">{session.task}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{getRelativeTime(session.startedAt)}</span>
            <span>•</span>
            <span>{formatDuration(session.duration)}</span>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.color}`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileCode className="w-3.5 h-3.5" />
          {session.metrics.filesChanged} files
        </span>
        <span className="flex items-center gap-1 text-green-500">
          +{session.metrics.linesAdded}
        </span>
        <span className="flex items-center gap-1 text-red-500">
          -{session.metrics.linesRemoved}
        </span>
        <span className="flex items-center gap-1">
          <GitCommit className="w-3.5 h-3.5" />
          {session.metrics.commits} commits
        </span>
      </div>
    </div>
  )
}
