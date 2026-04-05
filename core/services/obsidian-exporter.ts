/**
 * Obsidian Exporter Service
 *
 * Exports prjct project data as Obsidian-compatible markdown files
 * with YAML frontmatter. Supports:
 * - Board (Kanban): active tasks as cards
 * - Queue: backlog/priority queue
 * - Shipped: delivered features
 * - Roadmap: features + Canvas
 * - Daily: standup notes
 *
 * All files go under vault/projects/{projectFolder}/.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { RoadmapJson } from '../schemas/roadmap'
import type { QueueJson, StateJson } from '../schemas/state'
import { prjctDb } from '../storage/database'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import type { ObsidianConfig } from '../types/integrations'
import { mdObsidianNote, mdTable } from '../utils/md-formatter'

// =============================================================================
// Types
// =============================================================================

export interface ExportResult {
  success: boolean
  projectFolder: string
  exported: {
    board: number
    queue: number
    shipped: number
    roadmap: number
    daily: boolean
  }
  errors: string[]
}

// =============================================================================
// Obsidian Exporter
// =============================================================================

class ObsidianExporter {
  /**
   * Get the project folder path inside the vault
   */
  getProjectPath(config: ObsidianConfig, projectName: string): string {
    const folder = config.projectFolder || projectName
    return path.join(config.vaultPath, 'projects', folder)
  }

  /**
   * Export all project data to Obsidian vault
   */
  async exportAll(
    projectId: string,
    projectName: string,
    config: ObsidianConfig
  ): Promise<ExportResult> {
    const projectPath = this.getProjectPath(config, projectName)
    const errors: string[] = []
    const result: ExportResult = {
      success: true,
      projectFolder: projectPath,
      exported: { board: 0, queue: 0, shipped: 0, roadmap: 0, daily: false },
      errors,
    }

    // Ensure directory structure
    await this.ensureStructure(projectPath)

    // Export each section, collecting errors
    try {
      result.exported.board = await this.exportBoard(projectId, projectPath)
    } catch (e) {
      errors.push(`board: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
      result.exported.queue = await this.exportQueue(projectId, projectPath)
    } catch (e) {
      errors.push(`queue: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
      result.exported.shipped = await this.exportShipped(projectId, projectPath)
    } catch (e) {
      errors.push(`shipped: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
      result.exported.roadmap = await this.exportRoadmap(projectId, projectPath)
    } catch (e) {
      errors.push(`roadmap: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
      result.exported.daily = await this.exportDaily(projectId, projectPath)
    } catch (e) {
      errors.push(`daily: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Generate dashboard index
    try {
      await this.exportIndex(projectName, projectPath)
    } catch (e) {
      errors.push(`index: ${e instanceof Error ? e.message : String(e)}`)
    }

    result.success = errors.length === 0
    return result
  }

  /**
   * Create vault directory structure
   */
  async ensureStructure(projectPath: string): Promise<void> {
    const dirs = [
      'board',
      'queue',
      'shipped',
      'roadmap',
      'architecture',
      'design',
      'research',
      'meetings',
      'notes',
      'daily',
      'retros',
    ]
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true })
    }
  }

  /**
   * Write the .prjct-link.yml file
   */
  async writeLink(projectPath: string, projectId: string, sourcePath: string): Promise<void> {
    const content = [
      `projectId: ${projectId}`,
      `projectPath: ${sourcePath}`,
      `linkedAt: ${new Date().toISOString()}`,
    ].join('\n')
    await fs.writeFile(path.join(projectPath, '.prjct-link.yml'), content, 'utf-8')
  }

  // ===========================================================================
  // Board (Kanban)
  // ===========================================================================

  async exportBoard(projectId: string, projectPath: string): Promise<number> {
    const state: StateJson = await stateStorage.read(projectId)
    const boardDir = path.join(projectPath, 'board')
    let count = 0

    // Export current task
    if (state.currentTask) {
      const task = state.currentTask
      const subtasks = (task.subtasks || []) as Array<{ description: string; status: string }>
      const currentIdx = task.currentSubtaskIndex ?? 0

      const frontmatter: Record<string, unknown> = {
        prjct_id: task.id,
        prjct_type: 'task',
        status: 'in_progress',
        type: task.type || 'feature',
        description: task.description,
        branch: task.branch,
        linear_id: task.linearId,
        estimated_points: task.estimatedPoints,
        started_at: task.startedAt,
        updated_at: new Date().toISOString(),
      }

      const subtaskLines = subtasks.map((s, i) => {
        const checked = s.status === 'completed' ? 'x' : ' '
        const current = i === currentIdx && s.status !== 'completed' ? ' <- current' : ''
        return `- [${checked}] ${s.description}${current}`
      })

      const completed = subtasks.filter((s) => s.status === 'completed').length
      const progress =
        subtasks.length > 0
          ? `${completed}/${subtasks.length} (${Math.round((completed / subtasks.length) * 100)}%)`
          : ''

      const content = mdObsidianNote(
        frontmatter,
        task.description,
        subtaskLines.length > 0 ? `## Subtasks\n${subtaskLines.join('\n')}` : null,
        progress ? `## Progress\n${progress}` : null
      )

      await fs.writeFile(path.join(boardDir, `${task.id}.md`), content, 'utf-8')
      count++
    }

    // Export paused tasks
    const paused = (state.pausedTasks || []) as Array<{
      description: string
      status: string
      id?: string
      branch?: string
      linearId?: string
      type?: string
      startedAt?: string
    }>
    for (const task of paused) {
      const id = task.id || `paused_${Date.now()}`
      const frontmatter: Record<string, unknown> = {
        prjct_id: id,
        prjct_type: 'task',
        status: 'paused',
        type: task.type || 'feature',
        description: task.description,
        branch: task.branch,
        linear_id: task.linearId,
        updated_at: new Date().toISOString(),
      }

      const content = mdObsidianNote(frontmatter, task.description, `Status: paused`)
      await fs.writeFile(path.join(boardDir, `${id}.md`), content, 'utf-8')
      count++
    }

    // Export active workspace tasks (parallel sessions)
    const active = (state.activeTasks || []) as Array<{
      id: string
      description: string
      type?: string
      branch?: string
      linearId?: string
      startedAt?: string
      worktreePath?: string
    }>
    for (const task of active) {
      const frontmatter: Record<string, unknown> = {
        prjct_id: task.id,
        prjct_type: 'task',
        status: 'in_progress',
        type: task.type || 'feature',
        description: task.description,
        branch: task.branch,
        linear_id: task.linearId,
        started_at: task.startedAt,
        worktree: task.worktreePath,
        updated_at: new Date().toISOString(),
      }

      const content = mdObsidianNote(frontmatter, task.description)
      await fs.writeFile(path.join(boardDir, `${task.id}.md`), content, 'utf-8')
      count++
    }

    // Generate Kanban board file
    await this.generateKanbanBoard(state, boardDir)

    return count
  }

  private async generateKanbanBoard(state: StateJson, boardDir: string): Promise<void> {
    const lines: string[] = ['---', 'kanban-plugin: board', '---', '']

    // Collect tasks by status
    const inProgress: string[] = []
    const paused: string[] = []
    const done: string[] = []

    if (state.currentTask) {
      inProgress.push(`- [[${state.currentTask.id}]]`)
    }
    for (const task of (state.activeTasks || []) as Array<{ id: string }>) {
      inProgress.push(`- [[${task.id}]]`)
    }
    for (const task of (state.pausedTasks || []) as Array<{ id?: string }>) {
      if (task.id) paused.push(`- [[${task.id}]]`)
    }

    // Recent completed from history
    const history = (state.taskHistory || []) as Array<{ taskId: string; title: string }>
    for (const entry of history.slice(0, 5)) {
      done.push(`- [[${entry.taskId}]]`)
    }

    lines.push('## In Progress')
    lines.push(...(inProgress.length > 0 ? inProgress : ['']))
    lines.push('')
    lines.push('## Paused')
    lines.push(...(paused.length > 0 ? paused : ['']))
    lines.push('')
    lines.push('## Done')
    lines.push(...(done.length > 0 ? done : ['']))

    await fs.writeFile(path.join(boardDir, '_kanban.md'), lines.join('\n'), 'utf-8')
  }

  // ===========================================================================
  // Queue
  // ===========================================================================

  async exportQueue(projectId: string, projectPath: string): Promise<number> {
    const queue: QueueJson = await queueStorage.read(projectId)
    const queueDir = path.join(projectPath, 'queue')
    let count = 0

    for (const task of queue.tasks) {
      if (task.completed) continue

      const frontmatter: Record<string, unknown> = {
        prjct_id: task.id,
        prjct_type: 'queue',
        priority: task.priority,
        type: task.type,
        section: task.section,
        created_at: task.createdAt,
        updated_at: new Date().toISOString(),
      }
      if (task.agent) frontmatter.agent = task.agent
      if (task.groupName) frontmatter.group = task.groupName
      if (task.featureId) frontmatter.feature_id = task.featureId

      const content = mdObsidianNote(frontmatter, task.description)
      await fs.writeFile(path.join(queueDir, `${task.id}.md`), content, 'utf-8')
      count++
    }

    return count
  }

  // ===========================================================================
  // Shipped
  // ===========================================================================

  async exportShipped(projectId: string, projectPath: string): Promise<number> {
    const shipped = await shippedStorage.read(projectId)
    const shippedDir = path.join(projectPath, 'shipped')
    let count = 0

    for (const item of shipped.shipped) {
      const frontmatter: Record<string, unknown> = {
        prjct_id: item.id,
        prjct_type: 'shipped',
        name: item.name,
        version: item.version,
        type: item.type,
        shipped_at: item.shippedAt,
      }
      if (item.duration) frontmatter.duration = item.duration
      if (item.codeMetrics?.filesChanged) frontmatter.files_changed = item.codeMetrics.filesChanged
      if (item.codeMetrics?.linesAdded) frontmatter.lines_added = item.codeMetrics.linesAdded
      if (item.codeMetrics?.linesRemoved) frontmatter.lines_removed = item.codeMetrics.linesRemoved

      const sections: string[] = []

      if (item.changes && item.changes.length > 0) {
        const changeList = item.changes.map(
          (c) => `- ${c.type ? `**${c.type}**: ` : ''}${c.description}`
        )
        sections.push(`## Changes\n${changeList.join('\n')}`)
      }

      if (item.codeMetrics) {
        const m = item.codeMetrics
        const metrics: string[] = []
        if (m.filesChanged) metrics.push(`- **Files**: ${m.filesChanged} changed`)
        if (m.linesAdded || m.linesRemoved) {
          metrics.push(`- **Lines**: +${m.linesAdded || 0} / -${m.linesRemoved || 0}`)
        }
        if (item.duration) {
          metrics.push(`- **Duration**: ${item.duration}`)
        }
        if (metrics.length > 0) sections.push(`## Metrics\n${metrics.join('\n')}`)
      }

      const content = mdObsidianNote(frontmatter, item.name, item.description || null, ...sections)
      await fs.writeFile(path.join(shippedDir, `${item.id}.md`), content, 'utf-8')
      count++
    }

    return count
  }

  // ===========================================================================
  // Roadmap
  // ===========================================================================

  async exportRoadmap(projectId: string, projectPath: string): Promise<number> {
    const roadmap = prjctDb.getDoc<RoadmapJson>(projectId, 'roadmap')
    if (!roadmap) return 0

    const roadmapDir = path.join(projectPath, 'roadmap')
    let count = 0

    const features = roadmap.features || []
    for (const feat of features) {
      const frontmatter: Record<string, unknown> = {
        prjct_id: feat.id,
        prjct_type: 'feature',
        status: feat.status,
        impact: feat.impact,
        progress: feat.progress,
        updated_at: new Date().toISOString(),
      }
      if (feat.phase) frontmatter.phase = feat.phase
      if (feat.quarter) frontmatter.quarter = feat.quarter
      if (feat.dependencies && feat.dependencies.length > 0) {
        frontmatter.dependencies = feat.dependencies
      }

      const taskLines = (feat.tasks || []).map((t: { description: string; completed: boolean }) => {
        const checked = t.completed ? 'x' : ' '
        return `- [${checked}] ${t.description}`
      })

      const content = mdObsidianNote(
        frontmatter,
        feat.name,
        feat.description || null,
        taskLines.length > 0 ? `## Tasks\n${taskLines.join('\n')}` : null
      )
      await fs.writeFile(path.join(roadmapDir, `${feat.id}.md`), content, 'utf-8')
      count++
    }

    // Generate Canvas file
    await this.generateCanvas(features, roadmapDir)

    return count
  }

  private async generateCanvas(
    features: Array<{
      id: string
      name: string
      status: string
      dependencies?: string[]
      quarter?: string | null
    }>,
    roadmapDir: string
  ): Promise<void> {
    const statusColors: Record<string, string> = {
      shipped: '4', // green
      completed: '4',
      active: '5', // blue
      planned: '0', // default
    }

    const nodes = features.map((f, i) => ({
      id: f.id,
      type: 'text' as const,
      text: `**${f.name}**\nStatus: ${f.status}${f.quarter ? `\nQuarter: ${f.quarter}` : ''}`,
      x: (i % 4) * 300,
      y: Math.floor(i / 4) * 200,
      width: 260,
      height: 120,
      color: statusColors[f.status] || '0',
    }))

    const edges: Array<{
      id: string
      fromNode: string
      toNode: string
      label: string
    }> = []

    for (const f of features) {
      for (const dep of f.dependencies || []) {
        if (features.some((ff) => ff.id === dep)) {
          edges.push({
            id: `edge_${f.id}_${dep}`,
            fromNode: dep,
            toNode: f.id,
            label: 'depends on',
          })
        }
      }
    }

    const canvas = JSON.stringify({ nodes, edges }, null, 2)
    await fs.writeFile(path.join(roadmapDir, 'roadmap.canvas'), canvas, 'utf-8')
  }

  // ===========================================================================
  // Daily Note
  // ===========================================================================

  async exportDaily(projectId: string, projectPath: string): Promise<boolean> {
    const state: StateJson = await stateStorage.read(projectId)
    const queue: QueueJson = await queueStorage.read(projectId)
    const today = new Date().toISOString().split('T')[0]
    const dailyDir = path.join(projectPath, 'daily')

    const frontmatter: Record<string, unknown> = {
      prjct_type: 'daily',
      date: today,
      has_active_task: !!state.currentTask,
      queue_depth: queue.tasks.filter((t) => !t.completed).length,
    }

    const sections: string[] = []

    // Current task
    if (state.currentTask) {
      const task = state.currentTask
      const subtasks = (task.subtasks || []) as Array<{ description: string; status: string }>
      const completed = subtasks.filter((s) => s.status === 'completed').length
      sections.push(
        `## Active Task\n**${task.description}**\n` +
          (task.branch ? `Branch: \`${task.branch}\`\n` : '') +
          (subtasks.length > 0 ? `Progress: ${completed}/${subtasks.length}` : '')
      )
    } else {
      sections.push('## Active Task\nNo active task.')
    }

    // Queue top items
    const pending = queue.tasks.filter((t) => !t.completed).slice(0, 5)
    if (pending.length > 0) {
      const rows = pending.map((t) => [t.priority, t.type, t.description])
      sections.push(
        `## Queue (Top ${pending.length})\n${mdTable(['Priority', 'Type', 'Description'], rows)}`
      )
    }

    const content = mdObsidianNote(frontmatter, `Daily: ${today}`, ...sections)
    await fs.writeFile(path.join(dailyDir, `${today}.md`), content, 'utf-8')
    return true
  }

  // ===========================================================================
  // Dashboard Index
  // ===========================================================================

  async exportIndex(projectName: string, projectPath: string): Promise<void> {
    const content = `# ${projectName}

## Board
\`\`\`dataview
TABLE status, type, priority
FROM "${path.basename(path.dirname(projectPath))}/${path.basename(projectPath)}/board"
WHERE prjct_type = "task"
SORT priority DESC
\`\`\`

## Queue (Top 10)
\`\`\`dataview
TABLE priority, type
FROM "${path.basename(path.dirname(projectPath))}/${path.basename(projectPath)}/queue"
SORT priority DESC
LIMIT 10
\`\`\`

## Recent Shipped
\`\`\`dataview
TABLE version, type, duration_hours
FROM "${path.basename(path.dirname(projectPath))}/${path.basename(projectPath)}/shipped"
SORT shipped_at DESC
LIMIT 5
\`\`\`

## Knowledge Base
\`\`\`dataview
TABLE file.mtime as "Updated"
FROM "${path.basename(path.dirname(projectPath))}/${path.basename(projectPath)}/architecture" OR "${path.basename(path.dirname(projectPath))}/${path.basename(projectPath)}/research"
SORT file.mtime DESC
LIMIT 10
\`\`\`
`

    await fs.writeFile(path.join(projectPath, '_index.md'), content, 'utf-8')
  }

  // ===========================================================================
  // Vault File Operations (for MCP tools)
  // ===========================================================================

  // Security: allowed extensions and blocked directories
  private static ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.canvas'])
  private static BLOCKED_DIRS = new Set(['.obsidian', '.git', '.trash', 'node_modules'])

  /**
   * Validate a file path is safe (no traversal, allowed extension, not blocked)
   */
  private validatePath(vaultRoot: string, filePath: string): string {
    // Resolve to absolute, ensure within vault
    const resolved = path.resolve(vaultRoot, filePath)
    if (!resolved.startsWith(path.resolve(vaultRoot))) {
      throw new Error(`Path traversal blocked: ${filePath}`)
    }

    // Check blocked directories
    const relative = path.relative(vaultRoot, resolved)
    const segments = relative.split(path.sep)
    for (const seg of segments) {
      if (ObsidianExporter.BLOCKED_DIRS.has(seg)) {
        throw new Error(`Blocked directory: ${seg}`)
      }
    }

    return resolved
  }

  private validateFileExtension(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase()
    if (ext && !ObsidianExporter.ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `Blocked file extension: ${ext}. Allowed: ${[...ObsidianExporter.ALLOWED_EXTENSIONS].join(', ')}`
      )
    }
  }

  /**
   * Read a note from the vault
   */
  async readNote(
    config: ObsidianConfig,
    projectName: string,
    notePath: string
  ): Promise<{ content: string; frontmatter: Record<string, unknown> | null }> {
    const projectPath = this.getProjectPath(config, projectName)
    const resolved = this.validatePath(projectPath, notePath)
    this.validateFileExtension(resolved)

    const raw = await fs.readFile(resolved, 'utf-8')

    // Parse frontmatter
    let frontmatter: Record<string, unknown> | null = null
    let content = raw
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (fmMatch) {
      frontmatter = this.parseYamlFrontmatter(fmMatch[1])
      content = fmMatch[2]
    }

    return { content, frontmatter }
  }

  /**
   * Write a note to the vault (create or overwrite)
   */
  async writeNote(
    config: ObsidianConfig,
    projectName: string,
    notePath: string,
    content: string,
    frontmatter?: Record<string, unknown>
  ): Promise<void> {
    const projectPath = this.getProjectPath(config, projectName)
    const resolved = this.validatePath(projectPath, notePath)
    this.validateFileExtension(resolved)

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true })

    let output = content
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      const { mdFrontmatter } = await import('../utils/md-formatter')
      output = `${mdFrontmatter(frontmatter)}\n\n${content}`
    }

    await fs.writeFile(resolved, output, 'utf-8')
  }

  /**
   * Search notes in the vault by text query
   */
  async searchNotes(
    config: ObsidianConfig,
    projectName: string,
    query: string,
    options: { limit?: number; folder?: string } = {}
  ): Promise<Array<{ path: string; title: string; excerpt: string; score: number }>> {
    const projectPath = this.getProjectPath(config, projectName)
    const searchDir = options.folder ? this.validatePath(projectPath, options.folder) : projectPath
    const limit = options.limit || 20

    const results: Array<{ path: string; title: string; excerpt: string; score: number }> = []
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1)

    const files = await this.walkDir(searchDir)
    for (const file of files) {
      if (!ObsidianExporter.ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase())) continue

      try {
        const content = await fs.readFile(file, 'utf-8')
        const contentLower = content.toLowerCase()
        const relative = path.relative(projectPath, file)

        // BM25-inspired scoring: term frequency in content + filename
        let score = 0
        for (const term of queryTerms) {
          // Content matches
          let idx = 0
          let count = 0
          while ((idx = contentLower.indexOf(term, idx)) !== -1) {
            count++
            idx += term.length
          }
          if (count > 0) score += Math.log(1 + count)

          // Filename boost
          if (relative.toLowerCase().includes(term)) score += 2
        }

        if (score > 0) {
          // Extract title from first heading or filename
          const titleMatch = content.match(/^#\s+(.+)$/m)
          const title = titleMatch ? titleMatch[1] : path.basename(file, path.extname(file))

          // Extract excerpt around first match
          const firstMatchIdx = contentLower.indexOf(queryLower.split(/\s+/)[0])
          const excerptStart = Math.max(0, firstMatchIdx - 50)
          const excerptEnd = Math.min(content.length, firstMatchIdx + 150)
          const excerpt =
            (excerptStart > 0 ? '...' : '') +
            content.slice(excerptStart, excerptEnd).replace(/\n/g, ' ').trim() +
            (excerptEnd < content.length ? '...' : '')

          results.push({ path: relative, title, excerpt, score })
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Sort by score descending, limit
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  /**
   * List notes in a vault folder
   */
  async listNotes(
    config: ObsidianConfig,
    projectName: string,
    folder?: string
  ): Promise<Array<{ path: string; name: string; isDir: boolean; size?: number }>> {
    const projectPath = this.getProjectPath(config, projectName)
    const targetDir = folder ? this.validatePath(projectPath, folder) : projectPath

    const entries = await fs.readdir(targetDir, { withFileTypes: true })
    const results: Array<{ path: string; name: string; isDir: boolean; size?: number }> = []

    for (const entry of entries) {
      // Skip blocked dirs and hidden files
      if (ObsidianExporter.BLOCKED_DIRS.has(entry.name)) continue
      if (entry.name.startsWith('.')) continue

      const relative = folder ? `${folder}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        results.push({ path: relative, name: entry.name, isDir: true })
      } else if (ObsidianExporter.ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fs.stat(path.join(targetDir, entry.name))
        results.push({ path: relative, name: entry.name, isDir: false, size: stat.size })
      }
    }

    return results
  }

  /**
   * Get vault stats for a project
   */
  async getVaultStats(
    config: ObsidianConfig,
    projectName: string
  ): Promise<{ totalNotes: number; folders: Record<string, number>; totalSize: number }> {
    const projectPath = this.getProjectPath(config, projectName)
    const folders: Record<string, number> = {}
    let totalNotes = 0
    let totalSize = 0

    const files = await this.walkDir(projectPath)
    for (const file of files) {
      if (!ObsidianExporter.ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase())) continue
      const relative = path.relative(projectPath, file)
      const folder = path.dirname(relative).split(path.sep)[0] || '.'
      folders[folder] = (folders[folder] || 0) + 1
      totalNotes++
      try {
        const stat = await fs.stat(file)
        totalSize += stat.size
      } catch {
        // skip
      }
    }

    return { totalNotes, folders, totalSize }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private parseYamlFrontmatter(raw: string): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const line of raw.split('\n')) {
      const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        // Parse arrays: [a, b, c]
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        } else if (value === 'true') {
          result[key] = true
        } else if (value === 'false') {
          result[key] = false
        } else if (!Number.isNaN(Number(value)) && value.trim() !== '') {
          result[key] = Number(value)
        } else {
          result[key] = value
        }
      }
    }
    return result
  }

  private async walkDir(dir: string): Promise<string[]> {
    const results: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (ObsidianExporter.BLOCKED_DIRS.has(entry.name)) continue
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...(await this.walkDir(fullPath)))
        } else {
          results.push(fullPath)
        }
      }
    } catch {
      // Skip unreadable directories
    }
    return results
  }
}

export const obsidianExporter = new ObsidianExporter()
