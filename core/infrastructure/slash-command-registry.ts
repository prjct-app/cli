/**
 * Slash Command Registry
 * Generates Claude Code native slash command configuration.
 *
 * This enables:
 * - Native /p:* command autocomplete in Claude Code
 * - Command validation before execution
 * - Command discoverability in help systems
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface SlashCommand {
  name: string
  description: string
  args?: string
  category: 'workflow' | 'planning' | 'shipping' | 'analytics' | 'maintenance'
  requiresProject: boolean
  deprecated?: boolean
  replacedBy?: string
}

export interface SlashCommandRegistry {
  version: string
  generatedAt: string
  commands: Record<string, SlashCommand>
}

/**
 * Core prjct commands with metadata
 */
const PRJCT_COMMANDS: SlashCommand[] = [
  // Workflow
  { name: 'task', description: 'Start any task with intelligent classification', args: '<description>', category: 'workflow', requiresProject: true },
  { name: 'done', description: 'Complete current subtask', category: 'workflow', requiresProject: true },
  { name: 'pause', description: 'Pause current task', category: 'workflow', requiresProject: true },
  { name: 'resume', description: 'Resume paused task', category: 'workflow', requiresProject: true },
  { name: 'next', description: 'Show next tasks in queue', category: 'workflow', requiresProject: true },

  // Planning
  { name: 'init', description: 'Initialize prjct in current directory', args: '[description]', category: 'planning', requiresProject: false },
  { name: 'sync', description: 'Deep sync - analyze project, generate agents', category: 'planning', requiresProject: true },
  { name: 'idea', description: 'Capture an idea for later', args: '<idea>', category: 'planning', requiresProject: true },
  { name: 'spec', description: 'Generate feature specification', args: '<feature>', category: 'planning', requiresProject: true },
  { name: 'bug', description: 'Report a bug with auto-priority', args: '<description>', category: 'planning', requiresProject: true },

  // Shipping
  { name: 'ship', description: 'Ship feature with PR workflow', args: '[feature]', category: 'shipping', requiresProject: true },
  { name: 'review', description: 'Run code review on changes', category: 'shipping', requiresProject: true },
  { name: 'test', description: 'Run tests for current changes', category: 'shipping', requiresProject: true },
  { name: 'verify', description: 'Verify deployment', category: 'shipping', requiresProject: true },

  // Analytics
  { name: 'dash', description: 'Show project dashboard', category: 'analytics', requiresProject: true },
  { name: 'history', description: 'Show task history', category: 'analytics', requiresProject: true },
  { name: 'analyze', description: 'Analyze codebase', category: 'analytics', requiresProject: true },

  // Maintenance
  { name: 'cleanup', description: 'Clean up project files', category: 'maintenance', requiresProject: true },
  { name: 'undo', description: 'Undo last action', category: 'maintenance', requiresProject: true },
  { name: 'redo', description: 'Redo undone action', category: 'maintenance', requiresProject: true },

  // Deprecated
  { name: 'now', description: 'Start task (deprecated)', args: '<task>', category: 'workflow', requiresProject: true, deprecated: true, replacedBy: 'task' },
  { name: 'feature', description: 'Plan feature (deprecated)', args: '<feature>', category: 'planning', requiresProject: true, deprecated: true, replacedBy: 'task' },
]

/**
 * Generate slash command registry for Claude Code
 */
export async function generateRegistry(): Promise<SlashCommandRegistry> {
  const commands: Record<string, SlashCommand> = {}

  for (const cmd of PRJCT_COMMANDS) {
    commands[`p:${cmd.name}`] = cmd
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    commands,
  }
}

/**
 * Write registry to project's global path
 */
export async function writeRegistry(projectId: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const globalPath = path.join(os.homedir(), '.prjct-cli', 'projects', projectId, 'config')
    await fs.mkdir(globalPath, { recursive: true })

    const registry = await generateRegistry()
    const registryPath = path.join(globalPath, 'slash-commands.json')

    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')

    return { success: true, path: registryPath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Get command by name
 */
export function getCommand(name: string): SlashCommand | undefined {
  return PRJCT_COMMANDS.find(cmd => cmd.name === name)
}

/**
 * Get all commands by category
 */
export function getCommandsByCategory(category: SlashCommand['category']): SlashCommand[] {
  return PRJCT_COMMANDS.filter(cmd => cmd.category === category && !cmd.deprecated)
}

/**
 * Validate command exists
 */
export function validateCommand(name: string): { valid: boolean; command?: SlashCommand; error?: string } {
  const cmd = getCommand(name)

  if (!cmd) {
    return { valid: false, error: `Unknown command: ${name}` }
  }

  if (cmd.deprecated) {
    return {
      valid: true,
      command: cmd,
      error: `Command '${name}' is deprecated. Use '${cmd.replacedBy}' instead.`,
    }
  }

  return { valid: true, command: cmd }
}

/**
 * Format commands for help display
 */
export function formatHelpText(): string {
  const categories = ['workflow', 'planning', 'shipping', 'analytics', 'maintenance'] as const
  const lines: string[] = ['# prjct Commands', '']

  for (const category of categories) {
    const cmds = getCommandsByCategory(category)
    if (cmds.length === 0) continue

    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`)
    lines.push('')

    for (const cmd of cmds) {
      const args = cmd.args ? ` ${cmd.args}` : ''
      lines.push(`- \`/p:${cmd.name}${args}\` - ${cmd.description}`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

export default {
  generateRegistry,
  writeRegistry,
  getCommand,
  getCommandsByCategory,
  validateCommand,
  formatHelpText,
  PRJCT_COMMANDS,
}
