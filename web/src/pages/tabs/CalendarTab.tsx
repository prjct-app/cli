import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Rocket, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'
import { typeColor } from '@/lib/taskStyles'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface CalEvent {
  id: string
  title: string
  date: string
  type: 'completed' | 'shipped'
  classification?: string
}

export function CalendarTab() {
  const { data, history } = useTabCtx()
  const shipped = data.shipped?.shipped || []

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  // Gather events from history and shipped
  const events = useMemo<CalEvent[]>(() => {
    const evts: CalEvent[] = []
    for (const h of history) {
      if (h.completedAt) {
        evts.push({
          id: h.taskId,
          title: h.title,
          date: h.completedAt.split('T')[0],
          type: 'completed',
          classification: h.classification,
        })
      }
    }
    for (const s of shipped) {
      if (s.shippedAt) {
        evts.push({
          id: s.id,
          title: s.name,
          date: s.shippedAt.split('T')[0],
          type: 'shipped',
          classification: s.type,
        })
      }
    }
    return evts
  }, [history, shipped])

  // Group events by date
  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) {
      const list = map.get(e.date) || []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [events])

  // Calendar grid
  const firstDay = new Date(month.year, month.month, 1)
  const lastDay = new Date(month.year, month.month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Monday=0 offset
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    setMonth(m => {
      if (m.month === 0) return { year: m.year - 1, month: 11 }
      return { ...m, month: m.month - 1 }
    })
  }
  function nextMonth() {
    setMonth(m => {
      if (m.month === 11) return { year: m.year + 1, month: 0 }
      return { ...m, month: m.month + 1 }
    })
  }
  function goToday() {
    setMonth({ year: today.getFullYear(), month: today.getMonth() })
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  if (events.length === 0) {
    return (
      <div className="px-6 py-5">
        <EmptyState icon={CalendarIcon} title="No activity yet" description="Completed tasks and shipped items will appear on the calendar" />
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {MONTH_NAMES[month.month]} {month.year}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">Today</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-2/60">
            {DAY_NAMES.map(d => (
              <div key={d} className="px-2 py-1.5 text-micro font-medium text-muted-foreground text-center uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} className="border-b border-r border-border bg-surface-1/30 min-h-[80px]" />
              }

              const dateStr = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = byDate.get(dateStr) || []
              const isToday = dateStr === todayStr

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "border-b border-r border-border min-h-[80px] p-1.5 transition-colors",
                    isToday && "bg-surface-2",
                    dayEvents.length > 0 && "bg-card"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-5 w-5 text-micro font-medium rounded-full",
                      isToday ? "bg-foreground text-background" : "text-muted-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <Tooltip key={evt.id}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "flex items-center gap-1 px-1 py-0.5 rounded text-micro truncate cursor-help",
                            evt.type === 'shipped' ? "bg-type-feature-bg" : "bg-surface-2"
                          )}>
                            {evt.type === 'shipped'
                              ? <Rocket className={cn("h-2.5 w-2.5 shrink-0", typeColor(evt.classification))} />
                              : <Check className={cn("h-2.5 w-2.5 shrink-0", typeColor(evt.classification))} />
                            }
                            <span className="truncate">{evt.title}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="font-medium">{evt.title}</p>
                          <p className="text-muted-foreground capitalize">{evt.type} · {evt.classification}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-micro text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-micro text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="h-3 w-3" /> Task completed</span>
          <span className="flex items-center gap-1.5"><Rocket className="h-3 w-3" /> Shipped</span>
        </div>
      </div>
    </div>
  )
}
