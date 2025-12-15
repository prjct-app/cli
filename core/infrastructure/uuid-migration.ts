/**
 * UUID Migration + Structure Migration
 *
 * Migrates:
 * 1. Project IDs from old formats (hash/timestamp) to standard UUIDs
 * 2. Old MD-First structure to new OpenCode-style JSON storage
 *
 * Old structure:
 * ~/.prjct-cli/projects/{projectId}/
 * ├── CLAUDE.md
 * ├── project.json
 * ├── core/          → now.md, next.md
 * ├── progress/      → shipped.md, sessions/
 * ├── planning/      → ideas.md, roadmap.md
 * ├── analysis/      → repo-summary.md
 * ├── memory/        → context.jsonl
 * └── agents/        → *.md
 *
 * New structure:
 * ~/.prjct-cli/projects/{projectId}/
 * ├── data/          # JSON storage (source of truth)
 * ├── context/       # Generated MD for Claude
 * └── sync/          # Sync state
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import pathManager from './path-manager'
import configManager from './config-manager'
import * as fileHelper from '../utils/file-helper'
import { generateContext } from '../context/generator'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Check if a string is a valid UUID.
 */
export function isUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

/**
 * Migration result.
 */
export interface MigrationResult {
  success: boolean
  oldId: string
  newId: string
  skipped: boolean
  error?: string
  migrated?: {
    tasks: number
    ideas: number
    features: number
    agents: number
    shipped: number
  }
}

/**
 * Check if project has old structure (needs data migration)
 */
async function hasOldStructure(globalPath: string): Promise<boolean> {
  const oldDirs = ['core', 'progress', 'planning', 'memory', 'agents', 'analysis']
  for (const dir of oldDirs) {
    try {
      await fs.access(path.join(globalPath, dir))
      return true
    } catch {
      // Continue checking
    }
  }
  // Check for root CLAUDE.md or project.json
  try {
    await fs.access(path.join(globalPath, 'CLAUDE.md'))
    return true
  } catch {
    // Continue
  }
  try {
    await fs.access(path.join(globalPath, 'project.json'))
    // Only old if data/ doesn't exist
    try {
      await fs.access(path.join(globalPath, 'data'))
      return false
    } catch {
      return true
    }
  } catch {
    return false
  }
}

/**
 * Parse now.md to extract current task
 */
function parseNowMd(content: string): { description: string; startedAt?: string } | null {
  if (!content || content.includes('No current task') || content.includes('_No active task_')) {
    return null
  }

  // Try to extract task description
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
  if (lines.length === 0) return null

  // Look for **Task:** format or just take first non-empty line
  const taskMatch = content.match(/\*\*Task:\*\*\s*(.+)/i)
  const startMatch = content.match(/\*\*Started:\*\*\s*(.+)/i)

  return {
    description: taskMatch ? taskMatch[1].trim() : lines[0].replace(/^[-*]\s*/, '').trim(),
    startedAt: startMatch ? startMatch[1].trim() : undefined
  }
}

/**
 * Parse next.md to extract queue tasks
 */
function parseNextMd(content: string): { description: string; priority?: string }[] {
  if (!content) return []

  const tasks: { description: string; priority?: string }[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    // Match numbered or bulleted items
    const match = line.match(/^[\d]+\.\s*(.+)$/) || line.match(/^[-*]\s*(.+)$/)
    if (match) {
      const text = match[1].trim()
      if (text && !text.startsWith('#') && text !== 'Priority Queue' && text !== '_Empty_') {
        // Check for priority tag [high], [medium], [low]
        const priorityMatch = text.match(/\[(high|medium|low|critical)\]/i)
        tasks.push({
          description: text.replace(/\[(high|medium|low|critical)\]/i, '').trim(),
          priority: priorityMatch ? priorityMatch[1].toLowerCase() : undefined
        })
      }
    }
  }

  return tasks
}

/**
 * Parse ideas.md to extract ideas
 */
function parseIdeasMd(content: string): { title: string; status?: string }[] {
  if (!content) return []

  const ideas: { title: string; status?: string }[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    // Match bulleted items
    const match = line.match(/^[-*]\s*(.+)$/)
    if (match) {
      const text = match[1].trim()
      if (text && !text.startsWith('#') && text !== 'Brain Dump' && text !== '_None_') {
        ideas.push({ title: text, status: 'pending' })
      }
    }
  }

  return ideas
}

/**
 * Parse roadmap.md to extract features
 */
function parseRoadmapMd(content: string): { name: string; status: string; description?: string }[] {
  if (!content) return []

  const features: { name: string; status: string; description?: string }[] = []
  const lines = content.split('\n')
  let currentStatus = 'planned'

  for (const line of lines) {
    // Detect status headers
    if (line.includes('In Progress') || line.includes('Active')) {
      currentStatus = 'in_progress'
    } else if (line.includes('Planned') || line.includes('Backlog')) {
      currentStatus = 'planned'
    } else if (line.includes('Completed') || line.includes('Done')) {
      currentStatus = 'completed'
    }

    // Match feature items
    const match = line.match(/^[-*]\s*\*\*(.+?)\*\*:?\s*(.*)$/) || line.match(/^[-*]\s*(.+)$/)
    if (match) {
      const name = match[1].trim()
      const description = match[2]?.trim()
      if (name && !name.startsWith('#') && name !== '_None_') {
        features.push({ name, status: currentStatus, description })
      }
    }
  }

  return features
}

/**
 * Parse shipped.md to extract shipped items
 */
function parseShippedMd(content: string): { name: string; date?: string }[] {
  if (!content) return []

  const shipped: { name: string; date?: string }[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    // Match items like "- Feature name (2025-12-01)" or just "- Feature name"
    const match = line.match(/^[-*]\s*(.+?)(?:\s*\((\d{4}-\d{2}-\d{2})\))?$/)
    if (match) {
      const name = match[1].trim()
      const date = match[2]
      if (name && !name.startsWith('#') && name !== '_None_') {
        shipped.push({ name, date })
      }
    }
  }

  return shipped
}

/**
 * Parse agent MD file to extract agent config
 */
function parseAgentMd(content: string, filename: string): { name: string; role?: string; domain?: string; expertise?: string[] } {
  const name = filename.replace('.md', '')

  // Try to extract role from content
  const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/i) || content.match(/^#\s*(.+)/m)
  const domainMatch = content.match(/\*\*Domain:\*\*\s*(.+)/i)
  const expertiseMatch = content.match(/\*\*Expertise:\*\*\s*(.+)/i)

  return {
    name,
    role: roleMatch ? roleMatch[1].trim() : undefined,
    domain: domainMatch ? domainMatch[1].trim() : undefined,
    expertise: expertiseMatch ? expertiseMatch[1].split(',').map(e => e.trim()) : undefined
  }
}

/**
 * Read file safely
 */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Generate short ID
 */
function generateId(): string {
  return crypto.randomUUID().split('-')[0]
}

/**
 * Migrate data from old structure to new structure
 */
async function migrateData(projectId: string, repoPath?: string): Promise<MigrationResult['migrated']> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const stats = { tasks: 0, ideas: 0, features: 0, agents: 0, shipped: 0 }
  let projectRepoPath = repoPath

  // Ensure new directories exist
  const dirs = ['data', 'data/tasks', 'data/features', 'data/ideas', 'data/sessions', 'data/shipped', 'data/agents', 'context', 'sync']
  for (const dir of dirs) {
    await fs.mkdir(path.join(globalPath, dir), { recursive: true })
  }

  // 1. Migrate project.json
  const oldProjectJson = await readFileSafe(path.join(globalPath, 'project.json'))
  if (oldProjectJson) {
    try {
      const oldData = JSON.parse(oldProjectJson)
      projectRepoPath = projectRepoPath || oldData.repoPath
      const newProjectData = {
        id: projectId,
        name: oldData.name || null,
        repoPath: oldData.repoPath || null,
        techStack: oldData.techStack?.languages || oldData.techStack || [],
        version: oldData.version || null,
        createdAt: oldData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await fs.writeFile(
        path.join(globalPath, 'data/project.json'),
        JSON.stringify(newProjectData, null, 2)
      )
    } catch {
      // Invalid JSON, create default
    }
  }

  // 2. Migrate now.md → task with status in_progress
  const nowContent = await readFileSafe(path.join(globalPath, 'core/now.md'))
  if (nowContent) {
    const task = parseNowMd(nowContent)
    if (task) {
      const taskId = generateId()
      await fs.writeFile(
        path.join(globalPath, 'data/tasks', `${taskId}.json`),
        JSON.stringify({
          id: taskId,
          description: task.description,
          status: 'in_progress',
          priority: 'high',
          startedAt: task.startedAt || new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, null, 2)
      )
      stats.tasks++
    }
  }

  // 3. Migrate next.md → tasks with status pending
  const nextContent = await readFileSafe(path.join(globalPath, 'core/next.md'))
  if (nextContent) {
    const tasks = parseNextMd(nextContent)
    for (const task of tasks) {
      const taskId = generateId()
      await fs.writeFile(
        path.join(globalPath, 'data/tasks', `${taskId}.json`),
        JSON.stringify({
          id: taskId,
          description: task.description,
          status: 'pending',
          priority: task.priority || 'medium',
          createdAt: new Date().toISOString()
        }, null, 2)
      )
      stats.tasks++
    }
  }

  // 4. Migrate ideas.md
  const ideasContent = await readFileSafe(path.join(globalPath, 'planning/ideas.md'))
  if (ideasContent) {
    const ideas = parseIdeasMd(ideasContent)
    for (const idea of ideas) {
      const ideaId = generateId()
      await fs.writeFile(
        path.join(globalPath, 'data/ideas', `${ideaId}.json`),
        JSON.stringify({
          id: ideaId,
          title: idea.title,
          status: idea.status || 'pending',
          createdAt: new Date().toISOString()
        }, null, 2)
      )
      stats.ideas++
    }
  }

  // 5. Migrate roadmap.md → features
  const roadmapContent = await readFileSafe(path.join(globalPath, 'planning/roadmap.md'))
  if (roadmapContent) {
    const features = parseRoadmapMd(roadmapContent)
    for (const feature of features) {
      const featureId = generateId()
      await fs.writeFile(
        path.join(globalPath, 'data/features', `${featureId}.json`),
        JSON.stringify({
          id: featureId,
          name: feature.name,
          status: feature.status,
          description: feature.description,
          createdAt: new Date().toISOString()
        }, null, 2)
      )
      stats.features++
    }
  }

  // 6. Migrate shipped.md
  const shippedContent = await readFileSafe(path.join(globalPath, 'progress/shipped.md'))
  if (shippedContent) {
    const shipped = parseShippedMd(shippedContent)
    for (const item of shipped) {
      const shipId = generateId()
      await fs.writeFile(
        path.join(globalPath, 'data/shipped', `${shipId}.json`),
        JSON.stringify({
          id: shipId,
          name: item.name,
          shippedAt: item.date || new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, null, 2)
      )
      stats.shipped++
    }
  }

  // 7. Migrate agents/*.md
  try {
    const agentsDir = path.join(globalPath, 'agents')
    const agentFiles = await fs.readdir(agentsDir)
    for (const file of agentFiles) {
      if (file.endsWith('.md')) {
        const content = await readFileSafe(path.join(agentsDir, file))
        if (content) {
          const agent = parseAgentMd(content, file)
          await fs.writeFile(
            path.join(globalPath, 'data/agents', `${agent.name}.json`),
            JSON.stringify({
              name: agent.name,
              role: agent.role,
              domain: agent.domain,
              expertise: agent.expertise,
              createdAt: new Date().toISOString()
            }, null, 2)
          )
          stats.agents++
        }
      }
    }
  } catch {
    // agents dir doesn't exist
  }

  // 8. Create indexes
  const taskFiles = await fs.readdir(path.join(globalPath, 'data/tasks')).catch(() => [])
  const taskIds = taskFiles.filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.replace('.json', ''))
  await fs.writeFile(
    path.join(globalPath, 'data/tasks/index.json'),
    JSON.stringify({ ids: taskIds, updatedAt: new Date().toISOString() }, null, 2)
  )

  const ideaFiles = await fs.readdir(path.join(globalPath, 'data/ideas')).catch(() => [])
  const ideaIds = ideaFiles.filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.replace('.json', ''))
  await fs.writeFile(
    path.join(globalPath, 'data/ideas/index.json'),
    JSON.stringify({ ids: ideaIds, updatedAt: new Date().toISOString() }, null, 2)
  )

  const featureFiles = await fs.readdir(path.join(globalPath, 'data/features')).catch(() => [])
  const featureIds = featureFiles.filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.replace('.json', ''))
  await fs.writeFile(
    path.join(globalPath, 'data/features/index.json'),
    JSON.stringify({ ids: featureIds, updatedAt: new Date().toISOString() }, null, 2)
  )

  // 9. Create sync files
  await fs.writeFile(path.join(globalPath, 'sync/pending.json'), '[]')
  await fs.writeFile(
    path.join(globalPath, 'sync/last-sync.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), success: true }, null, 2)
  )
  await fs.writeFile(path.join(globalPath, 'sync/conflict-log.json'), '[]')

  // 10. Generate context from repo (REAL DATA, not placeholders)
  // NOTE: Agents are NOT generated here - that's AGENTIC (Claude decides in /p:sync)
  if (projectRepoPath) {
    try {
      await generateContext(projectId, projectRepoPath)
    } catch (err) {
      // If context generation fails, create placeholders
      console.error('Context generation failed:', (err as Error).message)
      await fs.writeFile(path.join(globalPath, 'context/CLAUDE.md'), '# Project Context\n\n_Run /p:sync to generate._\n')
      await fs.writeFile(path.join(globalPath, 'context/now.md'), '# NOW\n\n_No active task._\n')
      await fs.writeFile(path.join(globalPath, 'context/queue.md'), '# QUEUE\n\n_Empty queue._\n')
      await fs.writeFile(path.join(globalPath, 'context/summary.md'), '# SUMMARY\n\n_Run /p:sync to generate._\n')
    }
  } else {
    // No repoPath, create placeholders
    await fs.writeFile(path.join(globalPath, 'context/CLAUDE.md'), '# Project Context\n\n_Run /p:sync to generate._\n')
    await fs.writeFile(path.join(globalPath, 'context/now.md'), '# NOW\n\n_No active task._\n')
    await fs.writeFile(path.join(globalPath, 'context/queue.md'), '# QUEUE\n\n_Empty queue._\n')
    await fs.writeFile(path.join(globalPath, 'context/summary.md'), '# SUMMARY\n\n_Run /p:sync to generate._\n')
  }

  return stats
}

/**
 * Move old directories to .trash
 */
async function moveToTrash(projectId: string): Promise<void> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const trashPath = path.join(globalPath, '.trash')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  // Create trash directory
  await fs.mkdir(path.join(trashPath, timestamp), { recursive: true })

  // Move old items to trash
  const oldItems = ['core', 'progress', 'planning', 'analysis', 'memory', 'agents', 'sessions', 'state', 'CLAUDE.md', 'project.json']

  for (const item of oldItems) {
    const oldPath = path.join(globalPath, item)
    const newPath = path.join(trashPath, timestamp, item)

    try {
      await fs.access(oldPath)
      await fs.rename(oldPath, newPath)
    } catch {
      // Doesn't exist, skip
    }
  }
}

/**
 * Migrate a project's ID to UUID format.
 */
export async function migrateProjectToUUID(projectPath: string): Promise<MigrationResult> {
  const config = await configManager.readConfig(projectPath)
  if (!config) {
    return {
      success: false,
      oldId: '',
      newId: '',
      skipped: false,
      error: 'Project not initialized'
    }
  }

  const oldId = config.projectId

  // Already UUID - skip UUID migration but check structure
  if (isUUID(oldId)) {
    return { success: true, oldId, newId: oldId, skipped: true }
  }

  const newId = crypto.randomUUID()

  try {
    // Rename global folder
    const oldPath = pathManager.getGlobalProjectPath(oldId)
    const newPath = pathManager.getGlobalProjectPath(newId)

    try {
      await fs.access(oldPath)
    } catch {
      return {
        success: false,
        oldId,
        newId,
        skipped: false,
        error: `Global folder not found: ${oldPath}`
      }
    }

    try {
      await fs.access(newPath)
      return {
        success: false,
        oldId,
        newId,
        skipped: false,
        error: `Target folder already exists: ${newPath}`
      }
    } catch {
      // Good - new path doesn't exist
    }

    await fs.rename(oldPath, newPath)

    // Update local config
    config.projectId = newId
    config.dataPath = pathManager.getDisplayPath(newPath)
    await configManager.writeConfig(projectPath, config)

    // Update global project.json if exists
    const projectJsonPath = path.join(newPath, 'project.json')
    try {
      const content = await fs.readFile(projectJsonPath, 'utf-8')
      const updated = content.replace(new RegExp(oldId, 'g'), newId)
      await fs.writeFile(projectJsonPath, updated)
    } catch {
      // project.json may not exist
    }

    return { success: true, oldId, newId, skipped: false }
  } catch (error) {
    return {
      success: false,
      oldId,
      newId,
      skipped: false,
      error: (error as Error).message
    }
  }
}

/**
 * Check if a project needs UUID migration.
 */
export async function needsUUIDMigration(projectPath: string): Promise<boolean> {
  const config = await configManager.readConfig(projectPath)
  if (!config) return false
  return !isUUID(config.projectId)
}

/**
 * Check if a project needs structure migration.
 */
export async function needsStructureMigration(projectId: string): Promise<boolean> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  return await hasOldStructure(globalPath)
}

/**
 * Ensure new structure exists (without migrating data).
 * Creates directories and default files if missing.
 */
export async function ensureCompleteStructure(projectId: string): Promise<void> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)

  // Create directories
  const dirs = ['data', 'data/tasks', 'data/features', 'data/ideas', 'data/sessions', 'data/shipped', 'data/agents', 'context', 'sync']
  for (const dir of dirs) {
    await fs.mkdir(path.join(globalPath, dir), { recursive: true })
  }

  // Create default files only if they don't exist
  const defaults: Record<string, string> = {
    'data/project.json': JSON.stringify({
      id: projectId,
      name: null,
      repoPath: null,
      techStack: [],
      version: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, null, 2),
    'data/tasks/index.json': JSON.stringify({ ids: [], updatedAt: new Date().toISOString() }, null, 2),
    'data/features/index.json': JSON.stringify({ ids: [], updatedAt: new Date().toISOString() }, null, 2),
    'data/ideas/index.json': JSON.stringify({ ids: [], updatedAt: new Date().toISOString() }, null, 2),
    'sync/pending.json': '[]',
    'sync/last-sync.json': JSON.stringify({ timestamp: null, success: false }, null, 2),
    'sync/conflict-log.json': '[]',
    'context/CLAUDE.md': '# Project Context\n\n_Run /p:sync to generate._\n',
    'context/now.md': '# NOW\n\n_No active task._\n',
    'context/queue.md': '# QUEUE\n\n_Empty queue._\n',
    'context/summary.md': '# SUMMARY\n\n_Run /p:sync to generate._\n'
  }

  for (const [filePath, content] of Object.entries(defaults)) {
    const fullPath = path.join(globalPath, filePath)
    try {
      await fs.access(fullPath)
    } catch {
      await fs.writeFile(fullPath, content)
    }
  }
}

/**
 * Full migration: UUID + data migration + move to trash
 *
 * 1. UUID migration (if needed)
 * 2. Data migration from old MD files to new JSON structure
 * 3. Move old directories to .trash/
 */
export async function fullMigration(projectPath: string): Promise<MigrationResult> {
  // 1. UUID Migration
  const result = await migrateProjectToUUID(projectPath)

  if (!result.success) {
    return result
  }

  const projectId = result.newId

  // 2. Check if needs structure migration
  const needsMigration = await needsStructureMigration(projectId)

  if (needsMigration) {
    // 3. Migrate data from old to new structure
    const migrated = await migrateData(projectId)
    result.migrated = migrated

    // 4. Move old directories to .trash
    await moveToTrash(projectId)
  } else {
    // Just ensure structure exists
    await ensureCompleteStructure(projectId)
  }

  return result
}

/**
 * Migrate all projects in ~/.prjct-cli/projects/
 */
export async function migrateAllProjects(): Promise<{ success: number; failed: number; skipped: number }> {
  const projectsDir = path.join(os.homedir(), '.prjct-cli/projects')
  const stats = { success: 0, failed: 0, skipped: 0 }

  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const projectId = entry.name
      const globalPath = path.join(projectsDir, projectId)

      // Check if needs migration
      const needsMigration = await hasOldStructure(globalPath)

      if (!needsMigration) {
        stats.skipped++
        continue
      }

      try {
        // Get repoPath from old project.json before migration
        let repoPath: string | undefined
        try {
          const oldProjectJson = await fs.readFile(path.join(globalPath, 'project.json'), 'utf-8')
          const oldData = JSON.parse(oldProjectJson)
          repoPath = oldData.repoPath
        } catch {
          // No project.json or invalid
        }

        // Migrate data (with repoPath for context generation)
        await migrateData(projectId, repoPath)
        // Move to trash
        await moveToTrash(projectId)
        stats.success++
      } catch (error) {
        console.error(`Failed to migrate ${projectId}:`, (error as Error).message)
        stats.failed++
      }
    }
  } catch {
    // projects dir doesn't exist
  }

  return stats
}

export default {
  isUUID,
  migrateProjectToUUID,
  needsUUIDMigration,
  needsStructureMigration,
  ensureCompleteStructure,
  fullMigration,
  migrateAllProjects
}
