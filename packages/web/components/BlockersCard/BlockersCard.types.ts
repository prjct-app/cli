export interface Blocker {
  task: string
  reason: string
  since: string
  daysBlocked: number
}

export interface BlockersCardProps {
  blockers: Blocker[]
  codeHref?: string
  className?: string
}
