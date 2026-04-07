import * as React from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  label: string
  value: number | string
  delta?: string
  trend?: "up" | "down" | "neutral"
  icon?: LucideIcon
  href?: string
  className?: string
}

export function StatCard({ label, value, delta, trend, icon: Icon, href, className }: StatCardProps) {
  const trendClass =
    trend === "up"
      ? "text-status-active bg-status-active-bg"
      : trend === "down"
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted"

  const body = (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 transition-colors",
        href && "hover:border-foreground/20 hover:bg-surface-2 cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-micro uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        {Icon && <Icon className="h-3 w-3 text-muted-foreground/60" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {delta && (
          <span className={cn("text-micro font-medium px-1.5 py-0.5 rounded", trendClass)}>{delta}</span>
        )}
      </div>
    </div>
  )

  return href ? <Link to={href}>{body}</Link> : body
}
