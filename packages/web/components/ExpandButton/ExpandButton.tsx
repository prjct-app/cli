import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ExpandButtonProps } from './ExpandButton.types'

export function ExpandButton({ expanded, totalCount, collapsedLimit, onToggle }: ExpandButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="w-full text-muted-foreground min-h-[44px]"
    >
      <ChevronDown className={cn('h-4 w-4 mr-1 transition-transform', expanded && 'rotate-180')} />
      {expanded ? 'Show less' : `Show ${totalCount - collapsedLimit} more`}
    </Button>
  )
}
