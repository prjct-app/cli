export function getPriorityColor(priority?: 'low' | 'medium' | 'high' | 'critical' | number): string {
  if (typeof priority === 'string') {
    const colors: Record<string, string> = {
      critical: 'text-foreground font-bold',
      high: 'text-foreground',
      medium: 'text-muted-foreground',
      low: 'text-muted-foreground',
    }
    return colors[priority] ?? 'text-muted-foreground'
  }
  return 'text-muted-foreground'
}
