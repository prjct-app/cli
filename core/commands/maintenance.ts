/**
 * Maintenance Commands: cleanup, design
 * Analysis commands moved to analysis.ts
 */

import path from 'path'

import type { CommandResult, CleanupOptions, DesignOptions, Context } from './types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  fileHelper,
  jsonlHelper,
  dateHelper,
  out
} from './base'

export class MaintenanceCommands extends PrjctCommandsBase {
  /**
   * Memory cleanup helper
   */
  async _cleanupMemory(projectPath: string): Promise<{ success: boolean; results: { rotated: string[]; totalSize: number; freedSpace: number } }> {
    const projectId = await configManager.getProjectId(projectPath)

    const results = { rotated: [] as string[], totalSize: 0, freedSpace: 0 }
    const jsonlFiles = [
      pathManager.getFilePath(projectId!, 'memory', 'context.jsonl'),
      pathManager.getFilePath(projectId!, 'progress', 'shipped.md'),
      pathManager.getFilePath(projectId!, 'planning', 'ideas.md'),
    ]

    for (const filePath of jsonlFiles) {
      try {
        const sizeMB = await jsonlHelper.getFileSizeMB(filePath)
        if (sizeMB > 0) {
          results.totalSize += sizeMB
          const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(filePath, 10)
          if (rotated) {
            results.rotated.push(path.basename(filePath))
            results.freedSpace += sizeMB
          }
        }
      } catch {
        // skip
      }
    }

    return { success: true, results }
  }

  /**
   * Internal cleanup helper for memory during normal cleanup
   */
  async _cleanupMemoryInternal(projectPath: string): Promise<void> {
    const projectId = await configManager.getProjectId(projectPath)
    const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')
    await jsonlHelper.rotateJsonLinesIfNeeded(memoryPath, 10)
  }

  /**
   * /p:cleanup - Clean temp files and old entries
   */
  async cleanup(_options: CleanupOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const isMemoryMode = _options.memory === true || _options.type === 'memory'

      if (isMemoryMode) {
        out.spin('cleaning memory...')
        const result = await this._cleanupMemory(projectPath)
        out.done('memory cleaned')
        return result
      }

      out.spin('cleaning up...')

      const context = await contextBuilder.build(projectPath) as Context
      const projectId = await configManager.getProjectId(projectPath)

      const cleaned: string[] = []

      const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')
      try {
        const entries = await jsonlHelper.readJsonLines(memoryPath)

        if (entries.length > 100) {
          const kept = entries.slice(-100)
          await jsonlHelper.writeJsonLines(memoryPath, kept)
          cleaned.push(`Memory: ${entries.length - 100} old entries removed`)
        } else {
          cleaned.push('Memory: No cleanup needed')
        }
      } catch {
        cleaned.push('Memory: No file found')
      }

      const ideasPath = context.paths.ideas
      try {
        const ideasContent = (await toolRegistry.get('Read')!(ideasPath)) as string
        const sections = ideasContent.split('##').filter((s) => s.trim())

        const nonEmpty = sections.filter((section) => {
          const lines = section
            .trim()
            .split('\n')
            .filter((l) => l.trim())
          return lines.length > 1
        })

        if (sections.length !== nonEmpty.length) {
          const newContent =
            '# IDEAS 💡\n\n## Brain Dump\n\n' +
            nonEmpty
              .slice(1)
              .map((s) => '## ' + s.trim())
              .join('\n\n')
          await toolRegistry.get('Write')!(ideasPath, newContent)
          cleaned.push(`Ideas: ${sections.length - nonEmpty.length} empty sections removed`)
        } else {
          cleaned.push('Ideas: No cleanup needed')
        }
      } catch {
        cleaned.push('Ideas: No file found')
      }

      const nextPath = context.paths.next
      try {
        const nextContent = (await toolRegistry.get('Read')!(nextPath)) as string
        const completedTasks = (nextContent.match(/\[x\]/gi) || []).length

        if (completedTasks > 0) {
          cleaned.push(
            `Queue: ${completedTasks} completed tasks found (not removed - use /p:done to clear)`
          )
        } else {
          cleaned.push('Queue: No completed tasks')
        }
      } catch {
        cleaned.push('Queue: No file found')
      }

      await this._cleanupMemoryInternal(projectPath)

      await this.logToMemory(projectPath, 'cleanup_performed', {
        items: cleaned.length,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${cleaned.length} items cleaned`)
      return { success: true, cleaned }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:design - Design system architecture, APIs, and components
   */
  async design(target: string | null = null, options: DesignOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const designType = options.type || 'architecture'
      const validTypes = ['architecture', 'api', 'component', 'database', 'flow']

      if (!validTypes.includes(designType)) {
        out.fail(`invalid type: ${designType}`)
        return { success: false, error: 'Invalid design type' }
      }

      const designTarget = target || 'system'
      out.spin(`designing ${designType}...`)

      const projectId = await configManager.getProjectId(projectPath)
      const designsPath = path.join(
        pathManager.getGlobalProjectPath(projectId!),
        'planning',
        'designs'
      )
      await fileHelper.ensureDir(designsPath)

      let designContent = ''

      switch (designType) {
        case 'architecture':
          designContent = `# Architecture Design: ${designTarget}\n\n*Use templates/design/architecture.md for full design*\n`
          break
        case 'api':
          designContent = `# API Design: ${designTarget}\n\n*Use templates/design/api.md for full design*\n`
          break
        case 'component':
          designContent = `# Component Design: ${designTarget}\n\n*Use templates/design/component.md for full design*\n`
          break
        case 'database':
          designContent = `# Database Design: ${designTarget}\n\n*Use templates/design/database.md for full design*\n`
          break
        case 'flow':
          designContent = `# Flow Design: ${designTarget}\n\n*Use templates/design/flow.md for full design*\n`
          break
      }

      const designFileName = `${designType}-${designTarget.toLowerCase().replace(/\s+/g, '-')}.md`
      const designFilePath = path.join(designsPath, designFileName)
      await fileHelper.writeFile(designFilePath, designContent)

      await this.logToMemory(projectPath, 'design_created', {
        type: designType,
        target: designTarget,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${designType} design created`)
      return { success: true, designPath: designFilePath, type: designType, target: designTarget }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
