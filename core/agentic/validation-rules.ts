/**
 * Validation Rules
 * Pre-flight validation for commands before execution
 *
 * @module agentic/validation-rules
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

interface Context {
  projectPath: string
  projectId?: string | null
  paths: Record<string, string>
  params: Record<string, unknown>
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

type Validator = (context: Context) => Promise<ValidationResult>

/**
 * Command-specific validators
 */
const validators: Record<string, Validator> = {
  /**
   * Validate /p:done can execute
   */
  async done(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if now.md exists and has content
    try {
      const nowContent = await fs.readFile(context.paths.now, 'utf-8')
      if (!nowContent.trim() || nowContent.includes('No current task')) {
        errors.push('No active task to complete')
        suggestions.push('Start a task with /p:now "task description"')
      }
    } catch {
      errors.push('now.md does not exist')
      suggestions.push('Initialize project with /p:init')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:ship can execute
   */
  async ship(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if now.md has content to ship
    try {
      const nowContent = await fs.readFile(context.paths.now, 'utf-8')
      if (!nowContent.trim() || nowContent.includes('No current task')) {
        warnings.push('No active task to ship')
      }
    } catch {
      warnings.push('now.md does not exist')
    }

    // Check if shipped.md exists
    try {
      await fs.access(path.dirname(context.paths.shipped))
    } catch {
      warnings.push('shipped.md directory does not exist')
      suggestions.push('Run /p:init to initialize project structure')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:now can execute
   */
  async now(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if project is initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      await fs.access(configPath)
    } catch {
      errors.push('Project not initialized')
      suggestions.push('Run /p:init to initialize')
    }

    // Check if already has a task
    try {
      const nowContent = await fs.readFile(context.paths.now, 'utf-8')
      if (nowContent.trim() && !nowContent.includes('No current task')) {
        warnings.push('Already has an active task')
        suggestions.push('Complete it first with /p:done')
      }
    } catch {
      // now.md doesn't exist - that's ok for /p:now
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:init can execute
   */
  async init(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if already initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      await fs.access(configPath)
      warnings.push('Project already initialized')
      suggestions.push('Use /p:sync to refresh or delete .prjct/ to reinitialize')
    } catch {
      // Not initialized - good
    }

    // Check if global storage is writable
    const globalPath = path.join(os.homedir(), '.prjct-cli')
    try {
      await fs.mkdir(globalPath, { recursive: true })
    } catch {
      errors.push('Cannot create ~/.prjct-cli directory')
      suggestions.push('Check filesystem permissions')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:sync can execute
   */
  async sync(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if project is initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      await fs.access(configPath)
    } catch {
      errors.push('Project not initialized')
      suggestions.push('Run /p:init first')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:feature can execute
   */
  async feature(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if project is initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      await fs.access(configPath)
    } catch {
      errors.push('Project not initialized')
      suggestions.push('Run /p:init first')
    }

    // Check if description provided
    if (!context.params.description && !context.params.feature) {
      warnings.push('No feature description provided')
      suggestions.push('Provide a feature description')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },

  /**
   * Validate /p:idea can execute
   */
  async idea(context): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if project is initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      await fs.access(configPath)
    } catch {
      errors.push('Project not initialized')
      suggestions.push('Run /p:init first')
    }

    // Check if idea text provided
    if (!context.params.idea && !context.params.text) {
      warnings.push('No idea text provided')
      suggestions.push('Provide idea text')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    }
  },
}

/**
 * Validate a command before execution
 */
async function validate(commandName: string, context: Context): Promise<ValidationResult> {
  const validator = validators[commandName]

  if (!validator) {
    // No specific validation needed
    return {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }
  }

  try {
    return await validator(context)
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${(error as Error).message}`],
      warnings: [],
      suggestions: ['Check file permissions and project configuration'],
    }
  }
}

/**
 * Format validation errors for display
 */
function formatError(result: ValidationResult): string {
  let output = ''

  if (result.errors.length > 0) {
    output += '❌ Validation Failed:\n'
    result.errors.forEach((e) => {
      output += `  • ${e}\n`
    })
  }

  if (result.warnings.length > 0) {
    output += '\n⚠️  Warnings:\n'
    result.warnings.forEach((w) => {
      output += `  • ${w}\n`
    })
  }

  if (result.suggestions.length > 0) {
    output += '\n💡 Suggestions:\n'
    result.suggestions.forEach((s) => {
      output += `  → ${s}\n`
    })
  }

  return output
}

export { validate, formatError, validators }
export default { validate, formatError, validators }
