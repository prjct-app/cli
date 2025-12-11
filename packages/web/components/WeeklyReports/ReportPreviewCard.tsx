'use client'

import { Rocket, CheckCircle2, Bug, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateRange } from '@/lib/generate-week-report'
import type { WeekData } from '@/lib/generate-week-report'

interface ReportPreviewCardProps {
  weekData: WeekData[]
  className?: string
}

export function ReportPreviewCard({ weekData, className }: ReportPreviewCardProps) {
  if (weekData.length === 0) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <p className="text-muted-foreground text-center">Select a week to preview</p>
      </div>
    )
  }

  // Aggregate data from all selected weeks
  const allShipped = weekData.flatMap(w => w.shipped)
  const uniqueShipsMap = new Map<string, typeof allShipped[0]>()
  for (const ship of allShipped) {
    if (!uniqueShipsMap.has(ship.name)) {
      uniqueShipsMap.set(ship.name, ship)
    }
  }
  // Sort by date descending (most recent first)
  const uniqueShips = Array.from(uniqueShipsMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Group ships by date for display
  const shipsByDate = new Map<string, typeof uniqueShips>()
  for (const ship of uniqueShips) {
    const dateKey = ship.date
    if (!shipsByDate.has(dateKey)) {
      shipsByDate.set(dateKey, [])
    }
    shipsByDate.get(dateKey)!.push(ship)
  }

  const totalTasks = weekData.reduce((sum, w) => sum + w.tasksCompleted, 0)
  const totalBugs = weekData.reduce((sum, w) => sum + w.bugsFixed, 0)
  const totalSyncs = weekData.reduce((sum, w) => sum + w.syncs, 0)
  const totalDays = weekData.reduce((sum, w) => sum + w.activeDays, 0)

  // Date range header
  const firstWeek = weekData[0]
  const lastWeek = weekData[weekData.length - 1]
  const dateRangeStr = weekData.length === 1
    ? `Week ${firstWeek.week} · ${formatDateRange(firstWeek.startDate, firstWeek.endDate)}`
    : `Weeks ${firstWeek.week}-${lastWeek.week} · ${formatDateRange(firstWeek.startDate, lastWeek.endDate)}`

  const hasNoData = uniqueShips.length === 0 && totalTasks === 0 && totalBugs === 0 && totalDays === 0

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-muted/30">
        <h3 className="font-semibold text-lg">{dateRangeStr}</h3>
      </div>

      {hasNoData ? (
        <div className="p-6">
          <p className="text-muted-foreground text-center">No activity this week</p>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={Rocket}
              value={uniqueShips.length}
              label="shipped"
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <StatCard
              icon={CheckCircle2}
              value={totalTasks}
              label="tasks"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <StatCard
              icon={Bug}
              value={totalBugs}
              label="bugs"
              color="text-orange-500"
              bgColor="bg-orange-500/10"
            />
            <StatCard
              icon={Activity}
              value={totalDays}
              label="days"
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
          </div>

          {/* Shipped list grouped by date */}
          {uniqueShips.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Shipped
              </h4>
              <div className="space-y-4">
                {Array.from(shipsByDate.entries()).map(([date, ships]) => (
                  <div key={date}>
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(date).toLocaleDateString('es-MX', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <ul className="space-y-1.5 pl-2 border-l-2 border-emerald-500/30">
                      {ships.map((ship, i) => (
                        <li key={i} className="flex items-start gap-2 pl-2">
                          <span className="flex-1">
                            {ship.name}
                            {ship.version && (
                              <span className="text-muted-foreground ml-1 text-sm">({ship.version})</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity summary */}
          {(totalTasks > 0 || totalBugs > 0 || totalSyncs > 0) && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Activity
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {totalTasks > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                    {totalTasks} task{totalTasks !== 1 ? 's' : ''} completed
                  </li>
                )}
                {totalBugs > 0 && (
                  <li className="flex items-center gap-2">
                    <Bug className="h-3.5 w-3.5 text-orange-500" />
                    {totalBugs} bug{totalBugs !== 1 ? 's' : ''} fixed
                  </li>
                )}
                {totalSyncs > 0 && (
                  <li className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-purple-500" />
                    {totalSyncs} sync{totalSyncs !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ElementType
  value: number
  label: string
  color: string
  bgColor: string
}

function StatCard({ icon: Icon, value, label, color, bgColor }: StatCardProps) {
  return (
    <div className={cn('rounded-xl p-4 text-center', bgColor)}>
      <Icon className={cn('h-5 w-5 mx-auto mb-1', color)} />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
