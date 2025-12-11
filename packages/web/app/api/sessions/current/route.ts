import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export const dynamic = 'force-dynamic'

interface Session {
  id: string
  projectId?: string
  task: string
  status: string
  startedAt: string
  timeline?: Array<{ type: string; at: string }>
  context?: {
    prompt?: string
    promptLength?: number
    files?: string[]
  }
}

interface AbandonedSession {
  id: string
  task: string
  projectId: string
  projectName?: string
  startedAt: string
  lastActivity?: string
  hoursAgo: number
  prompt?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const targetProjectId = searchParams.get('projectId')

    const globalStorage = join(homedir(), '.prjct-cli', 'projects')

    let projects: string[]
    try {
      projects = await fs.readdir(globalStorage)
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          currentSession: null,
          abandonedSessions: []
        }
      })
    }

    const abandonedSessions: AbandonedSession[] = []
    let currentSession: Session | null = null

    const now = Date.now()
    const ABANDON_THRESHOLD_HOURS = 8

    for (const projectId of projects) {
      // Skip hidden directories
      if (projectId.startsWith('.')) continue

      const sessionPath = join(globalStorage, projectId, 'sessions', 'current.json')

      try {
        const content = await fs.readFile(sessionPath, 'utf-8')
        if (!content.trim()) continue

        const session: Session = JSON.parse(content)

        // Skip if not active
        if (session.status !== 'active') continue

        // Get last activity timestamp
        const lastActivity = session.timeline?.[session.timeline.length - 1]?.at || session.startedAt
        const lastActivityDate = new Date(lastActivity)
        if (isNaN(lastActivityDate.getTime())) continue

        const hoursAgo = (now - lastActivityDate.getTime()) / (1000 * 60 * 60)

        // If this is the target project and session is recent, it's the current session
        if (projectId === targetProjectId && hoursAgo < ABANDON_THRESHOLD_HOURS) {
          currentSession = session
        }
        // If session is old (>8 hours), it's considered abandoned
        else if (hoursAgo >= ABANDON_THRESHOLD_HOURS) {
          // Try to get project name from project.json
          let projectName: string | undefined
          try {
            const projectJsonPath = join(globalStorage, projectId, 'project.json')
            const projectJson = await fs.readFile(projectJsonPath, 'utf-8')
            const projectData = JSON.parse(projectJson)
            projectName = projectData.name
          } catch {
            // Ignore - project name is optional
          }

          abandonedSessions.push({
            id: session.id,
            task: session.task,
            projectId,
            projectName,
            startedAt: session.startedAt,
            lastActivity,
            hoursAgo: Math.round(hoursAgo),
            prompt: session.context?.prompt
          })
        }
      } catch {
        // Skip projects without valid session files
      }
    }

    // Sort abandoned sessions by most recent first
    abandonedSessions.sort((a, b) => a.hoursAgo - b.hoursAgo)

    return NextResponse.json({
      success: true,
      data: {
        currentSession,
        abandonedSessions
      }
    })
  } catch (error) {
    console.error('Sessions current error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
