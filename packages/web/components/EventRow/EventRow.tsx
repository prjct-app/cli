import { cn } from '@/lib/utils'
import { EVENT_ICON_MAP } from './EventRow.constants'
import {
  formatTime,
  getEventIconName,
  getEventColor,
  getEventBadge,
  getEventLabel,
} from './EventRow.utils'
import type { EventRowProps } from './EventRow.types'

export function EventRow({ event }: EventRowProps) {
  const iconName = getEventIconName(event.type)
  const Icon = EVENT_ICON_MAP[iconName]
  const duration = 'duration' in event && typeof event.duration === 'string' ? event.duration : null

  return (
    <div className="flex items-center gap-2 sm:gap-3 py-2 sm:py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 active:bg-muted/70 transition-colors group">
      {event.ts && (
        <span className="hidden sm:block text-[10px] text-muted-foreground w-14 shrink-0 tabular-nums">
          {formatTime(event.ts)}
        </span>
      )}

      <Icon className={cn('h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0', getEventColor(event.type))} />

      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block group-hover:text-foreground transition-colors">
          {getEventLabel(event)}
        </span>
        {event.ts && (
          <span className="sm:hidden text-[10px] text-muted-foreground">
            {formatTime(event.ts)}
          </span>
        )}
      </div>

      <span className="text-[9px] font-bold tracking-wider text-muted-foreground shrink-0">
        {getEventBadge(event.type)}
      </span>

      {duration && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {duration}
        </span>
      )}
    </div>
  )
}
