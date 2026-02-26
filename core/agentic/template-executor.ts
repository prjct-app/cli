/**
 * Template Executor
 *
 * Executes templates as the entry point for agentic command execution.
 * TypeScript provides infrastructure (paths, reads/writes).
 * Claude takes all agentic decisions via templates.
 *
 * @module agentic/template-executor
 * @version 1.0.0
 */

import path from 'node:path'
import { ORCHESTRATED_COMMANDS, SIMPLE_COMMANDS } from '../constants/commands'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import type { AgenticPromptInfo, TemplateExecutionContext } from '../types/agentic.js'

// =============================================================================
// Template Executor Class
// =============================================================================

export class TemplateExecutor {
  /**
   * Get npm root for templates path
   */
  private async getNpmRoot(): Promise<string> {
    // Get the templates path relative to this module
    // In production, templates are in the npm package
    const moduleDir = path.dirname(require.resolve('prjct-cli/package.json'))
    return moduleDir
  }

  /**
   * Get project ID from local config
   */
  private async getProjectId(projectPath: string): Promise<string> {
    return configManager.getProjectId(projectPath)
  }

  /**
   * Build execution context with paths only
   * Claude reads files agentically - we don't inject content
   */
  async buildContext(
    command: string,
    args: string,
    projectPath: string
  ): Promise<TemplateExecutionContext> {
    const projectId = await this.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const aiProvider = require('../infrastructure/ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    // Get templates directory - use local path during development
    let templatesDir: string
    try {
      const npmRoot = await this.getNpmRoot()
      templatesDir = path.join(npmRoot, 'templates')
    } catch {
      // Fallback to local templates during development
      templatesDir = path.join(__dirname, '..', '..', 'templates')
    }

    return {
      projectPath,
      projectId,
      globalPath,
      command,
      args,
      agentName: activeProvider.displayName,
      agentSettingsPath: await pathManager.getAgentSettingsPath(),
      paths: {
        orchestrator: path.join(templatesDir, 'agentic', 'orchestrator.md'),
        taskFragmentation: path.join(templatesDir, 'agentic', 'task-fragmentation.md'),
        commandTemplate: path.join(templatesDir, 'commands', `${command}.md`),
        repoAnalysis: path.join(globalPath, 'analysis', 'repo-analysis.json'),
        skillsDir: activeProvider.skillsDir,
        stateJson: path.join(globalPath, 'storage', 'state.json'),
      },
    }
  }

  /**
   * Check if a command requires orchestration
   */
  requiresOrchestration(command: string): boolean {
    if (ORCHESTRATED_COMMANDS.includes(command)) return true
    if (SIMPLE_COMMANDS.includes(command)) return false
    // Default: assume orchestration needed for unknown commands
    return true
  }

  /**
   * Build prompt that tells agent to execute templates agentically
   */
  buildAgenticPrompt(context: TemplateExecutionContext): AgenticPromptInfo {
    const requiresOrchestration = this.requiresOrchestration(context.command)

    const prompt = `
## Agentic Execution Mode

You are executing a prjct command as ${context.agentName}. Follow the template-first approach.

### Context
- Command: ${context.command}
- Args: ${context.args}
- Project: ${context.projectPath}
- Project ID: ${context.projectId}

### Paths (Read as needed)
- Command Template: ${context.paths.commandTemplate}
- Repo Analysis: ${context.paths.repoAnalysis}
- Skills Directory: ${context.paths.skillsDir}
- State JSON: ${context.paths.stateJson}

### Instructions

1. **Read the command template** (${context.paths.commandTemplate})
${
  requiresOrchestration
    ? `
2. **Orchestration:**
   - Read: ${context.paths.repoAnalysis} to understand project technologies
   - Analyze the task: "${context.args}"
   - Determine which domains are relevant
   - Check if task should be fragmented into subtasks
`
    : `
2. **Execute the command template directly**
`
}
3. **Return results**
`

    return {
      prompt,
      context,
      requiresOrchestration,
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const templateExecutor = new TemplateExecutor()
export default templateExecutor
