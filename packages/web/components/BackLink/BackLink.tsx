import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BackLinkProps } from './BackLink.types'

export function BackLink({ projectId, projectName, className }: BackLinkProps) {
  return (
    <div className={cn('relative flex', className)}>
      <Link
        href={`/project/${projectId}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        {projectName}
      </Link>
    </div>
  )
}
