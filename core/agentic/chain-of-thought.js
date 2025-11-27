/**
 * Chain of Thought Layer
 *
 * Adds internal reasoning for critical commands before execution.
 * Inspired by Devin's <think> blocks pattern.
 *
 * OPTIMIZATION (P2.2): Chain of Thought
 * - Internal reasoning for critical commands
 * - Visible reasoning in debug mode
 * - Ground truth verification before action
 *
 * Source: Devin pattern
 */

const memorySystem = require('./memory-system')

class ChainOfThought {
  constructor() {
    // Commands that require reasoning
    this.criticalCommands = ['ship', 'feature', 'analyze', 'sync', 'cleanup', 'init', 'spec']

    // Debug mode for visible reasoning
    this.debugMode = process.env.PRJCT_DEBUG === 'true'
  }

  /**
   * Check if command requires chain of thought
   * @param {string} commandName
   * @returns {boolean}
   */
  requiresReasoning(commandName) {
    return this.criticalCommands.includes(commandName)
  }

  /**
   * Generate reasoning chain for a command
   * @param {string} commandName
   * @param {Object} context
   * @param {Object} state
   * @returns {Promise<Object>} Reasoning result
   */
  async reason(commandName, context, state) {
    if (!this.requiresReasoning(commandName)) {
      return { skip: true, reason: 'Non-critical command' }
    }

    const reasoner = this._getReasonerForCommand(commandName)
    if (!reasoner) {
      return { skip: true, reason: 'No reasoner defined' }
    }

    const startTime = Date.now()
    const reasoning = await reasoner.call(this, context, state)

    return {
      command: commandName,
      reasoning,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get the appropriate reasoner for a command
   * @private
   */
  _getReasonerForCommand(commandName) {
    const reasoners = {
      ship: this._reasonShip,
      feature: this._reasonFeature,
      analyze: this._reasonAnalyze,
      sync: this._reasonSync,
      cleanup: this._reasonCleanup,
      init: this._reasonInit,
      spec: this._reasonSpec
    }
    return reasoners[commandName]
  }

  /**
   * Reasoning for /p:ship
   * @private
   */
  async _reasonShip(context, state) {
    const steps = []

    // Step 1: Verify current task
    steps.push({
      step: 'verify_task',
      question: 'Is there an active task to ship?',
      check: state.now && state.now.trim() !== '',
      result: state.now ? `Active: "${this._extractTaskName(state.now)}"` : 'No active task',
      pass: !!state.now && state.now.trim() !== ''
    })

    // Step 2: Check shipped history format
    steps.push({
      step: 'check_format',
      question: 'What format does shipped.md use?',
      check: true,
      result: state.shipped ? 'Found existing format' : 'New file, will use default',
      pass: true
    })

    // Step 3: Check version
    steps.push({
      step: 'check_version',
      question: 'What version should we use?',
      check: true,
      result: context.version || 'Will read from package.json',
      pass: true
    })

    // Step 4: Check for memory patterns
    const commitPattern = await memorySystem.getSmartDecision(
      context.projectId,
      'commit_footer'
    )
    steps.push({
      step: 'check_memory',
      question: 'Is there a learned commit pattern?',
      check: !!commitPattern,
      result: commitPattern ? `Pattern: "${commitPattern}"` : 'Will use default prjct footer',
      pass: true
    })

    // Step 5: Propose plan
    const plan = this._generateShipPlan(steps, context)

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan,
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:feature
   * @private
   */
  async _reasonFeature(context, state) {
    const steps = []

    // Step 1: Check if feature description provided
    const featureDesc = context.params?.description || context.params?.feature
    steps.push({
      step: 'check_description',
      question: 'Is feature description provided?',
      check: !!featureDesc,
      result: featureDesc ? `Feature: "${featureDesc}"` : 'No description - will show template',
      pass: true // Both modes are valid
    })

    // Step 2: Check roadmap state
    steps.push({
      step: 'check_roadmap',
      question: 'What is current roadmap state?',
      check: true,
      result: state.roadmap ? 'Roadmap exists' : 'No roadmap yet',
      pass: true
    })

    // Step 3: Check queue capacity
    const queueSize = this._countQueueItems(state.next)
    steps.push({
      step: 'check_queue',
      question: 'Is there room in the queue?',
      check: queueSize < 100,
      result: `Queue: ${queueSize}/100 tasks`,
      pass: queueSize < 100
    })

    // Step 4: Analyze impact/effort if description given
    if (featureDesc) {
      const analysis = this._analyzeFeature(featureDesc)
      steps.push({
        step: 'analyze_feature',
        question: 'What is estimated impact/effort?',
        check: true,
        result: `Impact: ${analysis.impact}, Effort: ${analysis.effort}`,
        pass: true
      })
    }

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: this._generateFeaturePlan(steps, featureDesc),
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:analyze
   * @private
   */
  async _reasonAnalyze(context, state) {
    const steps = []

    // Step 1: Check if analysis exists
    steps.push({
      step: 'check_existing',
      question: 'Does analysis already exist?',
      check: true,
      result: state.analysis ? 'Existing analysis found' : 'No previous analysis',
      pass: true
    })

    // Step 2: Check project structure
    steps.push({
      step: 'check_structure',
      question: 'Is project structure valid?',
      check: true,
      result: context.projectPath ? 'Valid project path' : 'No project path',
      pass: !!context.projectPath
    })

    // Step 3: Check agents directory
    steps.push({
      step: 'check_agents',
      question: 'Are agents generated?',
      check: true,
      result: 'Will regenerate based on analysis',
      pass: true
    })

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: ['Analyze codebase', 'Detect technologies', 'Generate specialized agents', 'Update context'],
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:sync
   * @private
   */
  async _reasonSync(_context, state) {
    const steps = []

    // Step 1: Check current state
    steps.push({
      step: 'check_state',
      question: 'What needs syncing?',
      check: true,
      result: 'Will sync agents, context, and metrics',
      pass: true
    })

    // Step 2: Check for stale data
    const isStale = !state.analysis || this._isDataStale(state)
    steps.push({
      step: 'check_stale',
      question: 'Is project data stale?',
      check: isStale,
      result: isStale ? 'Data is stale, will refresh' : 'Data is current',
      pass: true
    })

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: ['Refresh context', 'Update agents', 'Sync metrics'],
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:cleanup
   * @private
   */
  async _reasonCleanup(context, _state) {
    const steps = []

    // Step 1: Identify cleanup targets
    const cleanupType = context.params?.type || 'all'
    steps.push({
      step: 'identify_targets',
      question: 'What should be cleaned up?',
      check: true,
      result: `Cleanup type: ${cleanupType}`,
      pass: true
    })

    // Step 2: Check for safe cleanup
    steps.push({
      step: 'safety_check',
      question: 'Is cleanup safe to proceed?',
      check: true,
      result: 'Will only remove temp files and stale entries',
      pass: true
    })

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: ['Identify stale files', 'Archive old entries', 'Clean temp data'],
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:init
   * @private
   */
  async _reasonInit(context, _state) {
    const steps = []

    // Step 1: Check if already initialized
    steps.push({
      step: 'check_existing',
      question: 'Is project already initialized?',
      check: true,
      result: context.projectId ? 'Already initialized' : 'Not initialized',
      pass: true
    })

    // Step 2: Check for idea/description
    const idea = context.params?.idea || context.params?.description
    steps.push({
      step: 'check_idea',
      question: 'Is there a project idea?',
      check: !!idea,
      result: idea ? `Idea: "${idea}"` : 'No idea - will ask or analyze existing code',
      pass: true
    })

    // Step 3: Determine mode
    const mode = idea ? 'architect' : 'standard'
    steps.push({
      step: 'determine_mode',
      question: 'Which initialization mode?',
      check: true,
      result: `Mode: ${mode}`,
      pass: true
    })

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: mode === 'architect'
        ? ['Enter architect mode', 'Ask discovery questions', 'Generate plan', 'Create structure']
        : ['Create config', 'Initialize storage', 'Analyze existing code'],
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Reasoning for /p:spec
   * @private
   */
  async _reasonSpec(context, state) {
    const steps = []

    // Step 1: Check if feature name provided
    const featureName = context.params?.feature || context.params?.name || context.params?.description
    steps.push({
      step: 'check_feature',
      question: 'Is feature name provided?',
      check: !!featureName,
      result: featureName ? `Feature: "${featureName}"` : 'No feature - will show template',
      pass: true // Both modes valid
    })

    // Step 2: Check for existing spec
    if (featureName) {
      const slug = featureName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const specExists = state.specs && state.specs.includes(slug)
      steps.push({
        step: 'check_existing',
        question: 'Does spec already exist?',
        check: !specExists,
        result: specExists ? `Spec "${slug}.md" exists - will update` : 'New spec',
        pass: true
      })
    }

    // Step 3: Check queue capacity
    const queueSize = this._countQueueItems(state.next)
    steps.push({
      step: 'check_queue',
      question: 'Is there room for new tasks?',
      check: queueSize < 90,
      result: `Queue: ${queueSize}/100`,
      pass: queueSize < 90
    })

    // Step 4: Check complexity
    if (featureName) {
      const isComplex = this._isComplexFeature(featureName)
      steps.push({
        step: 'assess_complexity',
        question: 'Is this a complex feature?',
        check: true,
        result: isComplex ? 'Complex - spec recommended' : 'Simple - consider /p:feature',
        pass: true
      })
    }

    return {
      steps,
      allPassed: steps.every(s => s.pass),
      plan: featureName
        ? ['Analyze requirements', 'Propose design', 'Break into tasks', 'Request approval', 'Add to queue']
        : ['Show spec template', 'Guide through requirements'],
      confidence: this._calculateConfidence(steps)
    }
  }

  /**
   * Check if feature sounds complex
   * @private
   */
  _isComplexFeature(name) {
    const complexKeywords = [
      'authentication', 'auth', 'payment', 'integration', 'migration',
      'refactor', 'architecture', 'database', 'api', 'system',
      'security', 'performance', 'scale', 'redesign'
    ]
    const nameLower = name.toLowerCase()
    return complexKeywords.some(kw => nameLower.includes(kw))
  }

  /**
   * Format reasoning for output
   * @param {Object} reasoning
   * @returns {string}
   */
  formatReasoning(reasoning) {
    if (reasoning.skip) {
      return ''
    }

    const lines = ['<think>']

    reasoning.reasoning.steps.forEach(step => {
      const icon = step.pass ? '✓' : '✗'
      lines.push(`${icon} ${step.question}`)
      lines.push(`  → ${step.result}`)
    })

    if (reasoning.reasoning.plan) {
      lines.push('')
      lines.push('PLAN:')
      reasoning.reasoning.plan.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`)
      })
    }

    lines.push(`</think>`)
    lines.push(`Confidence: ${Math.round(reasoning.reasoning.confidence * 100)}%`)

    return lines.join('\n')
  }

  /**
   * Format for user-visible output (non-debug)
   * @param {Object} reasoning
   * @returns {string}
   */
  formatPlan(reasoning) {
    if (reasoning.skip || !reasoning.reasoning?.plan) {
      return ''
    }

    const lines = ['PLAN:']
    reasoning.reasoning.plan.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`)
    })

    if (!reasoning.reasoning.allPassed) {
      const failed = reasoning.reasoning.steps.filter(s => !s.pass)
      lines.push('')
      lines.push('⚠️  Issues:')
      failed.forEach(s => {
        lines.push(`  - ${s.result}`)
      })
    }

    return lines.join('\n')
  }

  // Helper methods

  _extractTaskName(nowContent) {
    if (!nowContent) return ''
    const lines = nowContent.split('\n')
    for (const line of lines) {
      if (line.startsWith('**') && line.includes('**')) {
        return line.replace(/\*\*/g, '').trim()
      }
      if (line.startsWith('# ')) {
        return line.replace('# ', '').trim()
      }
    }
    return nowContent.substring(0, 50).trim()
  }

  _countQueueItems(nextContent) {
    if (!nextContent) return 0
    const matches = nextContent.match(/- \[[ x]\]/g)
    return matches ? matches.length : 0
  }

  _analyzeFeature(description) {
    const desc = description.toLowerCase()

    // Simple heuristics for impact/effort
    let impact = 'medium'
    let effort = 'medium'

    if (desc.includes('critical') || desc.includes('urgent') || desc.includes('security')) {
      impact = 'high'
    } else if (desc.includes('minor') || desc.includes('small') || desc.includes('typo')) {
      impact = 'low'
    }

    if (desc.includes('refactor') || desc.includes('rewrite') || desc.includes('migrate')) {
      effort = 'high'
    } else if (desc.includes('fix') || desc.includes('update') || desc.includes('add')) {
      effort = 'low'
    }

    return { impact, effort }
  }

  _isDataStale(state) {
    // Consider data stale if analysis is more than 24 hours old
    // This is a placeholder - actual implementation would check timestamps
    return !state.analysis
  }

  _generateShipPlan(steps, context) {
    const plan = []

    if (steps.find(s => s.step === 'verify_task')?.pass) {
      plan.push('Mark task complete')
    }

    plan.push('Update shipped.md')
    plan.push('Update metrics')

    if (context.params?.commit !== false) {
      plan.push('Create commit')
    }

    if (context.params?.push !== false) {
      plan.push('Push to remote')
    }

    return plan
  }

  _generateFeaturePlan(_steps, featureDesc) {
    if (!featureDesc) {
      return ['Show feature template', 'Wait for user input']
    }

    return [
      'Analyze feature value',
      'Estimate effort',
      'Break into tasks',
      'Add to roadmap',
      'Start first task'
    ]
  }

  _calculateConfidence(steps) {
    if (steps.length === 0) return 1.0

    const passed = steps.filter(s => s.pass).length
    return passed / steps.length
  }
}

module.exports = new ChainOfThought()
