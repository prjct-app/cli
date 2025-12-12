'use client'

import { useState, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SessionsChart } from '@/components/charts/SessionsChart'
import { Button } from '@/components/ui/button'
import { ProjectAvatar } from '@/components/ProjectAvatar'
import { TechStackBadges } from '@/components/TechStackBadges'
import { formatRelativeTime, formatPath } from '@/lib/format'
import {
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Target,
  Lightbulb,
  ListTodo,
  Zap,
  FolderGit2,
  Play,
  FileText
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { deleteProject } from '@/lib/actions/projects'

export interface Project {
  id: string
  name: string
  path: string
  repoPath?: string | null
  currentTask?: string | null
  hasActiveSession?: boolean
  lastActivity?: string | null
  ideasCount?: number
  nextTasksCount?: number
  techStack?: string[]
  iconPath?: string | null
  version?: string
  stack?: string
  filesCount?: number
  commitsCount?: number
}

export interface GlobalStats {
  userName: string
  totalProjects: number
}

interface DashboardContentProps {
  projects: Project[]
  stats: GlobalStats
}

export function DashboardContent({ projects, stats }: DashboardContentProps) {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDeleteClick = useCallback((project: Project, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setProjectToDelete(project)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (projectToDelete) {
      startTransition(async () => {
        await deleteProject(projectToDelete.id)
        setProjectToDelete(null)
        router.refresh()
      })
    }
  }, [projectToDelete, router])

  const projectCount = projects?.length || 0

  return (
    <div className="p-4 sm:p-6 md:p-8 h-full overflow-auto">
      {/* Mobile: Add padding for hamburger menu */}
      <div className="pl-10 md:pl-0">
        <p className="text-sm sm:text-base text-muted-foreground">Hola! {stats?.userName || 'Developer'}</p>

        <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter tabular-nums mt-2">{projectCount}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">{projectCount === 1 ? 'project' : 'projects'}</p>
      </div>

      <section className="mt-6 sm:mt-8">
        <SessionsChart />
      </section>

      <section className="mt-8 sm:mt-10 md:mt-12">
        <h2 className="font-bold uppercase tracking-wide text-muted-foreground mb-4 sm:mb-6 text-sm">Active Projects</h2>

        {projects?.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-6 sm:p-8 text-center">
            <p className="text-muted-foreground text-sm sm:text-base">
              No projects yet. Initialize with <code className="bg-muted px-2 py-1 rounded font-mono text-xs sm:text-sm">/p:init</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects?.map((project: Project) => (
              <ProjectCard key={project.id} project={project} onDeleteClick={handleDeleteClick} />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open: boolean) => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&quot;{projectToDelete?.name}&quot;</strong> will be moved to trash.
              <br />
              <span className="text-muted-foreground text-xs sm:text-sm break-all">
                Location: ~/.prjct-cli/.trash/{projectToDelete?.id}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isPending} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom safe area padding */}
      <div className="h-6 sm:h-8" />
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  onDeleteClick: (project: Project, e: React.MouseEvent) => void
}

function ProjectCard({ project, onDeleteClick }: ProjectCardProps) {
  const hasStats = project.currentTask || project.nextTasksCount || project.ideasCount || project.lastActivity

  return (
    <div className="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 active:scale-[0.99] transition-all">
      {project.hasActiveSession && <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500" />}

      <Link href={`/project/${project.id}`} className="block p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <ProjectAvatar projectId={project.id} name={project.name} iconPath={project.iconPath} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold truncate text-sm sm:text-base">{project.name}</h3>
              {project.hasActiveSession && (
                <span className="flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
            {project.repoPath && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                <FolderGit2 className="w-3 h-3 shrink-0" />
                {formatPath(project.repoPath)}
              </p>
            )}
          </div>

          {/* Mobile: Always show menu button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="min-h-[44px] sm:min-h-0">
                <Link href={`/project/${project.id}/code`}>
                  <Play className="w-4 h-4 mr-2" />
                  Start working
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-[44px] sm:min-h-0">
                <Link href={`/project/${project.id}/reports`}>
                  <FileText className="w-4 h-4 mr-2" />
                  Reports
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive min-h-[44px] sm:min-h-0"
                onClick={(e: React.MouseEvent) => onDeleteClick(project, e)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {project.currentTask && (
          <div className="mt-3 p-2 bg-primary/5 rounded border border-primary/10">
            <div className="flex items-start gap-2">
              <Target className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-foreground line-clamp-2">{project.currentTask}</span>
            </div>
          </div>
        )}

        {hasStats && (
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            {(project.nextTasksCount ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <ListTodo className="w-3.5 h-3.5" />
                <span>{project.nextTasksCount} queued</span>
              </div>
            )}
            {(project.ideasCount ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{project.ideasCount} ideas</span>
              </div>
            )}
            {project.lastActivity && (
              <div className="flex items-center gap-1 ml-auto">
                <Zap className="w-3.5 h-3.5" />
                <span>{formatRelativeTime(project.lastActivity)}</span>
              </div>
            )}
          </div>
        )}

        {project.techStack && project.techStack.length > 0 && (
          <div className="mt-3">
            <TechStackBadges techStack={project.techStack} />
          </div>
        )}
      </Link>
    </div>
  )
}
