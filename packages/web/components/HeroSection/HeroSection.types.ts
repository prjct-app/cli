import type { TimelineEvent } from '@/lib/parse-prjct-files'

export type { TimelineEvent }

export interface HeroProps {
  projectId: string
  projectName: string
  projectVersion?: string | null
  totalShips: number
  completionRate: number
  streak: number
  insightMessage: string
  timeline?: TimelineEvent[]
}
