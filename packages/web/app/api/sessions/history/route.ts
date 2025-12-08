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
    const dailyMap = new Map<string, { tasks: number; ships: number }>()

    // Calculate date range (last 90 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    for (const projectId of projects) {
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
            const current = dailyMap.get(dateKey) || { tasks: 0, ships: 0 }

            const eventType = event.type || event.action

            // Count tasks completed
            if (eventType === 'task_complete' || eventType === 'task_completed') {
              current.tasks++
            }

            // Count features shipped
            if (eventType === 'feature_ship' || eventType === 'feature_shipped') {
              current.ships++
            }

            dailyMap.set(dateKey, current)
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip projects without context.jsonl
      }
    }

    // Convert to sorted array
    const data: DailyStats[] = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        tasks: stats.tasks,
        ships: stats.ships
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate totals for summary
    const totals = {
      tasks: data.reduce((sum, d) => sum + d.tasks, 0),
      ships: data.reduce((sum, d) => sum + d.ships, 0)
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
