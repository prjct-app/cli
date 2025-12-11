/**
 * Project utilities for prjct
 */

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')
export const TRASH_PATH = join(homedir(), '.prjct-cli', '.trash')

// Cache for project paths (projectId -> real path)
const projectPathCache = new Map<string, string>()

/**
 * Scan common directories for .prjct/prjct.config.json files
 */
export async function scanForProjects(): Promise<Map<string, string>> {
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

/**
 * Extract project path from CLAUDE.md
 */
export function extractProjectPath(claudeMd: string): string | null {
  const pathMatch = claudeMd.match(/(?:Path|Location|Directory):\s*`?([^\n`]+)`?/i)
  if (pathMatch) return pathMatch[1].trim()

  const infoMatch = claudeMd.match(/\*\*Path\*\*:\s*`?([^\n`]+)`?/i)
  if (infoMatch) return infoMatch[1].trim()

  return null
}

/**
 * Get all projects with rich metadata
 */
export async function getProjects() {
  if (projectPathCache.size === 0) {
    await scanForProjects()
  }

  const projects = []

  try {
    const dirs = await fs.readdir(GLOBAL_STORAGE)

    for (const projectId of dirs) {
      // Skip hidden directories like .trash
      if (projectId.startsWith('.')) continue

      const storagePath = join(GLOBAL_STORAGE, projectId)

      // Try project.json first (source of truth)
      let name: string = projectId
      let repoPath: string | null = null
      let techStack: string[] = []

      try {
        const projectJsonPath = join(storagePath, 'project.json')
        const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
        name = projectJson.name || projectId
        repoPath = projectJson.repoPath || null
        techStack = projectJson.techStack || []
      } catch {
        // Fallback to CLAUDE.md for name/repoPath only
        // techStack comes from project.json (populated by /p:sync)
        try {
          const claudeMd = await fs.readFile(join(storagePath, 'CLAUDE.md'), 'utf-8')
          const nameMatch = claudeMd.match(/# (.+) - Project Context/)
          if (nameMatch) name = nameMatch[1]

          const cachedPath = projectPathCache.get(projectId)
          repoPath = cachedPath || extractProjectPath(claudeMd)
        } catch {
          // Skip projects without valid config
          continue
        }
      }

      // Get current task
      let currentTask: string | null = null
      try {
        const nowContent = await fs.readFile(join(storagePath, 'core', 'now.md'), 'utf-8')
        // Skip headers like "# NOW", "# Current Task" and find the actual task content
        // Look for **bold text** (task description) or first non-header, non-metadata line
        const boldMatch = nowContent.match(/\*\*([^*]+)\*\*/)
        if (boldMatch && boldMatch[1].trim() && !boldMatch[1].includes(':')) {
          currentTask = boldMatch[1].trim()
        } else {
          // Find first content line that's not a header, metadata, or empty
          const lines = nowContent.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            // Skip headers, empty lines, metadata lines (key: value), and "No active/current task" messages
            if (trimmed &&
                !trimmed.startsWith('#') &&
                !trimmed.toLowerCase().includes('no active task') &&
                !trimmed.toLowerCase().includes('no current task') &&
                !trimmed.match(/^(Feature|Started|Status|Agent):/i) &&
                !trimmed.startsWith('**') &&
                !trimmed.startsWith('-')) {
              currentTask = trimmed
              break
            }
          }
        }
        // Truncate if too long
        if (currentTask && currentTask.length > 60) {
          currentTask = currentTask.substring(0, 57) + '...'
        }
      } catch {}

      // Get session status and last activity
      let hasActiveSession = false
      let lastActivity: string | null = null

      // Try current session first
      try {
        const sessionPath = join(storagePath, 'sessions', 'current.json')
        const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'))
        hasActiveSession = sessionData.status === 'active'
        lastActivity = sessionData.startedAt || sessionData.updatedAt
      } catch {}

      // If no session, get last modified time from key files
      if (!lastActivity) {
        const filesToCheck = [
          join(storagePath, 'core', 'now.md'),
          join(storagePath, 'core', 'next.md'),
          join(storagePath, 'planning', 'ideas.md'),
          join(storagePath, 'progress', 'shipped.md'),
          join(storagePath, 'memory', 'context.jsonl'),
          join(storagePath, 'CLAUDE.md')
        ]

        let latestMtime = 0
        for (const filePath of filesToCheck) {
          try {
            const stat = await fs.stat(filePath)
            if (stat.mtimeMs > latestMtime) {
              latestMtime = stat.mtimeMs
            }
          } catch {}
        }

        if (latestMtime > 0) {
          lastActivity = new Date(latestMtime).toISOString()
        }
      }

      // Count ideas and next tasks
      let ideasCount = 0
      let nextTasksCount = 0
      try {
        const ideasContent = await fs.readFile(join(storagePath, 'planning', 'ideas.md'), 'utf-8')
        ideasCount = (ideasContent.match(/^- /gm) || []).length
      } catch {}
      try {
        const nextContent = await fs.readFile(join(storagePath, 'core', 'next.md'), 'utf-8')
        nextTasksCount = (nextContent.match(/^- /gm) || []).length
      } catch {}

      // Find favicon/icon in project repo
      let iconPath: string | null = null
      if (repoPath) {
        const iconPatterns = [
          'public/favicon.ico',
          'public/favicon.svg',
          'public/icon.svg',
          'public/icon.png',
          'public/logo.svg',
          'public/logo.png',
          'app/favicon.ico',
          'app/icon.svg',
          'app/icon.png',
          'favicon.ico',
          'favicon.svg'
        ]
        for (const pattern of iconPatterns) {
          try {
            const fullPath = join(repoPath, pattern)
            await fs.access(fullPath)
            iconPath = fullPath
            break
          } catch {}
        }
      }

      projects.push({
        id: projectId,
        name,
        path: repoPath || storagePath,
        repoPath,
        storagePath,
        currentTask,
        hasActiveSession,
        lastActivity,
        ideasCount,
        nextTasksCount,
        techStack,
        iconPath
      })
    }
  } catch {
    // Storage directory doesn't exist
  }

  // Sort by lastActivity (most recent first), then by name
  projects.sort((a, b) => {
    if (a.lastActivity && b.lastActivity) {
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    }
    if (a.lastActivity) return -1
    if (b.lastActivity) return 1
    return a.name.localeCompare(b.name)
  })

  return projects
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string) {
  const storagePath = join(GLOBAL_STORAGE, projectId)

  // 1. Try to read from project.json (source of truth for dashboard)
  let repoPath: string | null = null
  let name: string = projectId
  let version: string | null = null
  let stack: string | null = null
  let filesCount: string | null = null
  let commitsCount: string | null = null
  let techStack: string[] = []

  try {
    const projectJsonPath = join(storagePath, 'project.json')
    const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
    repoPath = projectJson.repoPath || null
    name = projectJson.name || projectId
    version = projectJson.version || null
    stack = projectJson.stack || null
    filesCount = projectJson.fileCount ? String(projectJson.fileCount) : null
    commitsCount = projectJson.commitCount ? String(projectJson.commitCount) : null
    techStack = projectJson.techStack || []
  } catch {
    // project.json doesn't exist - fallback to scan
    if (projectPathCache.size === 0) {
      await scanForProjects()
    }
    repoPath = projectPathCache.get(projectId) || null
  }

  try {
    const claudeMd = await fs.readFile(join(storagePath, 'CLAUDE.md'), 'utf-8')

    // If still no repoPath, try extracting from CLAUDE.md
    if (!repoPath) {
      repoPath = extractProjectPath(claudeMd)
    }

    // If name is still projectId, try CLAUDE.md
    if (name === projectId) {
      const nameMatch = claudeMd.match(/# (.+) - Project Context/)
      if (nameMatch) name = nameMatch[1]
    }

    let currentSession = null
    try {
      const sessionPath = join(storagePath, 'sessions', 'current.json')
      const sessionData = await fs.readFile(sessionPath, 'utf-8')
      currentSession = JSON.parse(sessionData)
    } catch {}

    let currentTask = null
    try {
      const nowPath = join(storagePath, 'core', 'now.md')
      currentTask = await fs.readFile(nowPath, 'utf-8')
    } catch {}

    // Fallback: Extract stats from claudeMd Quick Reference table if not from project.json
    if (!version) {
      const versionMatch = claudeMd.match(/\*\*Version\*\*\s*\|\s*([^\n|]+)/)
      if (versionMatch) version = versionMatch[1].trim()
    }

    if (!stack) {
      const stackMatch = claudeMd.match(/\*\*Stack\*\*\s*\|\s*([^\n|]+)/)
      if (stackMatch) stack = stackMatch[1].trim()
    }

    if (!filesCount) {
      const filesMatch = claudeMd.match(/\*\*Files\*\*\s*\|\s*([^\n|]+)/)
      if (filesMatch) filesCount = filesMatch[1].trim()
    }

    if (!commitsCount) {
      const commitsMatch = claudeMd.match(/\*\*Commits\*\*\s*\|\s*([^\n|]+)/)
      if (commitsMatch) commitsCount = commitsMatch[1].trim()
    }

    // Find favicon/icon in project repo
    let iconPath: string | null = null
    if (repoPath) {
      const iconPatterns = [
        'public/favicon.ico',
        'public/favicon.svg',
        'public/icon.svg',
        'public/icon.png',
        'public/logo.svg',
        'public/logo.png',
        'app/favicon.ico',
        'app/icon.svg',
        'app/icon.png',
        'favicon.ico',
        'favicon.svg'
      ]
      for (const pattern of iconPatterns) {
        try {
          const fullPath = join(repoPath, pattern)
          await fs.access(fullPath)
          iconPath = fullPath
          break
        } catch {}
      }
    }

    return {
      id: projectId,
      name,
      path: storagePath, // Storage path (for prjct data)
      repoPath, // Real repository path (for terminal/Claude)
      storagePath,
      claudeMd,
      currentSession,
      currentTask,
      // Parsed stats
      version,
      stack,
      filesCount,
      commitsCount,
      techStack,
      iconPath
    }
  } catch {
    return null
  }
}

/**
 * Move project to trash (soft delete)
 */
export async function moveToTrash(projectId: string) {
  const sourcePath = join(GLOBAL_STORAGE, projectId)
  const trashPath = join(TRASH_PATH, projectId)

  // Verify source exists
  try {
    await fs.access(sourcePath)
  } catch {
    throw new Error(`Project ${projectId} not found`)
  }

  // Create trash directory if it doesn't exist
  await fs.mkdir(TRASH_PATH, { recursive: true })

  // Move to trash
  await fs.rename(sourcePath, trashPath)

  // Write deletion metadata
  const deletedAt = new Date().toISOString()
  await fs.writeFile(
    join(trashPath, '.deleted'),
    JSON.stringify({ deletedAt, projectId })
  )

  return { trashedAt: deletedAt }
}

/**
 * Get project status
 */
export async function getProjectStatus(projectId: string) {
  const projectPath = join(GLOBAL_STORAGE, projectId)

  let session = null
  try {
    const sessionPath = join(projectPath, 'sessions', 'current.json')
    session = JSON.parse(await fs.readFile(sessionPath, 'utf-8'))
  } catch {}

  let ideas: string[] = []
  try {
    const ideasPath = join(projectPath, 'planning', 'ideas.md')
    const content = await fs.readFile(ideasPath, 'utf-8')
    ideas = content.split('\n').filter(l => l.startsWith('- ')).slice(0, 5)
  } catch {}

  let nextTasks: string[] = []
  try {
    const nextPath = join(projectPath, 'core', 'next.md')
    const content = await fs.readFile(nextPath, 'utf-8')
    nextTasks = content.split('\n').filter(l => l.startsWith('- ')).slice(0, 5)
  } catch {}

  return {
    projectId,
    session,
    hasActiveSession: session?.status === 'active',
    ideas,
    nextTasks
  }
}
