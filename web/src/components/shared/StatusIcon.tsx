import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusIconProps {
  section: string
  completed?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZE = { xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4' }
const CHECK = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-2.5 w-2.5' }
const BORDER = { xs: 'border-[1.5px]', sm: 'border-[2px]', md: 'border-[2px]' }

export function StatusIcon({ section, completed, size = 'sm', className }: StatusIconProps) {
  const s = completed ? 'previously_active' : section

  if (s === 'active') {
    return <span className={cn(SIZE[size], "rounded-full border-amber-500 shrink-0", BORDER[size], className)} />
  }
  if (s === 'previously_active') {
    return (
      <span className={cn(SIZE[size], "rounded-full bg-indigo-500 flex items-center justify-center shrink-0", className)}>
        <Check className={cn(CHECK[size], "text-white")} strokeWidth={3} />
      </span>
    )
  }
  return <Circle className={cn(SIZE[size], "text-muted-foreground/40 shrink-0", className)} />
}
