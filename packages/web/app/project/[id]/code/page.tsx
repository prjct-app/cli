'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useDeleteProject } from '@/hooks/useProjects'
import { TerminalTabsProvider, useTerminalTabs } from '@/context/TerminalTabsContext'
import { TerminalTabs } from '@/components/TerminalTabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
  Redo2,
  Command,
  X,
  RefreshCw,
  Home
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

// Command sidebar content - shared between desktop and mobile
function CommandSidebarContent({
  projectId,
  isActiveConnected,
  sendCommandToActive,
  onCommandClick
}: {
  projectId: string
  isActiveConnected: boolean
  sendCommandToActive: (cmd: string) => void
  onCommandClick?: () => void
}) {
  const router = useRouter()

  const handleCommand = (cmd: string) => {
    sendCommandToActive(cmd)
    onCommandClick?.()
  }

  return (
    <>
      <div className="h-14 flex items-center justify-center border-b border-border w-full">
        <button
          onClick={() => {
            router.push(`/project/${projectId}`)
            onCommandClick?.()
          }}
          className="h-10 w-10 rounded-lg bg-accent hover:bg-accent/80 flex items-center justify-center transition-colors"
          title="Home"
        >
          <Home className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1 overflow-auto py-3">
        {/* Sync button - prominent, always visible */}
        <CommandButton
          cmd="p. sync"
          icon={RefreshCw}
          tip="Sync"
          disabled={!isActiveConnected}
          onClick={() => handleCommand('p. sync')}
          variant="primary"
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
                onClick={() => handleCommand(cmd)}
              />
            ))}
            {groupIndex < COMMAND_GROUPS.length - 1 && (
              <div className="border-b border-border w-8 my-2" />
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// Inner component that uses the terminal context
function ProjectPageContent({ projectId, project }: { projectId: string; project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  const router = useRouter()
  const [commandSheetOpen, setCommandSheetOpen] = useState(false)

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
          {/* Desktop Sidebar - hidden on mobile */}
          <aside className="hidden md:flex w-14 border-r border-border flex-col bg-card/50 items-center">
            <CommandSidebarContent
              projectId={projectId}
              isActiveConnected={isActiveConnected}
              sendCommandToActive={sendCommandToActive}
            />
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Header - Responsive */}
            <header className="h-auto md:h-14 flex flex-col md:flex-row md:items-center justify-between px-3 md:px-4 py-2 md:py-0 border-b border-border bg-card gap-2">
              {/* Left: Project info */}
              <div className="flex items-center gap-3 pl-12 md:pl-0">
                {/* Mobile: Show project avatar */}
                <div className="md:hidden">
                  <ProjectAvatar
                    projectId={projectId}
                    name={project.name || projectId}
                    iconPath={project.iconPath}
                    size="sm"
                  />
                </div>
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

            {/* Terminal tabs area */}
            <div className="flex-1 min-h-0">
              <TerminalTabs projectDir={project.repoPath || project.path || '/tmp'} />
            </div>
          </main>
        </div>

        {/* Mobile: Floating Action Button for commands */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          <Sheet open={commandSheetOpen} onOpenChange={setCommandSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all",
                  isActiveConnected
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground"
                )}
                aria-label="Open commands"
              >
                <Command className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0">
              <div className="flex flex-col h-full">
                <div className="px-4 pb-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Commands</h3>
                    <Badge variant={isActiveConnected ? "default" : "secondary"}>
                      {isActiveConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </div>

                {/* Command grid for mobile */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="grid grid-cols-4 gap-3">
                    {/* Home button */}
                    <button
                      onClick={() => {
                        router.push(`/project/${projectId}`)
                        setCommandSheetOpen(false)
                      }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                        <Home className="h-5 w-5" />
                      </div>
                      <span className="text-xs text-muted-foreground">Home</span>
                    </button>

                    {/* Sync button - prominent */}
                    <button
                      onClick={() => {
                        sendCommandToActive('p. sync')
                        setCommandSheetOpen(false)
                      }}
                      disabled={!isActiveConnected}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                        isActiveConnected
                          ? "hover:bg-primary/10"
                          : "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        isActiveConnected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <RefreshCw className="h-5 w-5" />
                      </div>
                      <span className="text-xs text-primary font-medium">Sync</span>
                    </button>

                    {WORKFLOW_COMMANDS.map(({ cmd, icon: Icon, tip }) => (
                      <button
                        key={cmd}
                        onClick={() => {
                          sendCommandToActive(cmd)
                          setCommandSheetOpen(false)
                        }}
                        disabled={!isActiveConnected}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors",
                          isActiveConnected
                            ? "hover:bg-accent"
                            : "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          isActiveConnected ? "bg-accent" : "bg-muted"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs text-muted-foreground">{tip}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
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

  return (
    <TerminalTabsProvider projectId={projectId}>
      <ProjectPageContent projectId={projectId} project={project} />
    </TerminalTabsProvider>
  )
}
