import type { TimelineEvent } from '@/lib/parse-prjct-files'

export type { TimelineEvent }

export interface HeroProps {
  projectId: string
  projectName: string
  tasksCompleted: number
  healthScore: number
  velocity: number
  velocityChange: number
  insightMessage: string
  timeline?: TimelineEvent[]
}
