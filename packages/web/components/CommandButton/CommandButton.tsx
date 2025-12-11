'use client'

import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface CommandButtonProps {
  cmd: string
  icon: LucideIcon
  tip: string
  disabled?: boolean
  onClick: () => void
  variant?: 'default' | 'primary'
}

export function CommandButton({ cmd, icon: Icon, tip, disabled, onClick, variant = 'default' }: CommandButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isPrimary ? 'default' : 'ghost'}
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-11 w-11",
            isPrimary && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Icon className="w-5 h-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-semibold">{tip}</p>
        <p className="font-mono text-xs text-muted-foreground">{cmd}</p>
      </TooltipContent>
    </Tooltip>
  )
}
