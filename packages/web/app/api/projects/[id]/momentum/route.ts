import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export const dynamic = 'force-dynamic'

interface SessionEvent {
  ts?: string
  timestamp?: string
  type?: string
  action?: string
}

type MomentumStatus = 'hot' | 'active' | 'cooling' | 'cold'

interface MomentumData {
  dailyTasks: number[]
  totalTasks: number
  totalShips: number
  lastActivityDate: string | null
  daysSinceActivity: number
  streak: number
  status: MomentumStatus
  message: string
}

function getStatus(
  daysSinceActivity: number,
  totalTasks: number,
  dailyTasks: number[],
  streak: number
): { status: MomentumStatus; message: string } {
  // Abandoned - 7+ days without activity
  if (daysSinceActivity >= 7) {
    return { status: 'cold', message: 'Miss you!' }
  }

  // No activity ever
  if (totalTasks === 0) {
    return { status: 'active', message: 'Start building!' }
  }

  // Check if trending up (recent days > earlier days)
  const recentDays = dailyTasks.slice(-3).reduce((a, b) => a + b, 0)
  const earlierDays = dailyTasks.slice(0, 4).reduce((a, b) => a + b, 0)
  const isTrendingUp = recentDays > earlierDays || streak >= 2

  // Hot - trending up or on a streak
  if (isTrendingUp && daysSinceActivity <= 1) {
    return { status: 'hot', message: streak >= 2 ? `${streak} day streak!` : 'On fire!' }
  }

  // Normal activity - neutral
  if (daysSinceActivity <= 3) {
    return { status: 'active', message: `${totalTasks} this week` }
  }

  // Cooling down but not abandoned
  return { status: 'cooling', message: `${daysSinceActivity}d ago` }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const globalStorage = join(homedir(), '.prjct-cli', 'projects')
    const projectPath = join(globalStorage, projectId)

    // Check if project exists
    try {
      await fs.access(projectPath)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Calculate date range (last 7 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 6) // 7 days including today
    startDate.setHours(0, 0, 0, 0)

    const dailyMap = new Map<string, { tasks: number; ships: number }>()
    let lastActivityDate: Date | null = null

    // Read from memory/context.jsonl (legacy)
    const contextPath = join(projectPath, 'memory', 'context.jsonl')
    try {
      const content = await fs.readFile(contextPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const event: SessionEvent = JSON.parse(line)
          const timestamp = event.ts || event.timestamp
          if (!timestamp) continue

          const eventDate = new Date(timestamp)
          if (isNaN(eventDate.getTime())) continue

          const eventType = event.type || event.action

          // Track last activity for any relevant event
          if (eventType === 'task_complete' || eventType === 'task_completed' ||
              eventType === 'feature_ship' || eventType === 'feature_shipped') {
            if (!lastActivityDate || eventDate > lastActivityDate) {
              lastActivityDate = eventDate
            }
          }

          // Only count last 7 days for sparkline
          if (eventDate < startDate || eventDate > endDate) continue

          const dateKey = eventDate.toISOString().split('T')[0]
          const current = dailyMap.get(dateKey) || { tasks: 0, ships: 0 }

          if (eventType === 'task_complete' || eventType === 'task_completed') {
            current.tasks++
          }
          if (eventType === 'feature_ship' || eventType === 'feature_shipped') {
            current.ships++
          }

          dailyMap.set(dateKey, current)
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // No context.jsonl
    }

    // Read from progress/sessions/{YYYY-MM}/{date}.jsonl (new format)
    const sessionsDir = join(projectPath, 'progress', 'sessions')
    try {
      const monthDirs = await fs.readdir(sessionsDir)
      for (const monthDir of monthDirs) {
        if (!monthDir.match(/^\d{4}-\d{2}$/)) continue

        const monthPath = join(sessionsDir, monthDir)
        try {
          const dayFiles = await fs.readdir(monthPath)
          for (const dayFile of dayFiles) {
            if (!dayFile.endsWith('.jsonl')) continue

            const dayPath = join(monthPath, dayFile)
            try {
              const content = await fs.readFile(dayPath, 'utf-8')
              const lines = content.trim().split('\n').filter(Boolean)

              for (const line of lines) {
                try {
                  const event: SessionEvent = JSON.parse(line)
                  const timestamp = event.ts || event.timestamp
                  if (!timestamp) continue

                  const eventDate = new Date(timestamp)
                  if (isNaN(eventDate.getTime())) continue

                  const eventType = event.type || event.action

                  // Track last activity
                  if (eventType === 'task_complete' || eventType === 'task_completed' ||
                      eventType === 'feature_ship' || eventType === 'feature_shipped') {
                    if (!lastActivityDate || eventDate > lastActivityDate) {
                      lastActivityDate = eventDate
                    }
                  }

                  // Only count last 7 days for sparkline
                  if (eventDate < startDate || eventDate > endDate) continue

                  const dateKey = eventDate.toISOString().split('T')[0]
                  const current = dailyMap.get(dateKey) || { tasks: 0, ships: 0 }

                  if (eventType === 'task_complete' || eventType === 'task_completed') {
                    current.tasks++
                  }
                  if (eventType === 'feature_ship' || eventType === 'feature_shipped') {
                    current.ships++
                  }

                  dailyMap.set(dateKey, current)
                } catch {
                  // Skip malformed lines
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip unreadable month directories
        }
      }
    } catch {
      // No sessions directory
    }

    // Generate daily tasks array for sparkline (7 days)
    const dailyTasks: number[] = []
    let totalTasks = 0
    let totalShips = 0
    let streak = 0
    let streakBroken = false

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      const stats = dailyMap.get(dateKey) || { tasks: 0, ships: 0 }
      dailyTasks.push(stats.tasks + stats.ships)
      totalTasks += stats.tasks
      totalShips += stats.ships
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate streak (consecutive days with activity from today backwards)
    for (let i = dailyTasks.length - 1; i >= 0; i--) {
      if (dailyTasks[i] > 0 && !streakBroken) {
        streak++
      } else if (dailyTasks[i] === 0 && i < dailyTasks.length - 1) {
        streakBroken = true
      }
    }

    // Calculate days since last activity
    const daysSinceActivity = lastActivityDate
      ? Math.floor((endDate.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const { status, message } = getStatus(daysSinceActivity, totalTasks, dailyTasks, streak)

    const data: MomentumData = {
      dailyTasks,
      totalTasks,
      totalShips,
      lastActivityDate: lastActivityDate?.toISOString() || null,
      daysSinceActivity,
      streak,
      status,
      message
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Momentum API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch momentum data' },
      { status: 500 }
    )
  }
}
