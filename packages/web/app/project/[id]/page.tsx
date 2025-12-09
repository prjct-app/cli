'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useDeleteProject } from '@/hooks/useProjects'
import { TerminalTabsProvider, useTerminalTabs } from '@/context/TerminalTabsContext'
import { TerminalTabs } from '@/components/TerminalTabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
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
import { CommandButton } from '@/components/CommandButton'
import { formatPath } from '@/lib/format'
import {
  Loader2,
  Play,
  Target,
  Lightbulb,
  ListTodo,
  Rocket,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  FolderGit2,
  Pause,
  BarChart3,
  TrendingUp,
  Activity,
  History,
  Undo2,
  Redo2
} from 'lucide-react'

// Commands ordered by real developer workflow
const WORKFLOW_COMMANDS = [
  { cmd: 'p. now', icon: Target, tip: 'Set task', group: 'work' },
  { cmd: 'p. done', icon: CheckCircle2, tip: 'Complete', group: 'work' },
  { cmd: 'p. pause', icon: Pause, tip: 'Pause', group: 'session' },
  { cmd: 'p. resume', icon: Play, tip: 'Resume', group: 'session' },
  { cmd: 'p. feature', icon: Sparkles, tip: 'Feature', group: 'plan' },
  { cmd: 'p. idea', icon: Lightbulb, tip: 'Idea', group: 'plan' },
  { cmd: 'p. next', icon: ListTodo, tip: 'Queue', group: 'plan' },
  { cmd: 'p. ship', icon: Rocket, tip: 'Ship', group: 'ship' },
  { cmd: 'p. recap', icon: BarChart3, tip: 'Recap', group: 'status' },
  { cmd: 'p. progress', icon: TrendingUp, tip: 'Progress', group: 'status' },
  { cmd: 'p. status', icon: Activity, tip: 'Status', group: 'status' },
  { cmd: 'p. history', icon: History, tip: 'History', group: 'status' },
  { cmd: 'p. undo', icon: Undo2, tip: 'Undo', group: 'recovery' },
  { cmd: 'p. redo', icon: Redo2, tip: 'Redo', group: 'recovery' },
] as const

const COMMAND_GROUPS = ['work', 'session', 'plan', 'ship', 'status', 'recovery'] as const

// Inner component that uses the terminal context
function ProjectPageContent({ projectId, project }: { projectId: string; project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteMutation = useDeleteProject()

  const {
    sessions,
    sendCommandToActive,
    getActiveSession
  } = useTerminalTabs()

  const activeSession = getActiveSession()
  const hasActiveSessions = sessions.length > 0
  const isActiveConnected = activeSession?.isConnected ?? false

  return (
    <div className="h-full">
      <TooltipProvider>
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className="w-14 border-r border-border flex flex-col bg-card/50 items-center">
            <div className="h-14 flex items-center justify-center border-b border-border w-full">
              <ProjectAvatar
                projectId={projectId}
                name={project.name || projectId}
                iconPath={project.iconPath}
              />
            </div>

            <div className="flex-1 flex flex-col gap-1 overflow-auto py-3">
              {/* Stats button - navigates to stats page */}
              <CommandButton
                cmd="Project stats"
                icon={BarChart3}
                tip="Stats"
                disabled={false}
                onClick={() => router.push(`/project/${projectId}/stats`)}
              />
              <div className="border-b border-border w-8 my-2 mx-auto" />

              {COMMAND_GROUPS.map((group, groupIndex) => (
                <div key={group} className="flex flex-col items-center">
                  {WORKFLOW_COMMANDS.filter(c => c.group === group).map(({ cmd, icon, tip }) => (
                    <CommandButton
                      key={cmd}
                      cmd={cmd}
                      icon={icon}
                      tip={tip}
                      disabled={!isActiveConnected}
                      onClick={() => sendCommandToActive(cmd)}
                    />
                  ))}
                  {groupIndex < COMMAND_GROUPS.length - 1 && (
                    <div className="border-b border-border w-8 my-2" />
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col">
            <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold leading-tight">{project.name || projectId}</span>
                    {project.version && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        v{project.version}
                      </Badge>
                    )}
                  </div>
                  {project.repoPath && (
                    <span className="text-xs text-muted-foreground leading-tight flex items-center gap-1">
                      <FolderGit2 className="w-3 h-3" />
                      {formatPath(project.repoPath)}
                    </span>
                  )}
                </div>
                {hasActiveSessions && (
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    {sessions.filter(s => s.isConnected).length} active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {project.stack && <span>{project.stack}</span>}
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

            {/* Terminal tabs area */}
            <div className="flex-1">
              <TerminalTabs projectDir={project.repoPath || project.path || '/tmp'} />
            </div>
          </main>
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-medium">Project not found</h2>
            <p className="text-sm text-muted-foreground mt-1">ID: {projectId}</p>
          </div>
          <div className="flex gap-2 justify-center">
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
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Delete Project Data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will move the project storage to trash.
                  <br />
                  <span className="text-muted-foreground text-sm">ID: {projectId}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(projectId, { onSuccess: () => router.push('/') })}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

  return (
    <TerminalTabsProvider projectId={projectId}>
      <ProjectPageContent projectId={projectId} project={project} />
    </TerminalTabsProvider>
  )
}
