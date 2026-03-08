/**
 * HooksService - Git hooks integration for auto-sync
 *
 * Manages git hooks that automatically sync prjct context on
 * commit and checkout. Supports multiple hook managers:
 * - lefthook
 * - husky
 * - direct .git/hooks/ scripts
 *
 * @see PRJ-128
 * @module services/hooks-service
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import configManager from '../infrastructure/config-manager'
import { prjctDb } from '../storage/database'
import { getErrorMessage } from '../types/fs'
import type { HookName, HookStrategy } from '../types/services.js'
import { fileExists } from '../utils/file-helper'
import out from '../utils/output'

interface HookConfig {
  enabled: boolean
  strategy: HookStrategy
  hooks: HookName[]
  installedAt?: string
}

interface HooksStatusResult {
  installed: boolean
  strategy: HookStrategy | null
  hooks: Array<{
    name: HookName
    installed: boolean
    path: string
  }>
  detectedManagers: HookStrategy[]
}

interface HooksInstallResult {
  success: boolean
  strategy: HookStrategy
  hooksInstalled: HookName[]
  error?: string
}

// ============================================================================
// HOOK SCRIPT TEMPLATES
// ============================================================================

/**
 * Shell script for post-commit hook
 * Runs prjct sync in quiet mode with rate limiting
 */
function getPostCommitScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-commit)
# Syncs project context after each commit
# Installed by: prjct hooks install

# Rate limit: skip if synced within last 30 seconds
LOCK_FILE="\${TMPDIR:-/tmp}/prjct-sync-$(pwd | md5sum 2>/dev/null | cut -d' ' -f1 || md5 -q -s "$(pwd)").lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f%m "$LOCK_FILE" 2>/dev/null || stat -c%Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 30 ]; then
    exit 0
  fi
fi

# Run sync in background, suppress all output
if command -v prjct >/dev/null 2>&1; then
  touch "$LOCK_FILE"
  prjct sync --quiet --yes >/dev/null 2>&1 &
fi

exit 0
`
}

/**
 * Shell script for post-checkout hook
 * Syncs project context after branch switch
 */
function getPostCheckoutScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-checkout)
# Syncs project context after branch switch
# Installed by: prjct hooks install

# Only run on branch checkout (not file checkout)
# $3 is the checkout type flag: 1 = branch, 0 = file
if [ "$3" != "1" ]; then
  exit 0
fi

# Skip if old and new refs are the same (no actual branch change)
if [ "$1" = "$2" ]; then
  exit 0
fi

# Rate limit: skip if synced within last 30 seconds
LOCK_FILE="\${TMPDIR:-/tmp}/prjct-sync-$(pwd | md5sum 2>/dev/null | cut -d' ' -f1 || md5 -q -s "$(pwd)").lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f%m "$LOCK_FILE" 2>/dev/null || stat -c%Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 30 ]; then
    exit 0
  fi
fi

# Run sync in background, suppress all output
if command -v prjct >/dev/null 2>&1; then
  touch "$LOCK_FILE"
  prjct sync --quiet --yes >/dev/null 2>&1 &
fi

exit 0
`
}

// ============================================================================
// HOOK MANAGER DETECTION
// ============================================================================

/**
 * Detect which hook managers are available in the project
 */
async function detectHookManagers(projectPath: string): Promise<HookStrategy[]> {
  const detected: HookStrategy[] = []

  // Check for lefthook
  if (
    (await fileExists(path.join(projectPath, 'lefthook.yml'))) ||
    (await fileExists(path.join(projectPath, 'lefthook.yaml')))
  ) {
    detected.push('lefthook')
  }

  // Check for husky
  if (
    (await fileExists(path.join(projectPath, '.husky'))) ||
    (await fileExists(path.join(projectPath, '.husky', '_')))
  ) {
    detected.push('husky')
  }

  // Direct .git/hooks is always available if it's a git repo
  if (await fileExists(path.join(projectPath, '.git'))) {
    detected.push('direct')
  }

  return detected
}

/**
 * Select the best hook strategy based on what's available
 */
function selectStrategy(detected: HookStrategy[]): HookStrategy {
  // Prefer managed hook tools over direct
  if (detected.includes('lefthook')) return 'lefthook'
  if (detected.includes('husky')) return 'husky'
  return 'direct'
}

// ============================================================================
// INSTALLATION STRATEGIES
// ============================================================================

/**
 * Install hooks via lefthook (append to existing config)
 */
async function installLefthook(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const configFile = (await fileExists(path.join(projectPath, 'lefthook.yml')))
    ? 'lefthook.yml'
    : 'lefthook.yaml'
  const configPath = path.join(projectPath, configFile)

  let content = await fs.readFile(configPath, 'utf-8')

  for (const hook of hooks) {
    const sectionName = hook // e.g. "post-commit"
    const commandName = `prjct-sync-${hook}`

    // Check if already configured
    if (content.includes(commandName)) {
      continue
    }

    const hookBlock = `
${sectionName}:
  commands:
    ${commandName}:
      run: prjct sync --quiet --yes
      fail_text: "prjct sync failed (non-blocking)"
`

    // If the hook section already exists, add command to it
    const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sectionRegex = new RegExp(`^${escapedSection}:\\s*$`, 'm')
    if (sectionRegex.test(content)) {
      // Insert command into existing section
      content = content.replace(
        sectionRegex,
        `${sectionName}:\n  commands:\n    ${commandName}:\n      run: prjct sync --quiet --yes\n      fail_text: "prjct sync failed (non-blocking)"`
      )
    } else {
      // Append new section
      content = `${content.trimEnd()}\n${hookBlock}`
    }
  }

  await fs.writeFile(configPath, content, 'utf-8')
  return true
}

/**
 * Install hooks via husky
 */
async function installHusky(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const huskyDir = path.join(projectPath, '.husky')

  for (const hook of hooks) {
    const hookPath = path.join(huskyDir, hook)
    const script = hook === 'post-commit' ? getPostCommitScript() : getPostCheckoutScript()

    if (await fileExists(hookPath)) {
      // Append to existing hook if not already present
      const existing = await fs.readFile(hookPath, 'utf-8')
      if (existing.includes('prjct sync')) {
        continue
      }
      await fs.appendFile(hookPath, '\n# prjct auto-sync\nprjct sync --quiet --yes &\n')
    } else {
      await fs.writeFile(hookPath, script, { mode: 0o755 })
    }
  }

  return true
}

/**
 * Install hooks directly into .git/hooks/
 */
async function installDirect(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const hooksDir = path.join(projectPath, '.git', 'hooks')

  if (!(await fileExists(hooksDir))) {
    await fs.mkdir(hooksDir, { recursive: true })
  }

  for (const hook of hooks) {
    const hookPath = path.join(hooksDir, hook)
    const script = hook === 'post-commit' ? getPostCommitScript() : getPostCheckoutScript()

    if (await fileExists(hookPath)) {
      const existing = await fs.readFile(hookPath, 'utf-8')
      if (existing.includes('prjct sync')) {
        continue // Already installed
      }
      // Append to existing hook
      await fs.appendFile(
        hookPath,
        `\n# prjct auto-sync\n${script.split('\n').slice(1).join('\n')}`
      )
    } else {
      await fs.writeFile(hookPath, script, { mode: 0o755 })
    }
  }

  return true
}

// ============================================================================
// UNINSTALL STRATEGIES
// ============================================================================

async function uninstallLefthook(projectPath: string): Promise<boolean> {
  const configFile = (await fileExists(path.join(projectPath, 'lefthook.yml')))
    ? 'lefthook.yml'
    : 'lefthook.yaml'
  const configPath = path.join(projectPath, configFile)

  if (!(await fileExists(configPath))) return false

  let content = await fs.readFile(configPath, 'utf-8')

  // Remove prjct-sync commands
  content = content.replace(/\s*prjct-sync-[\w-]+:[\s\S]*?(?=\n\S|\n*$)/g, '')

  // Clean up empty sections
  content = content.replace(/^(post-commit|post-checkout):\s*commands:\s*$/gm, '')

  await fs.writeFile(configPath, `${content.trimEnd()}\n`, 'utf-8')
  return true
}

async function uninstallHusky(projectPath: string): Promise<boolean> {
  const huskyDir = path.join(projectPath, '.husky')

  for (const hook of ['post-commit', 'post-checkout'] as HookName[]) {
    const hookPath = path.join(huskyDir, hook)
    if (!(await fileExists(hookPath))) continue

    const content = await fs.readFile(hookPath, 'utf-8')
    if (!content.includes('prjct sync')) continue

    // Remove prjct lines
    const cleaned = content
      .split('\n')
      .filter((line) => !line.includes('prjct sync') && !line.includes('prjct auto-sync'))
      .join('\n')

    if (cleaned.trim() === '#!/bin/sh' || cleaned.trim() === '#!/usr/bin/env sh') {
      // Hook is now empty, remove it
      await fs.unlink(hookPath)
    } else {
      await fs.writeFile(hookPath, cleaned, { mode: 0o755 })
    }
  }

  return true
}

async function uninstallDirect(projectPath: string): Promise<boolean> {
  const hooksDir = path.join(projectPath, '.git', 'hooks')

  for (const hook of ['post-commit', 'post-checkout'] as HookName[]) {
    const hookPath = path.join(hooksDir, hook)
    if (!(await fileExists(hookPath))) continue

    const content = await fs.readFile(hookPath, 'utf-8')
    if (!content.includes('prjct sync')) continue

    if (content.includes('Installed by: prjct hooks install')) {
      // Entirely ours, remove it
      await fs.unlink(hookPath)
    } else {
      // Shared hook, just remove our lines
      const cleaned = content
        .split('\n')
        .filter((line) => !line.includes('prjct sync') && !line.includes('prjct auto-sync'))
        .join('\n')
      await fs.writeFile(hookPath, cleaned, { mode: 0o755 })
    }
  }

  return true
}

// ============================================================================
// HOOKS SERVICE
// ============================================================================

class HooksService {
  /**
   * Install git hooks for auto-sync
   */
  async install(
    projectPath: string,
    options: { strategy?: HookStrategy; hooks?: HookName[] } = {}
  ): Promise<HooksInstallResult> {
    const hooks: HookName[] = options.hooks || ['post-commit', 'post-checkout']

    // Detect available managers
    const detected = await detectHookManagers(projectPath)

    if (detected.length === 0) {
      return {
        success: false,
        strategy: 'direct',
        hooksInstalled: [],
        error: 'Not a git repository. Run "git init" first.',
      }
    }

    const strategy = options.strategy || selectStrategy(detected)

    try {
      let success = false

      switch (strategy) {
        case 'lefthook':
          success = await installLefthook(projectPath, hooks)
          break
        case 'husky':
          success = await installHusky(projectPath, hooks)
          break
        case 'direct':
          success = await installDirect(projectPath, hooks)
          break
      }

      if (success) {
        // Save hook config to project.json
        await this.saveHookConfig(projectPath, {
          enabled: true,
          strategy,
          hooks,
          installedAt: new Date().toISOString(),
        })
      }

      return {
        success,
        strategy,
        hooksInstalled: success ? hooks : [],
      }
    } catch (error) {
      return {
        success: false,
        strategy,
        hooksInstalled: [],
        error: getErrorMessage(error),
      }
    }
  }

  /**
   * Uninstall git hooks
   */
  async uninstall(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Read current config to determine strategy
      const config = await this.getHookConfig(projectPath)
      const strategy = config?.strategy || 'direct'

      let success = false

      switch (strategy) {
        case 'lefthook':
          success = await uninstallLefthook(projectPath)
          break
        case 'husky':
          success = await uninstallHusky(projectPath)
          break
        case 'direct':
          success = await uninstallDirect(projectPath)
          break
      }

      // Clear hook config
      if (success) {
        await this.saveHookConfig(projectPath, {
          enabled: false,
          strategy,
          hooks: [],
        })
      }

      return { success }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Get hook installation status
   */
  async status(projectPath: string): Promise<HooksStatusResult> {
    const detected = await detectHookManagers(projectPath)
    const config = await this.getHookConfig(projectPath)

    const hookNames: HookName[] = ['post-commit', 'post-checkout']
    const hooks = await Promise.all(
      hookNames.map(async (name) => ({
        name,
        installed: await this.isHookInstalled(projectPath, name, config?.strategy || null),
        path: await this.getHookPath(projectPath, name, config?.strategy || null),
      }))
    )

    return {
      installed: hooks.some((h) => h.installed),
      strategy: config?.strategy || null,
      hooks,
      detectedManagers: detected,
    }
  }

  /**
   * Run the hooks CLI command
   */
  async run(projectPath: string, subcommand: string): Promise<number> {
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      console.error('No prjct project found. Run "prjct init" first.')
      return 1
    }

    switch (subcommand) {
      case 'install':
        return this.runInstall(projectPath)
      case 'uninstall':
        return this.runUninstall(projectPath)
      case 'status':
        return this.runStatus(projectPath)
      default:
        return this.runStatus(projectPath)
    }
  }

  // ==========================================================================
  // CLI SUBCOMMANDS
  // ==========================================================================

  private async runInstall(projectPath: string): Promise<number> {
    out.start()
    out.section('Git Hooks Installation')

    const detected = await detectHookManagers(projectPath)
    const strategy = selectStrategy(detected)

    console.log(`  Strategy: ${chalk.cyan(strategy)}`)
    console.log(`  Hooks:    ${chalk.dim('post-commit, post-checkout')}`)
    console.log('')

    const result = await this.install(projectPath, { strategy })

    if (result.success) {
      out.done(`Hooks installed via ${result.strategy}`)
      console.log('')
      for (const hook of result.hooksInstalled) {
        console.log(`  ${chalk.green('✓')} ${hook}`)
      }
      console.log('')
      console.log(chalk.dim('  Context will auto-sync on commit and branch switch.'))
      console.log(chalk.dim('  Remove with: prjct hooks uninstall'))
    } else {
      out.fail(result.error || 'Failed to install hooks')
    }

    console.log('')
    out.end()
    return result.success ? 0 : 1
  }

  private async runUninstall(projectPath: string): Promise<number> {
    out.start()
    out.section('Git Hooks Removal')

    const result = await this.uninstall(projectPath)

    if (result.success) {
      out.done('Hooks removed')
    } else {
      out.fail(result.error || 'Failed to remove hooks')
    }

    console.log('')
    out.end()
    return result.success ? 0 : 1
  }

  private async runStatus(projectPath: string): Promise<number> {
    out.start()
    out.section('Git Hooks Status')

    const status = await this.status(projectPath)

    if (status.installed) {
      console.log(`  Status:   ${chalk.green('Active')}`)
      console.log(`  Strategy: ${chalk.cyan(status.strategy)}`)
    } else {
      console.log(`  Status:   ${chalk.dim('Not installed')}`)
    }

    console.log('')
    for (const hook of status.hooks) {
      const icon = hook.installed ? chalk.green('✓') : chalk.dim('○')
      const label = hook.installed ? hook.name : chalk.dim(hook.name)
      console.log(`  ${icon} ${label}`)
    }

    if (status.detectedManagers.length > 0) {
      console.log('')
      console.log(`  ${chalk.dim('Available managers:')} ${status.detectedManagers.join(', ')}`)
    }

    if (!status.installed) {
      console.log('')
      console.log(chalk.dim('  Install with: prjct hooks install'))
    }

    console.log('')
    out.end()
    return 0
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async isHookInstalled(
    projectPath: string,
    hook: HookName,
    strategy: HookStrategy | null
  ): Promise<boolean> {
    if (strategy === 'lefthook') {
      const configFile = (await fileExists(path.join(projectPath, 'lefthook.yml')))
        ? 'lefthook.yml'
        : 'lefthook.yaml'
      const configPath = path.join(projectPath, configFile)
      if (!(await fileExists(configPath))) return false
      const content = await fs.readFile(configPath, 'utf-8')
      return content.includes(`prjct-sync-${hook}`)
    }

    if (strategy === 'husky') {
      const hookPath = path.join(projectPath, '.husky', hook)
      if (!(await fileExists(hookPath))) return false
      return (await fs.readFile(hookPath, 'utf-8')).includes('prjct sync')
    }

    // Direct
    const hookPath = path.join(projectPath, '.git', 'hooks', hook)
    if (!(await fileExists(hookPath))) return false
    return (await fs.readFile(hookPath, 'utf-8')).includes('prjct sync')
  }

  private async getHookPath(
    projectPath: string,
    hook: HookName,
    strategy: HookStrategy | null
  ): Promise<string> {
    if (strategy === 'lefthook') {
      return (await fileExists(path.join(projectPath, 'lefthook.yml')))
        ? 'lefthook.yml'
        : 'lefthook.yaml'
    }
    if (strategy === 'husky') {
      return `.husky/${hook}`
    }
    return `.git/hooks/${hook}`
  }

  private async getHookConfig(projectPath: string): Promise<HookConfig | null> {
    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) return null

    try {
      const project = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project')
      if (!project) return null
      return (project.hooks as HookConfig) || null
    } catch {
      return null
    }
  }

  private async saveHookConfig(projectPath: string, config: HookConfig): Promise<void> {
    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) return

    try {
      const project = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project') || {}
      project.hooks = config
      prjctDb.setDoc(projectId, 'project', project)
    } catch {
      // Non-fatal
    }
  }
}

export const hooksService = new HooksService()
