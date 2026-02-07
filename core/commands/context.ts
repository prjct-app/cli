/**
 * Context Commands - Exposes orchestrator context to Claude
 *
 * The `context` command runs the orchestrator and returns JSON with everything
 * Claude needs to execute workflows:
 * - projectId and globalPath for file operations
 * - detected domains from task description
 * - loaded agents with file paths and previews
 * - current task state (if any)
 * - repo analysis data
 *
 * This bridges the gap between TypeScript orchestration and Claude Code templates.
 *
 * @module commands/context
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import orchestratorExecutor from '../agentic/orchestrator-executor'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { stateStorage } from '../storage'
import type { CommandResult } from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'

// =============================================================================
// Types
// =============================================================================

export interface ContextOutput {
  projectId: string
  globalPath: string
  currentTask: {
    id: string
    description: string
    startedAt: string
    subtasks?: Array<{
      id: string
      description: string
      status: string
      domain: string
    }>
    currentSubtaskIndex?: number
  } | null
  domains: string[]
  primaryDomain: string | null
  agents: Array<{
    name: string
    domain: string
    filePath: string
    skills: string[]
    preview: string
  }>
  subtasks: Array<{
    id: string
    description: string
    domain: string
    agent: string
    status: string
    order: number
  }> | null
  repoAnalysis: {
    ecosystem: string
    frameworks: string[]
    hasTests: boolean
    technologies: string[]
  }
}

// =============================================================================
// Context Commands Class
// =============================================================================

export class ContextCommands {
  /**
   * Get full project context for Claude
   *
   * Usage:
   *   prjct context task "add user auth"
   *   prjct context done
   *   prjct context ship
   *
   * Returns JSON with all orchestrator data.
   */
  async context(
    input: string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      // Parse input: first word is command, rest is arguments
      const parts = (input || '').trim().split(/\s+/)
      const command = parts[0] || 'task'
      const taskDescription = parts.slice(1).join(' ')

      // Get project info
      const config = await configManager.readConfig(projectPath)
      if (!config || !config.projectId) {
        const output: Partial<ContextOutput> = {
          projectId: '',
          globalPath: '',
          currentTask: null,
          domains: [],
          primaryDomain: null,
          agents: [],
          subtasks: null,
          repoAnalysis: {
            ecosystem: 'unknown',
            frameworks: [],
            hasTests: false,
            technologies: [],
          },
        }
        console.log(JSON.stringify(output, null, 2))
        return {
          success: false,
          message: 'No prjct project. Run `p. init` first.',
        }
      }

      const projectId = config.projectId
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Get current task state
      const state = await stateStorage.read(projectId)
      const currentTask = state?.currentTask
        ? {
            id: state.currentTask.id,
            description: state.currentTask.description,
            startedAt: state.currentTask.startedAt,
            subtasks: state.currentTask.subtasks?.map((st) => ({
              id: st.id,
              description: st.description,
              status: st.status,
              domain: st.domain,
            })),
            currentSubtaskIndex: state.currentTask.currentSubtaskIndex,
          }
        : null

      // Run orchestrator if we have a task description
      let orchestratorContext = null
      if (taskDescription) {
        try {
          orchestratorContext = await orchestratorExecutor.execute(
            command,
            taskDescription,
            projectPath
          )
        } catch (error) {
          // Orchestration failed - continue without it
          console.error(`Warning: Orchestrator failed: ${getErrorMessage(error)}`)
        }
      }

      // Load repo analysis
      const repoAnalysis = await this.loadRepoAnalysis(globalPath)

      // Build output
      const output: ContextOutput = {
        projectId,
        globalPath,
        currentTask,
        domains: orchestratorContext?.detectedDomains || [],
        primaryDomain: orchestratorContext?.primaryDomain || null,
        agents:
          orchestratorContext?.agents.map((a) => ({
            name: a.name,
            domain: a.domain,
            filePath: a.filePath,
            skills: a.skills,
            preview: a.content.substring(0, 500),
          })) || [],
        subtasks:
          orchestratorContext?.subtasks?.map((st) => ({
            id: st.id,
            description: st.description,
            domain: st.domain,
            agent: st.agent,
            status: st.status,
            order: st.order,
          })) || null,
        repoAnalysis: {
          ecosystem: repoAnalysis?.ecosystem || 'unknown',
          frameworks: repoAnalysis?.frameworks || [],
          hasTests: repoAnalysis?.hasTests || false,
          technologies: repoAnalysis?.technologies || [],
        },
      }

      // Output JSON to stdout
      console.log(JSON.stringify(output, null, 2))

      return {
        success: true,
        message: '', // Empty message - JSON output is the result
      }
    } catch (error) {
      return {
        success: false,
        message: `Context error: ${getErrorMessage(error)}`,
      }
    }
  }

  /**
   * Load repo analysis from analysis/repo-analysis.json
   */
  private async loadRepoAnalysis(globalPath: string): Promise<{
    ecosystem: string
    frameworks: string[]
    hasTests: boolean
    technologies: string[]
  } | null> {
    try {
      const analysisPath = path.join(globalPath, 'analysis', 'repo-analysis.json')
      const content = await fs.readFile(analysisPath, 'utf-8')
      const data = JSON.parse(content)
      return {
        ecosystem: data.ecosystem || 'unknown',
        frameworks: data.frameworks || [],
        hasTests: data.hasTests ?? false,
        technologies: data.technologies || [],
      }
    } catch (error) {
      if (isNotFoundError(error)) return null
      return null
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

const contextCommands = new ContextCommands()
export default contextCommands
export { contextCommands }
