/**
 * Stats Routes - Global statistics
 */

import { Hono } from 'hono'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const app = new Hono()

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

/**
 * GET /api/stats - Get global statistics
 */
app.get('/', async (c) => {
  try {
    const stats = {
      activeSessions: 0,
      totalProjects: 0,
      todaySessions: 0,
      todayTime: 0, // seconds
      weekCommits: 0,
      weekFilesChanged: 0,
      completedToday: 0
    }

    const dirs = await fs.readdir(GLOBAL_STORAGE)

    // Only count valid projects (with CLAUDE.md)
    let validProjects = 0
    for (const dir of dirs) {
      try {
        await fs.access(join(GLOBAL_STORAGE, dir, 'CLAUDE.md'))
        validProjects++
      } catch {
        // Not a valid project
      }
    }
    stats.totalProjects = validProjects

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTs = today.getTime()

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoTs = weekAgo.getTime()

    for (const projectId of dirs) {
      const projectPath = join(GLOBAL_STORAGE, projectId)

      // Check current session
      try {
        const sessionPath = join(projectPath, 'sessions', 'current.json')
        const content = await fs.readFile(sessionPath, 'utf-8')
        const session = JSON.parse(content)

        if (session.status === 'active') {
          stats.activeSessions++
        }

        // Check if started today
        const startedAt = new Date(session.startedAt).getTime()
        if (startedAt >= todayTs) {
          stats.todaySessions++
          stats.todayTime += session.duration || 0
        }
      } catch {
        // No current session
      }

      // Check archived sessions for today's completed
      try {
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        const archivePath = join(projectPath, 'sessions', 'archive', yearMonth)
        const files = await fs.readdir(archivePath)

        for (const file of files) {
          if (!file.endsWith('.json')) continue
          try {
            const content = await fs.readFile(join(archivePath, file), 'utf-8')
            const session = JSON.parse(content)

            const completedAt = new Date(session.completedAt).getTime()
            if (completedAt >= todayTs) {
              stats.completedToday++
              stats.todayTime += session.duration || 0
            }

            // Aggregate metrics
            if (session.metrics) {
              const sessionTs = new Date(session.completedAt).getTime()
              if (sessionTs >= weekAgoTs) {
                stats.weekCommits += session.metrics.commits || 0
                stats.weekFilesChanged += session.metrics.filesChanged || 0
              }
            }
          } catch {
            // Skip invalid files
          }
        }
      } catch {
        // No archive
      }

      // Read shipped.md for recent activity
      try {
        const shippedPath = join(projectPath, 'progress', 'shipped.md')
        const content = await fs.readFile(shippedPath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          // Match lines like "- [2024-12-08] Feature shipped"
          const match = line.match(/\[(\d{4}-\d{2}-\d{2})\]/)
          if (match) {
            const dateTs = new Date(match[1]).getTime()
            if (dateTs >= weekAgoTs) {
              // Count as activity this week
            }
          }
        }
      } catch {
        // No shipped.md
      }
    }

    return c.json({
      success: true,
      data: {
        activeSessions: stats.activeSessions,
        totalProjects: stats.totalProjects,
        today: {
          sessions: stats.todaySessions,
          completed: stats.completedToday,
          timeSeconds: stats.todayTime,
          timeFormatted: formatDuration(stats.todayTime)
        },
        week: {
          commits: stats.weekCommits,
          filesChanged: stats.weekFilesChanged
        }
      }
    })
  } catch (error) {
    console.error('Stats error:', error)
    return c.json({ success: false, error: 'Failed to get stats' }, 500)
  }
})

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return '0h'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export { app as statsRoutes }
