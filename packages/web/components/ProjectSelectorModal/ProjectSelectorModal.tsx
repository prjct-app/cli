'use client'

import { useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ProjectAvatar } from '@/components/ProjectAvatar'
import { Loader2, Search, FolderGit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPath } from '@/lib/format'

interface ProjectSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectProject: (projectId: string, projectName: string, projectPath: string) => void
}

export function ProjectSelectorModal({
  isOpen,
  onClose,
  onSelectProject,
}: ProjectSelectorModalProps) {
  const [search, setSearch] = useState('')
  const { data: projects, isLoading } = useProjects()

  const filteredProjects = projects?.filter((project) =>
    project.name?.toLowerCase().includes(search.toLowerCase()) ||
    project.repoPath?.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Project</DialogTitle>
          <DialogDescription>
            Choose a project to open a terminal session
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No projects found' : 'No projects available'}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  const projectPath = project.repoPath || project.path || '/tmp'
                  const projectName = project.name || project.id
                  onSelectProject(project.id, projectName, projectPath)
                }}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                  'hover:bg-accent text-left'
                )}
              >
                <ProjectAvatar
                  projectId={project.id}
                  name={project.name || project.id}
                  iconPath={project.iconPath}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {project.name || project.id}
                  </div>
                  {project.repoPath && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <FolderGit2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatPath(project.repoPath)}</span>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
