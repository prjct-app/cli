import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: LucideIcon
  size?: "sm" | "md"
  tone?: "default" | "destructive" | "muted"
  side?: "top" | "right" | "bottom" | "left"
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon: Icon, size = "md", tone = "default", side = "top", className, ...props }, ref) => {
    const sizeClass = size === "sm" ? "h-6 w-6" : "h-7 w-7"
    const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"
    const toneClass =
      tone === "destructive"
        ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        : tone === "muted"
          ? "text-muted-foreground/60 hover:text-foreground hover:bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-colors outline-none",
              "focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              sizeClass,
              toneClass,
              className
            )}
            {...props}
          >
            <Icon className={iconClass} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    )
  }
)
IconButton.displayName = "IconButton"
