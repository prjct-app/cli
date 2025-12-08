/**
 * Project Routes
 */

import { Hono } from 'hono'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const app = new Hono()

const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

// Cache for project paths (projectId -> real path)
const projectPathCache = new Map<string, string>()

/**
 * Scan common directories for .prjct/prjct.config.json files
 */
async function scanForProjects(): Promise<Map<string, string>> {
  const searchPaths = [
    join(homedir(), 'Apps'),
    join(homedir(), 'Projects'),
    join(homedir(), 'Documents'),
    join(homedir(), 'Development'),
    join(homedir(), 'Code'),
    join(homedir(), 'dev'),
  ]

  for (const searchPath of searchPaths) {
    try {
      // Use find to locate .prjct directories
      const { stdout } = await execAsync(
        `find "${searchPath}" -maxdepth 4 -type f -name "prjct.config.json" -path "*/.prjct/*" 2>/dev/null`,
        { timeout: 5000 }
      )

      const configFiles = stdout.trim().split('\n').filter(Boolean)

      for (const configFile of configFiles) {
        try {
          const content = await fs.readFile(configFile, 'utf-8')
          const config = JSON.parse(content)
          if (config.projectId) {
            // The project path is the parent of .prjct directory
            const projectPath = dirname(dirname(configFile))
            projectPathCache.set(config.projectId, projectPath)
          }
        } catch {
          // Skip invalid config files
        }
      }
    } catch {
      // Skip directories that don't exist or are not accessible
    }
  }

  return projectPathCache
}

// Initial scan (run once at startup)
scanForProjects().catch(console.error)

/**
 * Extract project path from CLAUDE.md
 */
function extractProjectPath(claudeMd: string): string | null {
  // Look for "Path: /path/to/project" or similar patterns
  const pathMatch = claudeMd.match(/(?:Path|Location|Directory):\s*`?([^\n`]+)`?/i)
  if (pathMatch) return pathMatch[1].trim()

  // Look for path in project info section
  const infoMatch = claudeMd.match(/\*\*Path\*\*:\s*`?([^\n`]+)`?/i)
  if (infoMatch) return infoMatch[1].trim()

  return null
}

/**
 * GET /api/projects - List all projects
 */
app.get('/', async (c) => {
  try {
    // Refresh scan if cache is empty
    if (projectPathCache.size === 0) {
      await scanForProjects()
    }

    const projects = []
    const dirs = await fs.readdir(GLOBAL_STORAGE)

    for (const projectId of dirs) {
      const configPath = join(GLOBAL_STORAGE, projectId, 'CLAUDE.md')
      try {
        await fs.access(configPath)
        const claudeMd = await fs.readFile(configPath, 'utf-8')

        // Extract project name from CLAUDE.md
        const nameMatch = claudeMd.match(/# (.+) - Project Context/)
        const name = nameMatch ? nameMatch[1] : projectId

        // Get real project path from cache or CLAUDE.md
        const cachedPath = projectPathCache.get(projectId)
        const realPath = cachedPath || extractProjectPath(claudeMd)

        projects.push({
          id: projectId,
          name,
          path: realPath || join(GLOBAL_STORAGE, projectId),
          storagePath: join(GLOBAL_STORAGE, projectId)
        })
      } catch {
        // Skip invalid projects
      }
    }

    return c.json({ success: true, data: projects })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to list projects' }, 500)
  }
})

/**
 * GET /api/projects/:id - Get project details
 */
app.get('/:id', async (c) => {
  const projectId = c.req.param('id')
  const storagePath = join(GLOBAL_STORAGE, projectId)

  try {
    // Read CLAUDE.md for context
    const claudeMd = await fs.readFile(join(storagePath, 'CLAUDE.md'), 'utf-8')

    // Get real project path from cache or CLAUDE.md
    const cachedPath = projectPathCache.get(projectId)
    const realPath = cachedPath || extractProjectPath(claudeMd)

    // Extract project name
    const nameMatch = claudeMd.match(/# (.+) - Project Context/)
    const name = nameMatch ? nameMatch[1] : projectId

    // Read current session if exists
    let currentSession = null
    try {
      const sessionPath = join(storagePath, 'sessions', 'current.json')
      const sessionData = await fs.readFile(sessionPath, 'utf-8')
      currentSession = JSON.parse(sessionData)
    } catch {
      // No current session
    }

    // Read now.md
    let currentTask = null
    try {
      const nowPath = join(storagePath, 'core', 'now.md')
      currentTask = await fs.readFile(nowPath, 'utf-8')
    } catch {
      // No current task
    }

    return c.json({
      success: true,
      data: {
        id: projectId,
        name,
        path: realPath || storagePath,
        storagePath,
        claudeMd,
        currentSession,
        currentTask
      }
    })
  } catch (error) {
    return c.json({ success: false, error: 'Project not found' }, 404)
  }
})

/**
 * GET /api/projects/:id/status - Get project status
 */
app.get('/:id/status', async (c) => {
  const projectId = c.req.param('id')
  const projectPath = join(GLOBAL_STORAGE, projectId)

  try {
    // Current session
    let session = null
    try {
      const sessionPath = join(projectPath, 'sessions', 'current.json')
      session = JSON.parse(await fs.readFile(sessionPath, 'utf-8'))
    } catch {}

    // Recent ideas
    let ideas: string[] = []
    try {
      const ideasPath = join(projectPath, 'planning', 'ideas.md')
      const content = await fs.readFile(ideasPath, 'utf-8')
      ideas = content.split('\n').filter(l => l.startsWith('- ')).slice(0, 5)
    } catch {}

    // Next tasks
    let nextTasks: string[] = []
    try {
      const nextPath = join(projectPath, 'core', 'next.md')
      const content = await fs.readFile(nextPath, 'utf-8')
      nextTasks = content.split('\n').filter(l => l.startsWith('- ')).slice(0, 5)
    } catch {}

    return c.json({
      success: true,
      data: {
        projectId,
        session,
        hasActiveSession: session?.status === 'active',
        ideas,
        nextTasks
      }
    })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get status' }, 500)
  }
})

export { app as projectRoutes }
