/**
 * Ground Truth Verification
 * Verifies actual state before critical operations
 *
 * OPTIMIZATION (P1.3): Anti-Hallucination Pattern
 * - Reads actual files before assuming state
 * - Compares expected vs actual state
 * - Provides specific warnings for mismatches
 * - Logs verification results for debugging
 *
 * Source: Devin, Cursor, Augment Code patterns
 */

const fs = require('fs').promises
const path = require('path')
const contextBuilder = require('./context-builder')

/**
 * Ground truth verification result
 * @typedef {Object} VerificationResult
 * @property {boolean} verified - Whether state matches expectations
 * @property {Object} actual - Actual state from files
 * @property {Object} expected - Expected state (if provided)
 * @property {string[]} warnings - Warnings about state mismatches
 * @property {string[]} recommendations - Suggested actions
 */

/**
 * Command-specific ground truth verifiers
 */
const verifiers = {
  /**
   * /p:done - Verify task is actually complete-able
   */
  async done(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Verify now.md exists and has real content
    const nowPath = context.paths.now
    try {
      const nowContent = await fs.readFile(nowPath, 'utf-8')
      actual.nowExists = true
      actual.nowContent = nowContent.trim()
      actual.nowLength = nowContent.length

      // Check for placeholder content
      if (nowContent.includes('No current task') ||
          nowContent.match(/^#\s*NOW\s*$/m)) {
        warnings.push('now.md appears to be empty or placeholder')
        recommendations.push('Start a task first with /p:now "task"')
      }

      // Check for task metadata (started time)
      const startedMatch = nowContent.match(/Started:\s*(.+)/i)
      if (startedMatch) {
        actual.startedAt = startedMatch[1]
        // Calculate duration
        const startTime = new Date(startedMatch[1])
        if (!isNaN(startTime.getTime())) {
          actual.durationMs = Date.now() - startTime.getTime()
          actual.durationFormatted = formatDuration(actual.durationMs)
        }
      }
    } catch (error) {
      actual.nowExists = false
      warnings.push('now.md does not exist')
      recommendations.push('Create a task with /p:now "task"')
    }

    // 2. Verify next.md for auto-start
    const nextPath = context.paths.next
    try {
      const nextContent = await fs.readFile(nextPath, 'utf-8')
      actual.nextExists = true
      const tasks = nextContent.match(/- \[ \]/g) || []
      actual.pendingTasks = tasks.length
    } catch {
      actual.nextExists = false
      actual.pendingTasks = 0
    }

    // 3. Verify metrics.md is writable
    const metricsPath = context.paths.metrics
    try {
      await fs.access(path.dirname(metricsPath), fs.constants.W_OK)
      actual.metricsWritable = true
    } catch {
      actual.metricsWritable = false
      warnings.push('Cannot write to metrics directory')
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:ship - Verify feature is ready to ship
   */
  async ship(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check for uncommitted changes
    try {
      const { execSync } = require('child_process')
      const gitStatus = execSync('git status --porcelain', {
        cwd: context.projectPath,
        encoding: 'utf-8'
      })
      actual.hasUncommittedChanges = gitStatus.trim().length > 0
      actual.uncommittedFiles = gitStatus.trim().split('\n').filter(Boolean).length

      if (actual.hasUncommittedChanges) {
        warnings.push(`${actual.uncommittedFiles} uncommitted file(s)`)
        recommendations.push('Commit changes before shipping')
      }
    } catch {
      actual.gitAvailable = false
      // Not a git repo or git not available - not a blocker
    }

    // 2. Check for package.json version (if exists)
    const pkgPath = path.join(context.projectPath, 'package.json')
    try {
      const pkgContent = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent)
      actual.currentVersion = pkg.version
      actual.hasPackageJson = true
    } catch {
      actual.hasPackageJson = false
    }

    // 3. Check shipped.md for duplicate feature names
    const shippedPath = context.paths.shipped
    try {
      const shippedContent = await fs.readFile(shippedPath, 'utf-8')
      actual.shippedExists = true

      // Check if feature name already shipped today
      const featureName = context.params.feature || context.params.description
      if (featureName) {
        const today = new Date().toISOString().split('T')[0]
        const todayPattern = new RegExp(`${today}.*${escapeRegex(featureName)}`, 'i')
        if (todayPattern.test(shippedContent)) {
          warnings.push(`Feature "${featureName}" already shipped today`)
          recommendations.push('Use a different feature name or skip /p:ship')
        }
      }
    } catch {
      actual.shippedExists = false
    }

    // 4. Check for test failures (if test script exists)
    if (actual.hasPackageJson) {
      try {
        const pkgContent = await fs.readFile(pkgPath, 'utf-8')
        const pkg = JSON.parse(pkgContent)
        actual.hasTestScript = !!pkg.scripts?.test
        // Note: We don't run tests here, just check if they exist
        // Running tests is the user's responsibility
      } catch {
        actual.hasTestScript = false
      }
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:feature - Verify feature can be added
   */
  async feature(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check next.md capacity
    const nextPath = context.paths.next
    try {
      const nextContent = await fs.readFile(nextPath, 'utf-8')
      actual.nextExists = true
      const tasks = nextContent.match(/- \[[ x]\]/g) || []
      actual.taskCount = tasks.length
      actual.pendingTasks = (nextContent.match(/- \[ \]/g) || []).length

      if (actual.taskCount >= 90) {
        warnings.push(`Queue nearly full (${actual.taskCount}/100 tasks)`)
        recommendations.push('Complete some tasks before adding more')
      }
    } catch {
      actual.nextExists = false
      actual.taskCount = 0
    }

    // 2. Check roadmap.md for duplicate features
    const roadmapPath = context.paths.roadmap
    try {
      const roadmapContent = await fs.readFile(roadmapPath, 'utf-8')
      actual.roadmapExists = true

      const featureName = context.params.description || context.params.feature
      if (featureName) {
        const featurePattern = new RegExp(escapeRegex(featureName), 'i')
        if (featurePattern.test(roadmapContent)) {
          warnings.push(`Feature "${featureName}" may already exist in roadmap`)
          recommendations.push('Check roadmap for duplicates with /p:roadmap')
        }
      }
    } catch {
      actual.roadmapExists = false
    }

    // 3. Check if there's an active task (should complete first?)
    const nowPath = context.paths.now
    try {
      const nowContent = await fs.readFile(nowPath, 'utf-8')
      actual.hasActiveTask = nowContent.trim().length > 0 &&
                            !nowContent.includes('No current task')

      if (actual.hasActiveTask) {
        recommendations.push('Consider completing current task first with /p:done')
      }
    } catch {
      actual.hasActiveTask = false
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:now - Verify task can be set (anti-hallucination: warn if replacing)
   */
  async now(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check if there's already an active task
    const nowPath = context.paths.now
    try {
      const nowContent = await fs.readFile(nowPath, 'utf-8')
      actual.nowExists = true
      actual.nowContent = nowContent.trim()

      const hasRealTask = nowContent.trim().length > 0 &&
                         !nowContent.includes('No current task') &&
                         !nowContent.match(/^#\s*NOW\s*$/m)

      actual.hasActiveTask = hasRealTask

      // ANTI-HALLUCINATION: Warn if replacing existing task
      if (hasRealTask && context.params.task) {
        const taskPreview = nowContent.substring(0, 50).replace(/\n/g, ' ')
        warnings.push(`Replacing existing task: "${taskPreview}..."`)
        recommendations.push('Use /p:done first to track completion')
      }
    } catch {
      actual.nowExists = false
      actual.hasActiveTask = false
    }

    // 2. Check next.md for available tasks
    const nextPath = context.paths.next
    try {
      const nextContent = await fs.readFile(nextPath, 'utf-8')
      const pendingTasks = (nextContent.match(/- \[ \]/g) || []).length
      actual.pendingTasks = pendingTasks

      if (!context.params.task && pendingTasks > 0) {
        recommendations.push(`${pendingTasks} tasks available in queue`)
      }
    } catch {
      actual.pendingTasks = 0
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:init - Verify project can be initialized
   */
  async init(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check if already initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      const configContent = await fs.readFile(configPath, 'utf-8')
      actual.alreadyInitialized = true
      actual.existingConfig = JSON.parse(configContent)
      warnings.push('Project already initialized')
      recommendations.push('Use /p:analyze to refresh analysis or delete .prjct/ to reinitialize')
    } catch {
      actual.alreadyInitialized = false
    }

    // 2. Check if global storage path is writable
    const globalPath = path.join(require('os').homedir(), '.prjct-cli')
    try {
      await fs.access(globalPath, fs.constants.W_OK)
      actual.globalPathWritable = true
    } catch {
      try {
        // Try to create it
        await fs.mkdir(globalPath, { recursive: true })
        actual.globalPathWritable = true
        actual.globalPathCreated = true
      } catch {
        actual.globalPathWritable = false
        warnings.push('Cannot write to ~/.prjct-cli')
        recommendations.push('Check directory permissions')
      }
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:sync - Verify sync can proceed
   */
  async sync(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check if project is initialized
    const configPath = path.join(context.projectPath, '.prjct/prjct.config.json')
    try {
      const configContent = await fs.readFile(configPath, 'utf-8')
      actual.hasConfig = true
      actual.config = JSON.parse(configContent)
    } catch {
      actual.hasConfig = false
      warnings.push('Project not initialized')
      recommendations.push('Run /p:init first')
      return { verified: false, actual, warnings, recommendations }
    }

    // 2. Check if global storage exists
    const projectId = actual.config.projectId
    const globalProjectPath = path.join(require('os').homedir(), '.prjct-cli/projects', projectId)
    try {
      await fs.access(globalProjectPath)
      actual.globalStorageExists = true
    } catch {
      actual.globalStorageExists = false
      warnings.push('Global storage missing')
      recommendations.push('Run /p:init to recreate')
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:analyze - Verify analysis can proceed
   */
  async analyze(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check if project has recognizable structure
    const files = ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Gemfile', 'pom.xml']
    actual.detectedFiles = []

    for (const file of files) {
      try {
        await fs.access(path.join(context.projectPath, file))
        actual.detectedFiles.push(file)
      } catch {
        // File doesn't exist
      }
    }

    if (actual.detectedFiles.length === 0) {
      warnings.push('No recognizable project files detected')
      recommendations.push('Analysis may be limited without package.json or similar')
    }

    // 2. Check for source directories
    const srcDirs = ['src', 'lib', 'app', 'core', 'components']
    actual.detectedSrcDirs = []

    for (const dir of srcDirs) {
      try {
        const stat = await fs.stat(path.join(context.projectPath, dir))
        if (stat.isDirectory()) {
          actual.detectedSrcDirs.push(dir)
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return {
      verified: true, // Analysis can always proceed, even with warnings
      actual,
      warnings,
      recommendations
    }
  },

  /**
   * /p:spec - Verify spec can be created
   */
  async spec(context, state) {
    const warnings = []
    const recommendations = []
    const actual = {}

    // 1. Check specs directory exists
    const specsPath = context.paths.specs
    try {
      await fs.access(specsPath)
      actual.specsExists = true

      // List existing specs
      const files = await fs.readdir(specsPath)
      actual.existingSpecs = files.filter(f => f.endsWith('.md'))
      actual.specCount = actual.existingSpecs.length
    } catch {
      actual.specsExists = false
      actual.specCount = 0
    }

    // 2. Check for duplicate spec name
    const featureName = context.params.feature || context.params.name || context.params.description
    if (featureName && actual.existingSpecs) {
      const slug = featureName.toLowerCase().replace(/\s+/g, '-')
      if (actual.existingSpecs.includes(`${slug}.md`)) {
        warnings.push(`Spec "${featureName}" already exists`)
        recommendations.push('Use a different name or edit existing spec')
      }
    }

    return {
      verified: warnings.length === 0,
      actual,
      warnings,
      recommendations
    }
  }
}

/**
 * Verify ground truth before command execution
 *
 * @param {string} commandName - Command to verify
 * @param {Object} context - Built context from contextBuilder
 * @param {Object} state - Current loaded state
 * @returns {Promise<VerificationResult>}
 */
async function verify(commandName, context, state) {
  const verifier = verifiers[commandName]

  if (!verifier) {
    // No specific verification needed
    return {
      verified: true,
      actual: {},
      warnings: [],
      recommendations: []
    }
  }

  try {
    return await verifier(context, state)
  } catch (error) {
    return {
      verified: false,
      actual: {},
      warnings: [`Verification error: ${error.message}`],
      recommendations: ['Check file permissions and project configuration']
    }
  }
}

/**
 * Prepare command by verifying ground truth
 * Returns enhanced context with verification results
 *
 * @param {string} commandName - Command name
 * @param {Object} context - Built context
 * @param {Object} state - Loaded state
 * @returns {Promise<Object>} Enhanced context with groundTruth
 */
async function prepareCommand(commandName, context, state) {
  const verification = await verify(commandName, context, state)

  return {
    ...context,
    groundTruth: {
      ...verification,
      verifiedAt: new Date().toISOString(),
      command: commandName
    }
  }
}

/**
 * Check if command requires ground truth verification
 * @param {string} commandName - Command name
 * @returns {boolean}
 */
function requiresVerification(commandName) {
  // ANTI-HALLUCINATION: Expanded verification for more commands
  return ['done', 'ship', 'feature', 'spec', 'now', 'init', 'sync', 'analyze'].includes(commandName)
}

/**
 * Format verification warnings for display
 * @param {VerificationResult} result - Verification result
 * @returns {string|null}
 */
function formatWarnings(result) {
  if (result.verified || result.warnings.length === 0) {
    return null
  }

  let output = '⚠️  Ground Truth Warnings:\n'
  result.warnings.forEach(w => {
    output += `  • ${w}\n`
  })

  if (result.recommendations.length > 0) {
    output += '\nRecommendations:\n'
    result.recommendations.forEach(r => {
      output += `  → ${r}\n`
    })
  }

  return output
}

// Helpers

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  verify,
  prepareCommand,
  requiresVerification,
  formatWarnings,
  verifiers
}
