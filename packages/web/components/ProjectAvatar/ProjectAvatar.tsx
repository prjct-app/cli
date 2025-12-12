'use client'

import { cn } from '@/lib/utils'

interface ProjectAvatarProps {
  projectId: string
  name: string
  iconPath?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-10 h-10 text-sm'
}

export function ProjectAvatar({
  projectId,
  name,
  iconPath,
  size = 'md',
  className
}: ProjectAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center overflow-hidden shrink-0 bg-muted border border-border',
        sizeClasses[size],
        className
      )}
    >
      {iconPath ? (
        <img
          src={`/api/projects/${projectId}/icon`}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            if (e.currentTarget.nextElementSibling) {
              (e.currentTarget.nextElementSibling as HTMLElement).classList.remove('hidden')
            }
          }}
        />
      ) : null}
      <span className={cn('font-medium text-muted-foreground', iconPath ? 'hidden' : '')}>
        {initials}
      </span>
    </div>
  )
}
