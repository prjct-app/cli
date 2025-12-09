'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { SessionsChart } from '@/components/charts/SessionsChart'
import { Button } from '@/components/ui/button'
import { ProjectAvatar } from '@/components/ProjectAvatar'
import { TechStackBadges } from '@/components/TechStackBadges'
import { formatRelativeTime, formatPath } from '@/lib/format'
import { useProjects, useDeleteProject, type Project } from '@/hooks/useProjects'
import { useStats } from '@/hooks/useStats'
import {
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Target,
  Lightbulb,
  ListTodo,
  Zap,
  FolderGit2
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

export default function Dashboard() {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: stats } = useStats()
  const deleteMutation = useDeleteProject()

  const handleDeleteClick = useCallback((project: Project, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setProjectToDelete(project)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id, {
        onSuccess: () => setProjectToDelete(null)
      })
    }
  }, [projectToDelete, deleteMutation])

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const projectCount = projects?.length || 0

  return (
    <div className="p-8 h-full overflow-auto">
      <p className="text-muted-foreground">Hola! {stats?.userName || 'Developer'}</p>

      <h1 className="text-8xl font-bold tracking-tighter tabular-nums mt-2">{projectCount}</h1>
      <p className="text-muted-foreground mt-1">{projectCount === 1 ? 'project' : 'projects'}</p>

      <section className="mt-8">
        <SessionsChart />
      </section>

      <section className="mt-12">
        <h2 className="font-bold uppercase tracking-wide text-muted-foreground mb-6">Active Projects</h2>

        {projects?.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              No projects yet. Initialize with <code className="bg-muted px-2 py-1 rounded font-mono">/p:init</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project: Project) => (
              <ProjectCard key={project.id} project={project} onDeleteClick={handleDeleteClick} />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open: boolean) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&quot;{projectToDelete?.name}&quot;</strong> will be moved to trash.
              <br />
              <span className="text-muted-foreground text-sm">
                Location: ~/.prjct-cli/.trash/{projectToDelete?.id}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <div className="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all">
      {project.hasActiveSession && <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500" />}

      <Link href={`/project/${project.id}`} className="block p-4">
        <div className="flex items-start gap-3">
          <ProjectAvatar projectId={project.id} name={project.name} iconPath={project.iconPath} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold truncate">{project.name}</h3>
              {project.hasActiveSession && (
                <span className="flex h-2 w-2">
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
        </div>

        {project.currentTask && (
          <div className="mt-3 p-2 bg-primary/5 rounded border border-primary/10">
            <div className="flex items-start gap-2">
              <Target className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground line-clamp-2">{project.currentTask}</span>
            </div>
          </div>
        )}

        {hasStats && (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e: React.MouseEvent) => onDeleteClick(project, e)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
