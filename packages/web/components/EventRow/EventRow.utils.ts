import type { EventIconName } from './EventRow.types'

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function getEventIconName(type: string): EventIconName {
  const iconMap: Record<string, EventIconName> = {
    task_complete: 'check',
    task_start: 'target',
    feature_ship: 'rocket',
    sync: 'refresh',
  }
  return iconMap[type] ?? 'activity'
}

export function getEventColor(type: string): string {
  const colorMap: Record<string, string> = {
    task_complete: 'text-muted-foreground',
    task_start: 'text-muted-foreground',
    feature_ship: 'text-muted-foreground',
    sync: 'text-muted-foreground',
  }
  return colorMap[type] ?? 'text-muted-foreground'
}

export function getEventBadge(type: string): string {
  const badgeMap: Record<string, string> = {
    task_complete: 'DONE',
    task_start: 'START',
    feature_ship: 'SHIP',
    sync: 'SYNC',
  }
  return badgeMap[type] ?? type.toUpperCase()
}

export function getEventLabel(event: unknown): string {
  const e = event as { type?: string; task?: string; name?: string }
  const type = e.type ?? ''

  const labelMap: Record<string, string> = {
    task_complete: e.task ?? 'Task completed',
    task_start: e.task ?? 'Task started',
    feature_ship: e.name ?? 'Feature shipped',
    sync: 'Project synced',
  }
  return labelMap[type] ?? type
}
