import type { TimelineEvent } from '@/lib/parse-prjct-files'

export type { TimelineEvent }

export interface ActivityTimelineProps {
  timeline: TimelineEvent[]
  className?: string
}
