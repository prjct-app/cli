export interface QueueItem {
  task: string
  priority?: 'low' | 'medium' | 'high' | 'critical' | number
  suggestedAgent?: string
  estimatedDuration?: string
}

export interface QueueCardProps {
  queue: QueueItem[]
  codeHref?: string
  className?: string
}
