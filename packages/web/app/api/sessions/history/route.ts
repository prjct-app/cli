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

interface DailyStats {
  date: string
  tasks: number
  ships: number
  partial: number
}

export async function GET() {
  try {
    const globalStorage = join(homedir(), '.prjct-cli', 'projects')

    let projects: string[]
    try {
      projects = await fs.readdir(globalStorage)
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          chartData: [],
          totals: { tasks: 0, ships: 0 },
          dateRange: { start: '', end: '' }
        }
      })
    }

    // Aggregate by date
    const dailyMap = new Map<string, { tasks: number; ships: number; partial: number }>()

    // Calculate date range (last 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    for (const projectId of projects) {
      // Skip hidden directories
      if (projectId.startsWith('.')) continue

      // Read from memory/context.jsonl (legacy)
      const contextPath = join(globalStorage, projectId, 'memory', 'context.jsonl')
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
            if (eventDate < startDate || eventDate > endDate) continue

            const dateKey = eventDate.toISOString().split('T')[0]
            const current = dailyMap.get(dateKey) || { tasks: 0, ships: 0, partial: 0 }

            const eventType = event.type || event.action

            // Count tasks completed
            if (eventType === 'task_complete' || eventType === 'task_completed' || eventType === 'session_completed') {
              current.tasks++
            }

            // Count features shipped
            if (eventType === 'feature_ship' || eventType === 'feature_shipped') {
              current.ships++
            }

            // Count partial/abandoned sessions
            if (eventType === 'session_partial' || eventType === 'session_abandoned') {
              current.partial++
            }

            dailyMap.set(dateKey, current)
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip projects without context.jsonl
      }

      // Read from progress/sessions/{YYYY-MM}/{date}.jsonl (new format)
      const sessionsDir = join(globalStorage, projectId, 'progress', 'sessions')
      try {
        const monthDirs = await fs.readdir(sessionsDir)
        for (const monthDir of monthDirs) {
          // Skip non-directory entries
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
                    if (eventDate < startDate || eventDate > endDate) continue

                    const dateKey = eventDate.toISOString().split('T')[0]
                    const current = dailyMap.get(dateKey) || { tasks: 0, ships: 0, partial: 0 }

                    const eventType = event.type || event.action

                    // Count tasks completed
                    if (eventType === 'task_complete' || eventType === 'task_completed') {
                      current.tasks++
                    }

                    // Count features shipped
                    if (eventType === 'feature_ship' || eventType === 'feature_shipped') {
                      current.ships++
                    }

                    // Count partial/abandoned sessions
                    if (eventType === 'session_partial' || eventType === 'session_abandoned') {
                      current.partial++
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
        // Skip projects without sessions directory
      }
    }

    // Generate all dates in range (90 days), filling gaps with zeros
    const data: DailyStats[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      const stats = dailyMap.get(dateKey) || { tasks: 0, ships: 0, partial: 0 }
      data.push({
        date: dateKey,
        tasks: stats.tasks,
        ships: stats.ships,
        partial: stats.partial
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate totals for summary
    const totals = {
      tasks: data.reduce((sum, d) => sum + d.tasks, 0),
      ships: data.reduce((sum, d) => sum + d.ships, 0),
      partial: data.reduce((sum, d) => sum + d.partial, 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        chartData: data,
        totals,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      }
    })
  } catch (error) {
    console.error('Sessions history error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session history' },
      { status: 500 }
    )
  }
}
