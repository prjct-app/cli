import type { TimelineEvent } from '@/lib/parse-prjct-files'

export interface DateGroupProps {
  dateKey: string
  events: TimelineEvent[]
}
