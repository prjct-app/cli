import type { StatsResult } from './services/stats.server'

export interface ShippedItem {
  name: string
  date: string
  version?: string
  type?: string
}

export interface WeekData {
  year: number
  week: number
  startDate: Date
  endDate: Date
  shipped: ShippedItem[]
  tasksCompleted: number
  bugsFixed: number
  syncs: number
  activeDays: number
}

/**
 * Get ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Get current year and week
 */
export function getCurrentYearWeek(): { year: number; week: number } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    week: getWeekNumber(now)
  }
}

/**
 * Get start and end dates for a given ISO week
 */
export function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  // Find January 4th of the year (always in week 1)
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7

  // Find Monday of week 1
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)

  // Calculate target week's Monday
  const targetMonday = new Date(week1Monday)
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7)

  // Calculate Sunday
  const targetSunday = new Date(targetMonday)
  targetSunday.setDate(targetMonday.getDate() + 6)

  return { start: targetMonday, end: targetSunday }
}

/**
 * Format date range as string
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`
}

/**
 * Check if a date falls within a week
 */
function isDateInWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  const date = new Date(dateStr)
  return date >= weekStart && date <= weekEnd
}

/**
 * Filter stats data by week
 */
export function filterDataByWeek(
  stats: StatsResult,
  year: number,
  week: number
): WeekData {
  const { start, end } = getWeekDateRange(year, week)

  // 1. Shipped features from legacyStats.shipped (parsed from shipped.md)
  const shipped: ShippedItem[] = (stats.legacyStats?.shipped ?? [])
    .filter(item => {
      if (!item.date) return false
      return isDateInWeek(item.date, start, end)
    })
    .map(item => ({
      name: item.name,
      date: item.date!,
      version: item.version,
      type: item.type
    }))

  // 2. Timeline events from legacyStats.timeline (parsed from context.jsonl)
  const timeline = stats.legacyStats?.timeline ?? []
  const weekEvents = timeline.filter(e => {
    if (!e.ts) return false
    return isDateInWeek(e.ts, start, end)
  })

  // Count tasks completed
  const tasksCompleted = weekEvents.filter(e =>
    e.type === 'task_complete' ||
    e.type === 'task_completed' ||
    e.type === 'session_completed'
  ).length

  // Count bugs fixed
  const bugsFixed = weekEvents.filter(e =>
    e.type === 'bug_fix' ||
    e.type === 'bug_reported'
  ).length

  // Count syncs
  const syncs = weekEvents.filter(e => e.type === 'sync').length

  // 3. Also aggregate from sessions
  const sessions = stats.legacyStats?.sessions ?? []
  let sessionTasksCompleted = 0
  let sessionFeatures = 0
  const activeDaysSet = new Set<string>()

  for (const session of sessions) {
    if (session.date && isDateInWeek(session.date, start, end)) {
      activeDaysSet.add(session.date)
      sessionTasksCompleted += session.tasksCompleted || 0
      sessionFeatures += session.featuresShipped || 0
    }
  }

  // Add active days from timeline
  for (const e of weekEvents) {
    if (e.ts) {
      activeDaysSet.add(e.ts.split('T')[0])
    }
  }

  return {
    year,
    week,
    startDate: start,
    endDate: end,
    shipped,
    tasksCompleted: tasksCompleted + sessionTasksCompleted,
    bugsFixed,
    syncs,
    activeDays: activeDaysSet.size
  }
}

/**
 * Generate plain text report for WhatsApp/email - client friendly
 */
export function generateReportText(
  weekData: WeekData | WeekData[],
  projectName: string
): string {
  const weeks = Array.isArray(weekData) ? weekData : [weekData]

  if (weeks.length === 0) {
    return 'No weeks selected'
  }

  const lines: string[] = []

  // Header - clean and professional
  lines.push(`*${projectName}*`)

  // Date range - human readable
  if (weeks.length === 1) {
    const w = weeks[0]
    lines.push(`Weekly Report: ${formatDateRange(w.startDate, w.endDate)}`)
  } else {
    const firstWeek = weeks[0]
    const lastWeek = weeks[weeks.length - 1]
    lines.push(`Report: ${formatDateRange(firstWeek.startDate, lastWeek.endDate)}`)
  }
  lines.push('')

  // Aggregate data
  const allShipped = weeks.flatMap(w => w.shipped)
  // Deduplicate by name, keeping first occurrence (with version info)
  const uniqueShipsMap = new Map<string, ShippedItem>()
  for (const ship of allShipped) {
    if (!uniqueShipsMap.has(ship.name)) {
      uniqueShipsMap.set(ship.name, ship)
    }
  }
  // Sort by date descending (most recent first)
  const uniqueShips = Array.from(uniqueShipsMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Group by date
  const shipsByDate = new Map<string, ShippedItem[]>()
  for (const ship of uniqueShips) {
    if (!shipsByDate.has(ship.date)) {
      shipsByDate.set(ship.date, [])
    }
    shipsByDate.get(ship.date)!.push(ship)
  }

  // What we delivered - grouped by date
  if (uniqueShips.length > 0) {
    lines.push('*Shipped:*')
    for (const [date, ships] of shipsByDate.entries()) {
      const dateStr = new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      })
      lines.push(`_${dateStr}_`)
      for (const ship of ships) {
        const versionStr = ship.version ? ` (${ship.version})` : ''
        lines.push(`• ${ship.name}${versionStr}`)
      }
    }
    lines.push('')
  }

  // Aggregate progress metrics
  const totalTasks = weeks.reduce((sum, w) => sum + w.tasksCompleted, 0)
  const totalBugs = weeks.reduce((sum, w) => sum + w.bugsFixed, 0)
  const totalDays = weeks.reduce((sum, w) => sum + w.activeDays, 0)

  // Progress section
  if (totalTasks > 0 || totalBugs > 0 || totalDays > 0) {
    lines.push('*Progress:*')
    if (totalTasks > 0) {
      lines.push(`• ${totalTasks} task${totalTasks !== 1 ? 's' : ''} completed`)
    }
    if (totalBugs > 0) {
      lines.push(`• ${totalBugs} bug${totalBugs !== 1 ? 's' : ''} fixed`)
    }
    if (totalDays > 0) {
      lines.push(`• ${totalDays} active day${totalDays !== 1 ? 's' : ''}`)
    }
    lines.push('')
  }

  // If nothing happened, be honest
  if (uniqueShips.length === 0 && totalTasks === 0 && totalBugs === 0) {
    lines.push('_In progress, no deliveries this week._')
    lines.push('')
  }

  // Optional: Next steps placeholder
  lines.push('*Next:*')
  lines.push('• [To be defined]')

  return lines.join('\n')
}

/**
 * Get activity level for a week (for calendar indicator)
 */
export function getWeekActivityLevel(
  stats: StatsResult,
  year: number,
  week: number
): 'none' | 'low' | 'medium' | 'high' {
  const data = filterDataByWeek(stats, year, week)
  const total = data.shipped.length + data.tasksCompleted + data.bugsFixed + data.syncs

  if (total === 0) return 'none'
  if (total <= 3) return 'low'
  if (total <= 10) return 'medium'
  return 'high'
}
