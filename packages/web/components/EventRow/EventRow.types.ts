import type { TimelineEvent } from '@/lib/parse-prjct-files'

export type EventIconName = 'check' | 'target' | 'rocket' | 'refresh' | 'activity'

export interface EventRowProps {
  event: TimelineEvent
}
