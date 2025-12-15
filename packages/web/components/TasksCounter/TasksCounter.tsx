import type { TasksCounterProps } from './TasksCounter.types'

export function TasksCounter({ count }: TasksCounterProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
      <span className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter tabular-nums">
        {count}
      </span>
      <span className="text-sm sm:text-base md:text-lg text-muted-foreground">
        shipped
      </span>
    </div>
  )
}
