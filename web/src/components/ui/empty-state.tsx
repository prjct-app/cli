import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  size?: "sm" | "md"
}

export function EmptyState({ icon: Icon, title, description, action, className, size = "md" }: EmptyStateProps) {
  const isSm = size === "sm"
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", isSm ? "py-8 px-4" : "py-12 px-6", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-surface-2 border border-border/60 mb-3",
          isSm ? "h-8 w-8" : "h-10 w-10"
        )}
      >
        <Icon className={cn("text-muted-foreground", isSm ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </div>
      <p className={cn("font-medium text-foreground", isSm ? "text-xs" : "text-sm")}>{title}</p>
      {description && (
        <p className={cn("text-muted-foreground max-w-sm mt-1", isSm ? "text-micro" : "text-xs")}>{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
