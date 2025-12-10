export interface CurrentTask {
  task: string
  startedAt?: string
  agent?: string
  agentConfidence?: number
  estimatedDuration?: string
  pausedAt?: string
  pauseReason?: string
  duration?: string
}

export interface NowCardProps {
  currentTask: CurrentTask | null
  className?: string
}
