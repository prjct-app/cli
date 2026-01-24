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

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'

// =============================================================================
// Types
// =============================================================================

export interface TemplateExecutionContext {
  projectPath: string
  projectId: string
  globalPath: string
  command: string
  args: string

  // Agent information
  agentName: string
  agentSettingsPath: string

  // Paths for agent (not content)
  paths: {
    orchestrator: string
    agentRouting: string
    taskFragmentation: string
    commandTemplate: string
    repoAnalysis: string
    agentsDir: string
    skillsDir: string
    stateJson: string
  }
}

export interface AgenticPromptInfo {
  prompt: string
  context: TemplateExecutionContext
  requiresOrchestration: boolean
}

// Commands that require orchestration (task routing, fragmentation)
const ORCHESTRATED_COMMANDS = ['task', 'done', 'ship', 'resume', 'bug', 'enrich']

// Commands that do NOT need orchestration
const SIMPLE_COMMANDS = ['init', 'sync', 'pause', 'next', 'dash', 'history', 'undo', 'redo']

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
    const activeProvider = aiProvider.getActiveProvider()

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
      agentSettingsPath: pathManager.getAgentSettingsPath(),
      paths: {
        orchestrator: path.join(templatesDir, 'agentic', 'orchestrator.md'),
        agentRouting: path.join(templatesDir, 'agentic', 'agent-routing.md'),
        taskFragmentation: path.join(templatesDir, 'agentic', 'task-fragmentation.md'),
        commandTemplate: path.join(templatesDir, 'commands', `${command}.md`),
        repoAnalysis: path.join(globalPath, 'analysis', 'repo-analysis.json'),
        agentsDir: path.join(globalPath, 'agents'),
        skillsDir: activeProvider.skillsDir,
        stateJson: path.join(globalPath, 'storage', 'state.json'),
      }
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
   * Check if agents exist for the project
   */
  async hasAgents(projectPath: string): Promise<boolean> {
    try {
      const projectId = await this.getProjectId(projectPath)
      const agentsDir = path.join(pathManager.getGlobalProjectPath(projectId), 'agents')
      const files = await fs.readdir(agentsDir)
      return files.some(f => f.endsWith('.md'))
    } catch (error) {
      if (isNotFoundError(error)) return false
      return false
    }
  }

  /**
   * Get list of available agent names
   */
  async getAvailableAgents(projectPath: string): Promise<string[]> {
    try {
      const projectId = await this.getProjectId(projectPath)
      const agentsDir = path.join(pathManager.getGlobalProjectPath(projectId), 'agents')
      const files = await fs.readdir(agentsDir)
      return files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
    } catch {
      return []
    }
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
- Agent: ${context.agentName}
- Settings: ${context.agentSettingsPath}
- Command: ${context.command}
- Args: ${context.args}
- Project: ${context.projectPath}
- Project ID: ${context.projectId}

### Paths (Read as needed)
- Orchestrator: ${context.paths.orchestrator}
- Agent Routing: ${context.paths.agentRouting}
- Task Fragmentation: ${context.paths.taskFragmentation}
- Command Template: ${context.paths.commandTemplate}
- Repo Analysis: ${context.paths.repoAnalysis}
- Agents Directory: ${context.paths.agentsDir}
- Skills Directory: ${context.paths.skillsDir}
- State JSON: ${context.paths.stateJson}

### Instructions

1. **Read the command template** (${context.paths.commandTemplate})

2. **Check if orchestration is needed**
   - This command ${requiresOrchestration ? 'REQUIRES' : 'does NOT require'} orchestration
   ${requiresOrchestration ? `
3. **Orchestration steps:**
   - Read: ${context.paths.orchestrator}
   - Read: ${context.paths.repoAnalysis} to understand project technologies
   - Analyze the task: "${context.args}"
   - Determine which domains are ACTUALLY relevant based on:
     a) What the task requires
     b) What technologies exist in this project
     c) What agents are available in ${context.paths.agentsDir}

   - **IMPORTANTE**: Los agentes en ${context.paths.agentsDir} YA son específicos del proyecto
     (fueron generados durante p. sync con las tecnologías reales)

   - SIEMPRE usar el especialista si existe para el dominio
   - Solo usar generalista si NO existe agente para ese dominio

   - Check if task should be fragmented (read: ${context.paths.taskFragmentation})
   - If agents loaded, check their skills and load from ${context.paths.skillsDir}
` : `
3. **Simple execution:**
   - Execute the command template directly
   - No agent routing needed
`}

4. **Execute the command template** with full context

5. **Return results**

### Agentic Decision Making

YOU decide:
- Whether to run orchestration (based on command type)
- Which domains the task involves (frontend, backend, database, etc.)
- Whether to fragment the task into subtasks
- Which specialist agents to delegate to

ALWAYS:
- Use specialist agents when they exist (they're already project-specific)
- Delegate subtasks to the appropriate specialist via Task tool
- Let specialists handle their domain (they have the project patterns)
- Generate and store summaries when subtasks complete

ONLY use generalist when:
- No specialist agent exists for that domain
- Task is completely outside project scope
- Extreme edge case

### Subtask Management

When fragmenting tasks:
1. Store subtasks in state.json under currentTask.subtasks
2. Track progress: currentSubtaskIndex, subtaskProgress
3. Each completed subtask generates a summary
4. Pass summary to next agent for context handoff
`

    return {
      prompt,
      context,
      requiresOrchestration
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const templateExecutor = new TemplateExecutor()
export default templateExecutor
