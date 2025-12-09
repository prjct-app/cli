'use client'

import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CommandButtonProps {
  cmd: string
  icon: LucideIcon
  tip: string
  disabled?: boolean
  onClick: () => void
}

export function CommandButton({ cmd, icon: Icon, tip, disabled, onClick }: CommandButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className="h-11 w-11"
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
