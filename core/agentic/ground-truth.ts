/**
 * Ground Truth
 * Verifies actual state before critical operations.
 *
 * OPTIMIZATION (P1.3): Anti-Hallucination Pattern
 * - Reads actual files before assuming state
 * - Compares expected vs actual state
 * - Provides specific warnings for mismatches
 * - Logs verification results for debugging
 *
 * Source: Devin, Cursor, Augment Code patterns
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

import type { GroundTruthContext, VerificationResult, Verifier } from '../types'

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format duration from milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Format verification warnings for display
 */
export function formatWarnings(result: VerificationResult): string | null {
  if (result.verified || result.warnings.length === 0) {
    return null
  }

  let output = '  Ground Truth Warnings:\n'
  result.warnings.forEach((w) => {
    output += `  - ${w}\n`
  })

  if (result.recommendations.length > 0) {
    output += '\nRecommendations:\n'
    result.recommendations.forEach((r) => {
      output += `  -> ${r}\n`
    })
  }

  return output
}

// =============================================================================
// Verifiers
// =============================================================================

/**
 * Done Command Verifier
 * Verify task is actually complete-able
 */
export async function verifyDone(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Verify now.md exists and has real content
  const nowPath = context.paths.now
  try {
    const nowContent = await fs.readFile(nowPath, 'utf-8')
    actual.nowExists = true
    actual.nowContent = nowContent.trim()
    actual.nowLength = nowContent.length

    // Check for placeholder content
    if (nowContent.includes('No current task') || nowContent.match(/^#\s*NOW\s*$/m)) {
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
        actual.durationFormatted = formatDuration(actual.durationMs as number)
      }
    }
  } catch {
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
    recommendations,
  }
}

/**
 * Ship Command Verifier
 * Verify feature is ready to ship
 */
export async function verifyShip(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check for uncommitted changes
  try {
    const gitStatus = execSync('git status --porcelain', {
      cwd: context.projectPath,
      encoding: 'utf-8',
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
    recommendations,
  }
}

/**
 * Feature Command Verifier
 * Verify feature can be added
 */
export async function verifyFeature(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check next.md capacity
  const nextPath = context.paths.next
  try {
    const nextContent = await fs.readFile(nextPath, 'utf-8')
    actual.nextExists = true
    const tasks = nextContent.match(/- \[[ x]\]/g) || []
    actual.taskCount = tasks.length
    actual.pendingTasks = (nextContent.match(/- \[ \]/g) || []).length

    if ((actual.taskCount as number) >= 90) {
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
    actual.hasActiveTask = nowContent.trim().length > 0 && !nowContent.includes('No current task')

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
    recommendations,
  }
}

/**
 * Now Command Verifier
 * Verify task can be set (anti-hallucination: warn if replacing)
 */
export async function verifyNow(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if there's already an active task
  const nowPath = context.paths.now
  try {
    const nowContent = await fs.readFile(nowPath, 'utf-8')
    actual.nowExists = true
    actual.nowContent = nowContent.trim()

    const hasRealTask =
      nowContent.trim().length > 0 && !nowContent.includes('No current task') && !nowContent.match(/^#\s*NOW\s*$/m)

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
    recommendations,
  }
}

/**
 * Init Command Verifier
 * Verify project can be initialized
 */
export async function verifyInit(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

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
  const globalPath = path.join(os.homedir(), '.prjct-cli')
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
    recommendations,
  }
}

/**
 * Sync Command Verifier
 * Verify sync can proceed
 */
export async function verifySync(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

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
  const projectId = (actual.config as { projectId?: string })?.projectId
  const globalProjectPath = path.join(os.homedir(), '.prjct-cli/projects', projectId || '')
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
    recommendations,
  }
}

/**
 * Analyze Command Verifier
 * Verify analysis can proceed
 */
export async function verifyAnalyze(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check if project has recognizable structure
  const files = ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Gemfile', 'pom.xml']
  actual.detectedFiles = []

  for (const file of files) {
    try {
      await fs.access(path.join(context.projectPath, file))
      ;(actual.detectedFiles as string[]).push(file)
    } catch {
      // File doesn't exist
    }
  }

  if ((actual.detectedFiles as string[]).length === 0) {
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
        ;(actual.detectedSrcDirs as string[]).push(dir)
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return {
    verified: true, // Analysis can always proceed, even with warnings
    actual,
    warnings,
    recommendations,
  }
}

/**
 * Spec Command Verifier
 * Verify spec can be created
 */
export async function verifySpec(context: GroundTruthContext): Promise<VerificationResult> {
  const warnings: string[] = []
  const recommendations: string[] = []
  const actual: Record<string, unknown> = {}

  // 1. Check specs directory exists
  const specsPath = context.paths.specs
  try {
    await fs.access(specsPath)
    actual.specsExists = true

    // List existing specs
    const files = await fs.readdir(specsPath)
    actual.existingSpecs = files.filter((f) => f.endsWith('.md'))
    actual.specCount = (actual.existingSpecs as string[]).length
  } catch {
    actual.specsExists = false
    actual.specCount = 0
  }

  // 2. Check for duplicate spec name
  const featureName = context.params.feature || context.params.name || context.params.description
  if (featureName && actual.existingSpecs) {
    const slug = featureName.toLowerCase().replace(/\s+/g, '-')
    if ((actual.existingSpecs as string[]).includes(`${slug}.md`)) {
      warnings.push(`Spec "${featureName}" already exists`)
      recommendations.push('Use a different name or edit existing spec')
    }
  }

  return {
    verified: warnings.length === 0,
    actual,
    warnings,
    recommendations,
  }
}

/**
 * Command-specific ground truth verifiers
 */
export const verifiers: Record<string, Verifier> = {
  done: verifyDone,
  ship: verifyShip,
  feature: verifyFeature,
  now: verifyNow,
  init: verifyInit,
  sync: verifySync,
  analyze: verifyAnalyze,
  spec: verifySpec,
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Verify ground truth before command execution
 */
export async function verify(
  commandName: string,
  context: GroundTruthContext,
  state: unknown
): Promise<VerificationResult> {
  const verifier = verifiers[commandName]

  if (!verifier) {
    // No specific verification needed
    return {
      verified: true,
      actual: {},
      warnings: [],
      recommendations: [],
    }
  }

  try {
    return await verifier(context, state)
  } catch (error) {
    return {
      verified: false,
      actual: {},
      warnings: [`Verification error: ${(error as Error).message}`],
      recommendations: ['Check file permissions and project configuration'],
    }
  }
}

/**
 * Prepare command by verifying ground truth
 * Returns enhanced context with verification results
 */
export async function prepareCommand(commandName: string, context: GroundTruthContext, state: unknown) {
  const verification = await verify(commandName, context, state)

  return {
    ...context,
    groundTruth: {
      ...verification,
      verifiedAt: new Date().toISOString(),
      command: commandName,
    },
  }
}

/**
 * Check if command requires ground truth verification
 */
export function requiresVerification(commandName: string): boolean {
  // ANTI-HALLUCINATION: Expanded verification for more commands
  return ['done', 'ship', 'feature', 'spec', 'now', 'init', 'sync', 'analyze'].includes(commandName)
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  verify,
  prepareCommand,
  requiresVerification,
  verifiers,
  formatWarnings,
}
