/**
 * Validation Rules
 * Explicit pre-flight checks for each command
 * Returns SPECIFIC error messages, never generic failures
 *
 * OPTIMIZATION (P0.2): Anti-Hallucination Pattern
 * - Ground truth verification before actions
 * - Specific error messages for each failure mode
 * - Actionable suggestions in every error
 *
 * Source: Claude Code, Devin, Augment Code patterns
 */

const contextBuilder = require('./context-builder')

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string|null} error - Specific error message if invalid
 * @property {string|null} suggestion - Actionable next step
 * @property {Object} state - Pre-loaded state for command execution
 */

/**
 * Command-specific validation rules
 * Each rule returns { valid, error, suggestion, state }
 */
const validationRules = {
  /**
   * /p:done - Complete current task
   */
  async done(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'done')

    // Check 1: now.md exists and has content
    if (!state.now || state.now.trim() === '') {
      return {
        valid: false,
        error: 'No active task to complete',
        suggestion: 'Start a task first with /p:now "task description"',
        state
      }
    }

    // Check 2: Task is not a placeholder/comment
    const content = state.now.trim()
    if (content.startsWith('#') && content.split('\n').length === 1) {
      return {
        valid: false,
        error: 'now.md contains only a header, no task description',
        suggestion: 'Add task details or start fresh with /p:now "task"',
        state
      }
    }

    // Check 3: Task is not blocked
    if (content.toLowerCase().includes('blocked') ||
        content.toLowerCase().includes('waiting for')) {
      return {
        valid: false,
        error: 'Task appears to be blocked',
        suggestion: 'Resolve the blocker first or use /p:pause to save progress',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:ship - Ship a feature
   */
  async ship(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'ship')

    // Check 1: Has something to ship (now.md or recent shipped items)
    const hasCurrentTask = state.now && state.now.trim() !== ''
    const hasRecentShips = state.shipped && state.shipped.trim() !== ''

    if (!hasCurrentTask && !hasRecentShips) {
      return {
        valid: false,
        error: 'Nothing to ship yet',
        suggestion: 'Build something first with /p:now "feature name"',
        state
      }
    }

    // Check 2: Feature name provided (from params)
    if (!context.params.feature && !context.params.description) {
      // Try to extract from now.md
      if (hasCurrentTask) {
        // Auto-extract feature name - this is OK
        return { valid: true, error: null, suggestion: null, state }
      }
      return {
        valid: false,
        error: 'No feature name specified',
        suggestion: 'Specify what to ship: /p:ship "feature name"',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:now - Set or show current task
   */
  async now(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'now')

    // If no task param, this is a "show" request - always valid
    if (!context.params.task && !context.params.description) {
      return { valid: true, error: null, suggestion: null, state }
    }

    // Check: If setting new task, warn if one exists
    if (state.now && state.now.trim() !== '') {
      return {
        valid: true, // Still valid, but with warning
        error: null,
        suggestion: `Note: Replacing current task. Use /p:done first to track completion.`,
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:next - Show priority queue
   */
  async next(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'next')

    if (!state.next || state.next.trim() === '' ||
        !state.next.includes('- [')) {
      return {
        valid: true, // Valid but empty
        error: null,
        suggestion: 'Queue is empty. Add tasks with /p:feature or /p:idea',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:idea - Capture an idea
   */
  async idea(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'idea')

    // Check: Idea text provided
    if (!context.params.text && !context.params.description) {
      return {
        valid: false,
        error: 'No idea text provided',
        suggestion: 'Provide your idea: /p:idea "your idea here"',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:feature - Add a new feature
   */
  async feature(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'feature')

    // If no description, show interactive template - valid
    if (!context.params.description && !context.params.feature) {
      return { valid: true, error: null, suggestion: null, state }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:pause - Pause current task
   */
  async pause(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'now')

    if (!state.now || state.now.trim() === '') {
      return {
        valid: false,
        error: 'No active task to pause',
        suggestion: 'Start a task first with /p:now "task"',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:resume - Resume paused task
   */
  async resume(context) {
    const state = await contextBuilder.loadState(context, ['now'])

    // Check if there's a paused state to resume
    // This would need to check a paused.md or similar
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:recap - Show project overview
   */
  async recap(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'recap')
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:progress - Show progress metrics
   */
  async progress(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'progress')
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:analyze - Analyze repository
   */
  async analyze(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'analyze')
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:sync - Sync project state
   */
  async sync(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'sync')
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:bug - Report a bug
   */
  async bug(context) {
    const state = await contextBuilder.loadState(context, ['next'])

    if (!context.params.description && !context.params.bug) {
      return {
        valid: false,
        error: 'No bug description provided',
        suggestion: 'Describe the bug: /p:bug "description of the issue"',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:help - Show help
   */
  async help(context) {
    const state = await contextBuilder.loadStateForCommand(context, 'now')
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:ask - Intent translator
   */
  async ask(context) {
    if (!context.params.query && !context.params.question) {
      return {
        valid: false,
        error: 'No question provided',
        suggestion: 'Ask what you want to do: /p:ask "how do I..."',
        state: {}
      }
    }

    return { valid: true, error: null, suggestion: null, state: {} }
  },

  /**
   * /p:suggest - Smart suggestions
   */
  async suggest(context) {
    const state = await contextBuilder.loadState(context, ['now', 'next', 'shipped', 'metrics'])
    return { valid: true, error: null, suggestion: null, state }
  },

  /**
   * /p:spec - Spec-driven development
   */
  async spec(context) {
    const state = await contextBuilder.loadState(context, ['roadmap', 'next'])

    // If no feature name, this is a "show template" request - always valid
    if (!context.params.feature && !context.params.name && !context.params.description) {
      return {
        valid: true,
        error: null,
        suggestion: 'Provide a feature name to create a spec',
        state
      }
    }

    // Check queue capacity for new tasks
    const queueContent = state.next || ''
    const taskCount = (queueContent.match(/- \[[ x]\]/g) || []).length
    if (taskCount >= 95) {
      return {
        valid: false,
        error: 'Queue almost full (95+ tasks)',
        suggestion: 'Complete some tasks before creating a new spec. Use /p:done',
        state
      }
    }

    return { valid: true, error: null, suggestion: null, state }
  }
}

/**
 * Validate command before execution
 *
 * @param {string} commandName - Command to validate
 * @param {Object} context - Built context from contextBuilder
 * @returns {Promise<ValidationResult>}
 */
async function validate(commandName, context) {
  const validator = validationRules[commandName]

  if (!validator) {
    // No specific validation - default to valid
    return {
      valid: true,
      error: null,
      suggestion: null,
      state: await contextBuilder.loadState(context)
    }
  }

  try {
    return await validator(context)
  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error.message}`,
      suggestion: 'Check file permissions and project configuration',
      state: {}
    }
  }
}

/**
 * Format validation error for display
 * Minimal, actionable output
 *
 * @param {ValidationResult} result - Validation result
 * @returns {string} Formatted error message
 */
function formatError(result) {
  if (result.valid) return null

  let output = `❌ ${result.error}`
  if (result.suggestion) {
    output += `\n→ ${result.suggestion}`
  }
  return output
}

module.exports = {
  validate,
  formatError,
  validationRules
}
