/**
 * Think Blocks - Devin Pattern Implementation
 *
 * P3.1: Advanced reasoning layer that triggers <think> blocks
 * in specific situations to prevent hallucination and improve decisions.
 *
 * WHEN TO THINK (Devin's rules):
 * 1. Before critical git/GitHub decisions (branch, PR, merge)
 * 2. When transitioning from exploration to editing
 * 3. Before reporting task completion to user
 * 4. When there's no clear next step
 * 5. When encountering unexpected difficulties
 * 6. When tests/CI fail unexpectedly
 *
 * Source: Devin AI system prompt
 */

const fs = require('fs').promises

/**
 * Think trigger types and their conditions
 */
const THINK_TRIGGERS = {
  // Git/GitHub critical decisions
  GIT_DECISION: {
    id: 'git_decision',
    description: 'Before critical git operations',
    commands: ['ship', 'git'],
    conditions: ['has_uncommitted', 'branch_decision', 'merge_conflict'],
    priority: 1
  },

  // Transitioning from exploration to action
  EXPLORE_TO_EDIT: {
    id: 'explore_to_edit',
    description: 'Transitioning from reading to editing',
    commands: ['feature', 'spec', 'design'],
    conditions: ['first_edit', 'complex_change'],
    priority: 2
  },

  // Before reporting completion
  REPORT_COMPLETE: {
    id: 'report_complete',
    description: 'Before marking task as done',
    commands: ['done', 'ship'],
    conditions: ['task_complete', 'feature_ship'],
    priority: 1
  },

  // Unclear next step
  UNCLEAR_NEXT: {
    id: 'unclear_next',
    description: 'No clear next action',
    commands: ['next', 'help', 'suggest'],
    conditions: ['empty_queue', 'ambiguous_state'],
    priority: 3
  },

  // Unexpected difficulties
  UNEXPECTED_ERROR: {
    id: 'unexpected_error',
    description: 'Something went wrong unexpectedly',
    commands: ['*'],
    conditions: ['test_fail', 'ci_fail', 'repeated_error'],
    priority: 1
  },

  // Complex feature analysis
  COMPLEX_ANALYSIS: {
    id: 'complex_analysis',
    description: 'Analyzing complex feature or system',
    commands: ['analyze', 'spec', 'feature'],
    conditions: ['multi_file', 'architecture_change'],
    priority: 2
  }
}

/**
 * Think block generator
 */
class ThinkBlocks {
  constructor() {
    this.triggers = THINK_TRIGGERS
    this.thinkHistory = []
    this.maxHistory = 50
  }

  /**
   * Detect if current context requires a think block
   * @param {string} commandName - Command being executed
   * @param {Object} context - Execution context
   * @param {Object} state - Current state
   * @returns {Object|null} Think trigger if applicable
   */
  detectTrigger(commandName, context, state) {
    const applicableTriggers = []

    for (const [, trigger] of Object.entries(this.triggers)) {
      // Check if command matches
      const commandMatches =
        trigger.commands.includes('*') ||
        trigger.commands.includes(commandName)

      if (!commandMatches) continue

      // Check conditions
      const conditionsMet = this._checkConditions(trigger.conditions, context, state)

      if (conditionsMet.length > 0) {
        applicableTriggers.push({
          ...trigger,
          metConditions: conditionsMet
        })
      }
    }

    // Return highest priority trigger
    if (applicableTriggers.length === 0) return null

    applicableTriggers.sort((a, b) => a.priority - b.priority)
    return applicableTriggers[0]
  }

  /**
   * Check which conditions are met
   * @private
   */
  _checkConditions(conditions, context, state) {
    const met = []

    for (const condition of conditions) {
      const checker = this._getConditionChecker(condition)
      if (checker && checker(context, state)) {
        met.push(condition)
      }
    }

    return met
  }

  /**
   * Get condition checker function
   * @private
   */
  _getConditionChecker(condition) {
    const checkers = {
      // Git conditions
      has_uncommitted: (ctx) => ctx.groundTruth?.actual?.hasUncommittedChanges,
      branch_decision: (ctx) => ctx.params?.branch || ctx.needsBranch,
      merge_conflict: (ctx) => ctx.groundTruth?.actual?.hasMergeConflict,

      // State conditions
      task_complete: (ctx, state) => state.now && state.now.trim() !== '',
      feature_ship: (ctx) => ctx.params?.feature || ctx.params?.description,
      empty_queue: (ctx, state) => !state.next || state.next.trim() === '',
      ambiguous_state: (ctx, state) => !state.now && !state.next,

      // Complexity conditions
      first_edit: (ctx) => ctx.isFirstEdit,
      complex_change: (ctx) => ctx.params?.complex || ctx.filesAffected > 5,
      multi_file: (ctx) => ctx.filesAffected > 3,
      architecture_change: (ctx, state) => {
        const desc = ctx.params?.description?.toLowerCase() || ''
        return desc.includes('refactor') ||
               desc.includes('architecture') ||
               desc.includes('migrate')
      },

      // Error conditions
      test_fail: (ctx) => ctx.groundTruth?.actual?.testsFailed,
      ci_fail: (ctx) => ctx.groundTruth?.actual?.ciFailed,
      repeated_error: (ctx) => ctx.errorCount > 2
    }

    return checkers[condition]
  }

  /**
   * Generate a think block for the given trigger
   * @param {Object} trigger - The triggered think condition
   * @param {string} commandName - Command being executed
   * @param {Object} context - Execution context
   * @param {Object} state - Current state
   * @returns {Object} Think block content
   */
  async generate(trigger, commandName, context, state) {
    const thinkBlock = {
      id: `think_${Date.now()}`,
      trigger: trigger.id,
      command: commandName,
      timestamp: new Date().toISOString(),
      questions: [],
      observations: [],
      conclusions: [],
      plan: [],
      confidence: 0
    }

    // Generate questions based on trigger type
    const generator = this._getThinkGenerator(trigger.id)
    if (generator) {
      const content = await generator.call(this, context, state, trigger)
      Object.assign(thinkBlock, content)
    }

    // Calculate confidence
    thinkBlock.confidence = this._calculateConfidence(thinkBlock)

    // Add to history
    this._addToHistory(thinkBlock)

    return thinkBlock
  }

  /**
   * Get think generator for trigger type
   * @private
   */
  _getThinkGenerator(triggerId) {
    const generators = {
      git_decision: this._thinkGitDecision,
      explore_to_edit: this._thinkExploreToEdit,
      report_complete: this._thinkReportComplete,
      unclear_next: this._thinkUnclearNext,
      unexpected_error: this._thinkUnexpectedError,
      complex_analysis: this._thinkComplexAnalysis
    }
    return generators[triggerId]
  }

  /**
   * Think: Git Decision
   * @private
   */
  async _thinkGitDecision(context, state, trigger) {
    const questions = [
      'What git operation am I about to perform?',
      'Are there uncommitted changes that should be included?',
      'What branch should this go on?',
      'Should I create a PR or commit directly?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    // Check uncommitted changes
    if (context.groundTruth?.actual?.hasUncommittedChanges) {
      observations.push(`Found ${context.groundTruth.actual.uncommittedFiles} uncommitted files`)
      conclusions.push('Should commit changes before proceeding')
      plan.push('Stage relevant changes')
      plan.push('Create commit with prjct footer')
    } else {
      observations.push('No uncommitted changes')
    }

    // Check branch
    if (context.groundTruth?.actual?.currentBranch) {
      observations.push(`Current branch: ${context.groundTruth.actual.currentBranch}`)
      if (context.groundTruth.actual.currentBranch === 'main') {
        conclusions.push('On main branch - consider feature branch for safety')
      }
    }

    // Version check
    if (context.groundTruth?.actual?.currentVersion) {
      observations.push(`Current version: ${context.groundTruth.actual.currentVersion}`)
      if (trigger.metConditions.includes('feature_ship')) {
        conclusions.push('May need version bump')
        plan.push('Check if version bump needed')
      }
    }

    plan.push('Execute git operation')
    plan.push('Verify success')

    return { questions, observations, conclusions, plan }
  }

  /**
   * Think: Explore to Edit transition
   * @private
   */
  async _thinkExploreToEdit(context, state, trigger) {
    const questions = [
      'What have I learned from exploring the codebase?',
      'Am I confident about the changes needed?',
      'What files will be affected?',
      'Are there any risks or edge cases?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    // Feature analysis
    const featureDesc = context.params?.description || context.params?.feature
    if (featureDesc) {
      observations.push(`Feature: "${featureDesc}"`)

      // Complexity assessment
      const complexKeywords = ['auth', 'payment', 'database', 'refactor', 'migrate', 'security']
      const isComplex = complexKeywords.some(kw => featureDesc.toLowerCase().includes(kw))

      if (isComplex) {
        conclusions.push('This is a complex feature - proceed carefully')
        plan.push('Create spec document first')
        plan.push('Break into small tasks (20-30 min each)')
      }
    }

    // Files affected
    if (context.filesAffected) {
      observations.push(`Estimated files affected: ${context.filesAffected}`)
      if (context.filesAffected > 5) {
        conclusions.push('Multiple files affected - consider incremental approach')
      }
    }

    plan.push('Document design decision')
    plan.push('Start with smallest change first')
    plan.push('Test after each change')

    return { questions, observations, conclusions, plan }
  }

  /**
   * Think: Report Complete
   * @private
   */
  async _thinkReportComplete(context, state, trigger) {
    const questions = [
      'Is the task actually complete?',
      'Have all acceptance criteria been met?',
      'Are there any tests I should run?',
      'Is the code ready for review?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    // Check current task
    if (state.now) {
      const taskName = this._extractTaskName(state.now)
      observations.push(`Current task: "${taskName}"`)

      // Check for started time
      const startMatch = state.now.match(/Started:\s*(.+)/i)
      if (startMatch) {
        const duration = this._calculateDuration(startMatch[1])
        observations.push(`Duration: ${duration}`)
      }
    }

    // Ground truth verification
    if (context.groundTruth?.verified === false) {
      conclusions.push('Ground truth verification found issues')
      context.groundTruth.warnings?.forEach(w => {
        conclusions.push(`Warning: ${w}`)
      })
    } else {
      conclusions.push('Ground truth verification passed')
    }

    // Check for tests
    if (context.groundTruth?.actual?.hasTestScript) {
      observations.push('Project has tests')
      plan.push('Run tests to verify')
    }

    plan.push('Mark task complete')
    plan.push('Update metrics')
    plan.push('Suggest next task')

    return { questions, observations, conclusions, plan }
  }

  /**
   * Think: Unclear Next Step
   * @private
   */
  async _thinkUnclearNext(context, state, trigger) {
    const questions = [
      'What is the current project state?',
      'What was the last completed task?',
      'Are there any pending items in the queue?',
      'What should the user focus on?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    // Check queue
    if (!state.next || state.next.trim() === '') {
      observations.push('Queue is empty')
      conclusions.push('User needs to add tasks or features')
      plan.push('Suggest /p:feature or /p:idea')
    } else {
      const taskCount = (state.next.match(/- \[ \]/g) || []).length
      observations.push(`Queue has ${taskCount} pending tasks`)
      plan.push('Show top priority task')
      plan.push('Suggest starting with /p:now')
    }

    // Check roadmap
    if (state.roadmap && state.roadmap.trim() !== '') {
      observations.push('Roadmap exists')
      plan.push('Check roadmap for planned features')
    }

    // Check ideas
    if (state.ideas && state.ideas.trim() !== '') {
      observations.push('Ideas backlog exists')
      plan.push('Review ideas for inspiration')
    }

    return { questions, observations, conclusions, plan }
  }

  /**
   * Think: Unexpected Error
   * @private
   */
  async _thinkUnexpectedError(context, state, trigger) {
    const questions = [
      'What error occurred?',
      'Is this a known issue?',
      'Have I seen this pattern before?',
      'What are the possible solutions?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    // Error analysis
    if (context.lastError) {
      observations.push(`Error: ${context.lastError.message || context.lastError}`)

      // Pattern matching
      const errorPatterns = {
        permission: /permission|EACCES|denied/i,
        not_found: /not found|ENOENT|missing/i,
        syntax: /syntax|parse|unexpected/i,
        network: /network|ECONNREFUSED|timeout/i,
        git: /git|merge|conflict/i
      }

      for (const [type, pattern] of Object.entries(errorPatterns)) {
        if (pattern.test(context.lastError.message || context.lastError)) {
          conclusions.push(`Error type: ${type}`)
          break
        }
      }
    }

    // Error count
    if (context.errorCount > 2) {
      conclusions.push(`Repeated error (${context.errorCount} times) - may need different approach`)
      plan.push('Consider alternative approach')
      plan.push('Ask user for help if stuck')
    }

    plan.push('Analyze error details')
    plan.push('Try recovery action')
    plan.push('Report to user if unresolvable')

    return { questions, observations, conclusions, plan }
  }

  /**
   * Think: Complex Analysis
   * @private
   */
  async _thinkComplexAnalysis(context, state, trigger) {
    const questions = [
      'What is the scope of this analysis?',
      'What components are involved?',
      'Are there dependencies between components?',
      'What is the best order to proceed?'
    ]

    const observations = []
    const conclusions = []
    const plan = []

    const desc = context.params?.description || context.params?.feature || ''

    // Scope assessment
    if (desc.includes('refactor')) {
      observations.push('This is a refactoring task')
      conclusions.push('Need to understand existing code first')
      plan.push('Map current architecture')
      plan.push('Identify affected components')
    }

    if (desc.includes('migrate')) {
      observations.push('This is a migration task')
      conclusions.push('Need migration strategy with rollback plan')
      plan.push('Document current state')
      plan.push('Plan incremental migration')
      plan.push('Create rollback strategy')
    }

    if (desc.includes('architecture')) {
      observations.push('This involves architecture changes')
      conclusions.push('High-impact change - needs careful planning')
      plan.push('Create architecture diagram')
      plan.push('Get user approval before proceeding')
    }

    // Default plan additions
    plan.push('Break into small incremental changes')
    plan.push('Test after each change')
    plan.push('Document decisions')

    return { questions, observations, conclusions, plan }
  }

  /**
   * Format think block for output
   * @param {Object} thinkBlock - Generated think block
   * @param {boolean} verbose - Whether to show full output
   * @returns {string}
   */
  format(thinkBlock, verbose = false) {
    if (!thinkBlock) return ''

    const lines = ['<think>']

    // Questions (only in verbose)
    if (verbose && thinkBlock.questions.length > 0) {
      lines.push('QUESTIONS:')
      thinkBlock.questions.forEach(q => lines.push(`  ? ${q}`))
      lines.push('')
    }

    // Observations
    if (thinkBlock.observations.length > 0) {
      lines.push('OBSERVATIONS:')
      thinkBlock.observations.forEach(o => lines.push(`  • ${o}`))
      lines.push('')
    }

    // Conclusions
    if (thinkBlock.conclusions.length > 0) {
      lines.push('CONCLUSIONS:')
      thinkBlock.conclusions.forEach(c => lines.push(`  → ${c}`))
      lines.push('')
    }

    // Plan
    if (thinkBlock.plan.length > 0) {
      lines.push('PLAN:')
      thinkBlock.plan.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`))
    }

    lines.push('</think>')
    lines.push(`Confidence: ${Math.round(thinkBlock.confidence * 100)}%`)

    return lines.join('\n')
  }

  /**
   * Format compact version for prompts
   * @param {Object} thinkBlock
   * @returns {string}
   */
  formatCompact(thinkBlock) {
    if (!thinkBlock) return ''

    const parts = []

    if (thinkBlock.conclusions.length > 0) {
      parts.push(`Conclusions: ${thinkBlock.conclusions.join('; ')}`)
    }

    if (thinkBlock.plan.length > 0) {
      parts.push(`Plan: ${thinkBlock.plan.slice(0, 3).join(' → ')}`)
    }

    return `<think>${parts.join(' | ')}</think>`
  }

  // Helper methods

  _extractTaskName(nowContent) {
    if (!nowContent) return ''
    const lines = nowContent.split('\n')
    for (const line of lines) {
      if (line.startsWith('**') || line.startsWith('# ')) {
        return line.replace(/[*#]/g, '').trim()
      }
    }
    return nowContent.substring(0, 50).trim()
  }

  _calculateDuration(startTime) {
    try {
      const start = new Date(startTime)
      const now = new Date()
      const ms = now - start
      const hours = Math.floor(ms / (1000 * 60 * 60))
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    } catch {
      return 'unknown'
    }
  }

  _calculateConfidence(thinkBlock) {
    let score = 0.5 // Base confidence

    // More observations = more confidence
    score += Math.min(thinkBlock.observations.length * 0.1, 0.3)

    // Clear conclusions = more confidence
    score += Math.min(thinkBlock.conclusions.length * 0.1, 0.2)

    // Having a plan = more confidence
    if (thinkBlock.plan.length > 0) score += 0.1

    return Math.min(score, 1.0)
  }

  _addToHistory(thinkBlock) {
    this.thinkHistory.unshift(thinkBlock)
    if (this.thinkHistory.length > this.maxHistory) {
      this.thinkHistory.pop()
    }
  }

  /**
   * Get recent think history
   * @param {number} limit
   * @returns {Array}
   */
  getHistory(limit = 10) {
    return this.thinkHistory.slice(0, limit)
  }

  /**
   * Check if we should think based on command and context
   * @param {string} commandName
   * @param {Object} context
   * @param {Object} state
   * @returns {boolean}
   */
  shouldThink(commandName, context, state) {
    return this.detectTrigger(commandName, context, state) !== null
  }
}

module.exports = new ThinkBlocks()
