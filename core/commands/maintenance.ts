/**
 * Maintenance Commands
 *
 * Composed from individual modules:
 * - cleanup: Memory and project file cleanup
 * - design: System architecture and component design
 * - snapshots: Git-based undo/redo and session recovery
 */

import { findRelevantFiles } from '../tools/context/files-tool'
import type { CleanupOptions, CommandResult, DesignOptions } from '../types/commands'
import { PrjctCommandsBase } from './base'

// Import individual command functions
import { cleanup, cleanupMemory, cleanupMemoryInternal, cleanupProjects } from './cleanup'
import { design } from './design'
import { history, recover, redo, undo } from './snapshots'

/**
 * MaintenanceCommands - Facade class for maintenance operations
 *
 * Delegates to individual modules for implementation.
 */
export class MaintenanceCommands extends PrjctCommandsBase {
  // Cleanup operations
  _cleanupMemory = cleanupMemory
  _cleanupMemoryInternal = cleanupMemoryInternal

  async cleanup(
    options: CleanupOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return cleanup(options, projectPath)
  }

  // Project cleanup (stale/test directories)
  async cleanupProjects(options: { dryRun?: boolean; md?: boolean } = {}): Promise<CommandResult> {
    return cleanupProjects(options)
  }

  // Design operations
  async design(
    target: string | null = null,
    options: DesignOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return design(target, options, projectPath)
  }

  // Snapshot operations
  async recover(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return recover(projectPath)
  }

  async undo(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return undo(projectPath)
  }

  async redo(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return redo(projectPath)
  }

  async history(projectPath: string = process.cwd()): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult
    return history(projectPath)
  }

  async enrich(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; json?: boolean } = {}
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult

    const query = input?.trim()
    if (!query) {
      return {
        success: false,
        error: 'Missing issue ID or description',
        message: 'Usage: prjct enrich "<issue-id-or-description>" --md',
      }
    }

    const issueId = query.match(/\b[A-Z]+-\d+\b/)?.[0] || null
    const relevant = await findRelevantFiles(query, projectPath, {
      maxFiles: 10,
      minScore: 0.1,
      includeTests: true,
    })

    const payload = {
      success: true,
      mode: 'mcp',
      issueId,
      query,
      files: relevant.files.map((file) => ({
        path: file.path,
        score: Number(file.score.toFixed(3)),
        reasons: file.reasons,
      })),
      publish: {
        linear: 'Use your AI client Linear MCP tools to update description/comment.',
        jira: 'Use your AI client Jira MCP tools to update description/comment.',
      },
    }

    if (options.json) {
      console.log(JSON.stringify(payload))
      return { success: true }
    }

    if (options.md) {
      const lines: string[] = []
      lines.push('## Enrichment Context')
      lines.push('')
      lines.push(`- Query: ${query}`)
      if (issueId) lines.push(`- Issue ID: ${issueId}`)
      lines.push(`- Candidate files: ${payload.files.length}`)
      lines.push('')
      lines.push('### Suggested Files')
      lines.push('')
      if (payload.files.length === 0) {
        lines.push('- No relevant files found.')
      } else {
        for (const file of payload.files) {
          lines.push(`- \`${file.path}\` (${file.score})`)
        }
      }
      lines.push('')
      lines.push('### Publish')
      lines.push('')
      lines.push('- Update description via MCP')
      lines.push('- Add enrichment as comment via MCP')
      lines.push('- Or keep local only')
      console.log(lines.join('\n'))
      return { success: true }
    }

    return {
      success: true,
      message: `Prepared enrichment context (${payload.files.length} files).`,
    }
  }
}
