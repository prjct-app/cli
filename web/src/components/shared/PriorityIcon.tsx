import { cn } from '@/lib/utils'

interface PriorityIconProps {
  priority: string
  size?: 'sm' | 'md'
  className?: string
}

const BARS: Record<string, number> = { critical: 4, urgent: 4, high: 3, medium: 2, low: 1 }
const COLORS: Record<string, string> = {
  critical: 'bg-orange-500', urgent: 'bg-orange-500',
  high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-blue-400',
}

export function PriorityIcon({ priority, size = 'sm', className }: PriorityIconProps) {
  const n = BARS[priority] || 0
  const clr = COLORS[priority] || 'bg-muted-foreground/20'
  const h = size === 'md' ? 'h-4' : 'h-3.5'

  if (!n) {
    return (
      <span className={cn("inline-flex items-center justify-center text-muted-foreground/40", h, size === 'md' ? 'w-4' : 'w-3.5', className)}>
        <span className="text-[9px]">—</span>
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-end gap-[1.5px]", h, className)}>
      {[1, 2, 3, 4].map(i => (
        <span
          key={i}
          className={cn("w-[2px] rounded-[0.5px]", i <= n ? clr : 'bg-muted-foreground/10')}
          style={{ height: `${35 + i * 16}%` }}
        />
      ))}
    </span>
  )
}
