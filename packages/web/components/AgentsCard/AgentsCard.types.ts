export interface Agent {
  name: string
  description?: string
  successRate?: number
  tasksCompleted?: number
  improving?: boolean
  bestFor?: string[]
}

export interface AgentsCardProps {
  agents: Agent[]
  className?: string
}
