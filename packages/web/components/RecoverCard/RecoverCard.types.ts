export interface AbandonedSession {
  id: string
  task: string
  projectId: string
  projectName?: string
  startedAt: string
  lastActivity?: string
  hoursAgo: number
  prompt?: string
}

export interface RecoverCardProps {
  abandonedSessions: AbandonedSession[]
  codeHref: string
  className?: string
}
