'use client'

import { cn } from '@/lib/utils'
import {
  WORKFLOW_COMMANDS,
  COMMAND_GROUPS,
  SYNC_COMMAND,
} from '@/lib/commands'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CommandBarProps {
  isConnected: boolean
  onCommand: (cmd: string) => void
}

export function CommandBar({ isConnected, onCommand }: CommandBarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onCommand(SYNC_COMMAND.cmd)}
            disabled={!isConnected}
            className={cn(
              'p-1.5 rounded transition-colors',
              isConnected
                ? 'text-orange-500 hover:bg-orange-500/10'
                : 'text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            <SYNC_COMMAND.icon className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{SYNC_COMMAND.tip}</TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-1" />

      {COMMAND_GROUPS.map((group, groupIdx) => (
        <div key={group} className="flex items-center">
          {WORKFLOW_COMMANDS.filter(c => c.group === group).map(({ cmd, icon: Icon, tip }) => (
            <Tooltip key={cmd}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCommand(cmd)}
                  disabled={!isConnected}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isConnected
                      ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      : 'text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tip}</TooltipContent>
            </Tooltip>
          ))}
          {groupIdx < COMMAND_GROUPS.length - 1 && (
            <div className="w-px h-4 bg-border mx-0.5" />
          )}
        </div>
      ))}
    </div>
  )
}
