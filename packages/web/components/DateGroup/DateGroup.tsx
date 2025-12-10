import { EventRow } from '@/components/EventRow'
import { formatTimelineDate } from './DateGroup.utils'
import type { DateGroupProps } from './DateGroup.types'

export function DateGroup({ dateKey, events }: DateGroupProps) {
  return (
    <div>
      <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {formatTimelineDate(dateKey + 'T00:00:00')}
      </p>
      <div className="space-y-1">
        {events.map((event, i) => (
          <EventRow key={i} event={event} />
        ))}
      </div>
    </div>
  )
}
