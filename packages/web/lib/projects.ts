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
 * Get all projects
 */
export async function getProjects() {
  if (projectPathCache.size === 0) {
    await scanForProjects()
  }

  const projects = []

  try {
    const dirs = await fs.readdir(GLOBAL_STORAGE)

    for (const projectId of dirs) {
      const storagePath = join(GLOBAL_STORAGE, projectId)

      // Try project.json first (source of truth)
      let name: string = projectId
      let repoPath: string | null = null

      try {
        const projectJsonPath = join(storagePath, 'project.json')
        const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
        name = projectJson.name || projectId
        repoPath = projectJson.repoPath || null
      } catch {
        // Fallback to CLAUDE.md
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

      projects.push({
        id: projectId,
        name,
        path: repoPath || storagePath,
        repoPath,
        storagePath
      })
    }
  } catch {
    // Storage directory doesn't exist
  }

  return projects
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string) {
  const storagePath = join(GLOBAL_STORAGE, projectId)

  // 1. Try to read from project.json (source of truth)
  let repoPath: string | null = null
  let name: string = projectId

  try {
    const projectJsonPath = join(storagePath, 'project.json')
    const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
    repoPath = projectJson.repoPath || null
    name = projectJson.name || projectId
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

    return {
      id: projectId,
      name,
      path: storagePath, // Storage path (for prjct data)
      repoPath, // Real repository path (for terminal/Claude)
      storagePath,
      claudeMd,
      currentSession,
      currentTask
    }
  } catch {
    return null
  }
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
