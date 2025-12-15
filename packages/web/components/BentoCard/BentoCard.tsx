import { cn } from '@/lib/utils'
import { BENTO_SIZE_CLASSES, ACCENT_STYLES } from './BentoCard.constants'
import type { BentoCardProps } from './BentoCard.types'

export function BentoCard({
  size = '1x1',
  title,
  count,
  icon: Icon,
  accentColor = 'default',
  className,
  headerClassName,
  children,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card transition-all duration-200',
        'p-3 sm:p-4',
        'hover:shadow-md hover:border-foreground/20',
        'active:scale-[0.99]',
        'min-w-0 max-w-full',
        BENTO_SIZE_CLASSES[size],
        ACCENT_STYLES[accentColor],
        className
      )}
    >
      {(title || count !== undefined || Icon) && (
        <div className={cn('flex items-center justify-between mb-2 sm:mb-3', headerClassName)}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />}
            {title && (
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {title}
              </span>
            )}
          </div>
          {count !== undefined && (
            <span className="text-sm sm:text-xs font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
