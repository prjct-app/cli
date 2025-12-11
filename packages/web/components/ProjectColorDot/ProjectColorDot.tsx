'use client'

import { cn } from '@/lib/utils'
import { getProjectColor } from '@/lib/project-colors'

interface ProjectColorDotProps {
  projectId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
  xl: 'w-5 h-5',
}

export function ProjectColorDot({
  projectId,
  size = 'md',
  className
}: ProjectColorDotProps) {
  const color = getProjectColor(projectId)

  return (
    <div
      className={cn(
        'rounded-full shrink-0',
        sizeClasses[size],
        color.bg,
        className
      )}
      aria-hidden="true"
    />
  )
}
