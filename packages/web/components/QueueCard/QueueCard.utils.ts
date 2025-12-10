export function getPriorityColor(priority?: 'low' | 'medium' | 'high' | 'critical' | number): string {
  if (typeof priority === 'string') {
    const colors: Record<string, string> = {
      critical: 'text-red-500',
      high: 'text-amber-500',
      medium: 'text-blue-500',
      low: 'text-muted-foreground',
    }
    return colors[priority] ?? 'text-muted-foreground'
  }
  return 'text-muted-foreground'
}
