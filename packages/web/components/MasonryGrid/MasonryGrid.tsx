import { cn } from '@/lib/utils'

interface MasonryGridProps {
  children: React.ReactNode
  className?: string
}

export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className={cn(
      'columns-1 sm:columns-2 xl:columns-3 gap-4 max-w-full overflow-x-hidden',
      '[&>*]:mb-4 [&>*]:break-inside-avoid',
      className
    )}>
      {children}
    </div>
  )
}
