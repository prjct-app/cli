/**
 * Command Registry - Single Source of Truth
 *
 * Registry helper functions for accessing commands and categories.
 */

import type {
  Command,
  CategoryInfo,
  Categories,
  RegistryStats,
  ValidationResult
} from './types'
import { COMMANDS } from './commands'
import { CATEGORIES } from './categories'

/**
 * Registry helper functions
 */
const registry = {
  /**
   * Get all commands
   */
  getAll: (): Command[] => COMMANDS,

  /**
   * Get command by name
   */
  getByName: (name: string): Command | undefined => COMMANDS.find((c) => c.name === name),

  /**
   * Get commands by category
   */
  getByCategory: (category: string): Command[] => COMMANDS.filter((c) => c.category === category),

  /**
   * Get all implemented commands
   */
  getAllImplemented: (): Command[] => COMMANDS.filter((c) => c.implemented),

  /**
   * Get all commands with templates
   */
  getAllWithTemplates: (): Command[] => COMMANDS.filter((c) => c.hasTemplate),

  /**
   * Get commands available in Claude Code
   */
  getClaudeCommands: (): Command[] => COMMANDS.filter((c) => c.usage.claude !== null),

  /**
   * Get commands available in terminal
   */
  getTerminalCommands: (): Command[] => COMMANDS.filter((c) => c.usage.terminal !== null),

  /**
   * Get all categories
   */
  getCategories: (): Categories => CATEGORIES,

  /**
   * Get category metadata
   */
  getCategory: (category: string): CategoryInfo | undefined => CATEGORIES[category],

  /**
   * Validate command registry
   */
  validate: (): ValidationResult => {
    const issues: string[] = []

    // Check for duplicate names
    const names = COMMANDS.map((c) => c.name)
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      issues.push(`Duplicate command names: ${duplicates.join(', ')}`)
    }

    // Check for commands with templates but not implemented
    const notImplemented = COMMANDS.filter((c) => c.hasTemplate && !c.implemented)
    if (notImplemented.length > 0) {
      issues.push(
        `Commands with templates but not implemented: ${notImplemented.map((c) => c.name).join(', ')}`
      )
    }

    // Check for invalid categories
    const validCategories = Object.keys(CATEGORIES)
    const invalidCategories = COMMANDS.filter((c) => !validCategories.includes(c.category))
    if (invalidCategories.length > 0) {
      issues.push(
        `Invalid categories: ${invalidCategories.map((c) => `${c.name}:${c.category}`).join(', ')}`
      )
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  },

  /**
   * Get core commands only (13 essential)
   */
  getCoreCommands: (): Command[] => COMMANDS.filter((c) => c.category === 'core'),

  /**
   * Get optional commands
   */
  getOptionalCommands: (): Command[] => COMMANDS.filter((c) => c.category === 'optional'),

  /**
   * Get commands that require initialization
   */
  getRequiresInit: (): Command[] => COMMANDS.filter((c) => c.requiresInit),

  /**
   * Get commands with blocking rules
   * NOTE: Blocking rules are now handled by Claude reading templates, not deterministic code
   */
  getWithBlockingRules: (): Command[] => COMMANDS.filter((c) => c.blockingRules !== null),

  /**
   * Get statistics
   */
  getStats: (): RegistryStats => ({
    total: COMMANDS.length,
    core: COMMANDS.filter((c) => c.category === 'core').length,
    optional: COMMANDS.filter((c) => c.category === 'optional').length,
    setup: COMMANDS.filter((c) => c.category === 'setup').length,
    implemented: COMMANDS.filter((c) => c.implemented).length,
    withTemplates: COMMANDS.filter((c) => c.hasTemplate).length,
    claudeOnly: COMMANDS.filter((c) => c.usage.claude && !c.usage.terminal).length,
    terminalOnly: COMMANDS.filter((c) => !c.usage.claude && c.usage.terminal).length,
    both: COMMANDS.filter((c) => c.usage.claude && c.usage.terminal).length,
    requiresInit: COMMANDS.filter((c) => c.requiresInit).length,
    withBlockingRules: COMMANDS.filter((c) => c.blockingRules !== null).length,
    byCategory: Object.keys(CATEGORIES).reduce(
      (acc, cat) => ({
        ...acc,
        [cat]: COMMANDS.filter((c) => c.category === cat).length,
      }),
      {}
    ),
  }),
}

export default registry

