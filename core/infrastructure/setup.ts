/**
 * Setup Module - Core installation logic
 *
 * Executes ALL setup needed for prjct-cli:
 * 1. Detect AI provider (Claude Code or Gemini CLI)
 * 2. Install CLI if missing
 * 3. Sync commands to provider's commands directory
 * 4. Install global config (CLAUDE.md or GEMINI.md)
 * 5. Save version in editors-config
 *
 * Supports multiple AI CLI agents:
 * - Claude Code: ~/.claude/commands/p/, CLAUDE.md
 * - Gemini CLI: ~/.gemini/commands/p/, GEMINI.md
 *
 * This module is called from:
 * - core/index.js (on first CLI use)
 * - scripts/postinstall.js (if npm scripts are enabled)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { getTimeout } from '../constants'
import { dependencyValidator } from '../services/dependency-validator'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { AIProviderConfig, AIProviderName } from '../types/provider'
import { fileExists } from '../utils/fs-helpers'
import log from '../utils/logger'
import { getPackageRoot, VERSION } from '../utils/version'
import {
  detectAllProviders,
  detectAntigravity,
  detectProvider,
  Providers,
  selectProvider,
} from './ai-provider'
import installer from './command-installer'
import editorsConfig from './editors-config'

interface ProviderSetupResult {
  provider: AIProviderName
  cliInstalled: boolean
  commandsAdded: number
  commandsUpdated: number
  configAction: string | null
}

interface SetupResults {
  provider: AIProviderName // Primary provider (for backward compat)
  providers: ProviderSetupResult[] // All installed providers
  cliInstalled: boolean
  commandsAdded: number
  commandsUpdated: number
  configAction: string | null
}

/**
 * Check if an AI CLI is installed
 */
async function _hasAICLI(provider: AIProviderConfig): Promise<boolean> {
  const detection = await detectProvider(provider.name)
  return detection.installed
}

/**
 * Install AI CLI for the specified provider
 * PRJ-114: Enhanced with graceful degradation and alternative install suggestions
 */
async function installAICLI(provider: AIProviderConfig): Promise<boolean> {
  const packageName =
    provider.name === 'claude' ? '@anthropic-ai/claude-code' : '@google/gemini-cli'

  // PRJ-114: Check npm availability first
  if (!dependencyValidator.isAvailable('npm')) {
    console.log(`${chalk.yellow('⚠️  npm is not available')}`)
    console.log('')
    console.log(`${chalk.dim(`Install ${provider.displayName} using one of:`)}`)
    console.log(chalk.dim('  • Install Node.js: https://nodejs.org'))
    console.log(
      chalk.dim(
        `  • Use Homebrew: brew install ${provider.name === 'claude' ? 'claude' : 'gemini'}`
      )
    )
    console.log(chalk.dim(`  • Use npx directly: npx ${packageName}`))
    console.log('')
    return false
  }

  try {
    console.log(chalk.yellow(`📦 ${provider.displayName} not found. Installing...`))
    console.log('')
    // PRJ-111: Add timeout to npm install (default: 2 minutes, configurable via PRJCT_TIMEOUT_NPM_INSTALL)
    execSync(`npm install -g ${packageName}`, {
      stdio: 'inherit',
      timeout: getTimeout('NPM_INSTALL'),
    })
    console.log('')
    console.log(`${chalk.green('✓')} ${provider.displayName} installed successfully`)
    console.log('')
    return true
  } catch (error) {
    const err = error as Error & { killed?: boolean; signal?: string }
    const isTimeout = err.killed && err.signal === 'SIGTERM'

    if (isTimeout) {
      console.log(chalk.yellow(`⚠️  Installation timed out for ${provider.displayName}`))
      console.log('')
      console.log(chalk.dim('The npm install took too long. Try:'))
      console.log(chalk.dim('  • Set PRJCT_TIMEOUT_NPM_INSTALL=300000 for 5 minutes'))
      console.log(chalk.dim(`  • Run manually: npm install -g ${packageName}`))
    } else {
      console.log(chalk.yellow(`⚠️  Failed to install ${provider.displayName}: ${err.message}`))
    }
    console.log('')
    console.log(chalk.dim('Alternative installation methods:'))
    console.log(chalk.dim(`  • npm:  npm install -g ${packageName}`))
    console.log(chalk.dim(`  • yarn: yarn global add ${packageName}`))
    console.log(chalk.dim(`  • pnpm: pnpm add -g ${packageName}`))
    console.log(
      chalk.dim(`  • brew: brew install ${provider.name === 'claude' ? 'claude' : 'gemini'}`)
    )
    console.log('')
    return false
  }
}

/**
 * Main setup function - installs for ALL detected providers
 */
export async function run(): Promise<SetupResults> {
  // Step 0: Detect all available providers
  const detection = await detectAllProviders()
  const selection = await selectProvider()
  const _primaryProvider = Providers[selection.provider]

  const results: SetupResults = {
    provider: selection.provider,
    providers: [],
    cliInstalled: false,
    commandsAdded: 0,
    commandsUpdated: 0,
    configAction: null,
  }

  // Step 1: Install for each CLI-based provider (Claude, Gemini)
  // Note: Cursor is project-level and handled separately via installCursorProject()
  const cliProviderNames: ('claude' | 'gemini')[] = ['claude', 'gemini']

  for (const providerName of cliProviderNames) {
    const providerConfig = Providers[providerName]
    const providerDetection = detection[providerName]

    const providerResult: ProviderSetupResult = {
      provider: providerName,
      cliInstalled: false,
      commandsAdded: 0,
      commandsUpdated: 0,
      configAction: null,
    }

    // Check if CLI is installed
    if (!providerDetection.installed) {
      // Only prompt to install the primary (selected) provider
      if (providerName === selection.provider) {
        const installed = await installAICLI(providerConfig)
        if (installed) {
          providerResult.cliInstalled = true
          results.cliInstalled = true
        } else {
          throw new Error(`${providerConfig.displayName} installation failed`)
        }
      } else {
        // Skip non-primary providers that aren't installed
        continue
      }
    }

    // Step 2: Install commands and config for this provider
    if (providerName === 'claude') {
      const claudeDetected = await installer.detectClaude()

      if (claudeDetected) {
        // Sync commands
        const syncResult = await installer.syncCommands()
        if (syncResult.success) {
          providerResult.commandsAdded = syncResult.added
          providerResult.commandsUpdated = syncResult.updated
          results.commandsAdded += syncResult.added
          results.commandsUpdated += syncResult.updated
        }

        // Install global configuration
        const configResult = await installer.installGlobalConfig()
        if (configResult.success) {
          providerResult.configAction = configResult.action
          if (!results.configAction) {
            results.configAction = configResult.action
          }
        }

        // Install documentation files
        await installer.installDocs()

        // Install status line (Claude only)
        await installStatusLine()

        // Install Context7 MCP (only MCP server prjct uses)
        await installContext7MCP()
      }
    } else if (providerName === 'gemini') {
      // Gemini provider - install router and global config
      const geminiInstalled = await installGeminiRouter()
      if (geminiInstalled) {
        providerResult.commandsAdded = 1
        results.commandsAdded += 1
      }

      const geminiConfigResult = await installGeminiGlobalConfig()
      if (geminiConfigResult.success) {
        providerResult.configAction = geminiConfigResult.action
      }
    }

    results.providers.push(providerResult)
  }

  // Step 2b: Install for Antigravity if detected (separate from CLI providers)
  const antigravityDetection = await detectAntigravity()
  if (antigravityDetection.installed) {
    const antigravityResult = await installAntigravitySkill()
    if (antigravityResult.success) {
      console.log(`   ${chalk.green('✓')} Antigravity skill installed`)
    }
  }

  // Step 3: Save version in editors-config
  await editorsConfig.saveConfig(VERSION, await installer.getInstallPath(), selection.provider)

  // Step 4: Migrate existing projects to add cliVersion
  await migrateProjectsCliVersion()

  // Show results for all providers
  for (const providerResult of results.providers) {
    showResults(providerResult, Providers[providerResult.provider])
  }

  return results
}

// Default export for CommonJS require
export default { run }

/**
 * Install the p.toml router for Gemini CLI
 */
async function installGeminiRouter(): Promise<boolean> {
  try {
    const geminiCommandsDir = path.join(os.homedir(), '.gemini', 'commands')
    const routerSource = path.join(getPackageRoot(), 'templates', 'commands', 'p.toml')
    const routerDest = path.join(geminiCommandsDir, 'p.toml')

    // Ensure commands directory exists
    await fs.mkdir(geminiCommandsDir, { recursive: true })

    // Copy router
    if (await fileExists(routerSource)) {
      await fs.copyFile(routerSource, routerDest)
      return true
    }
    return false
  } catch (error) {
    log.warn(`Gemini router warning: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Install or update global GEMINI.md configuration
 */
async function installGeminiGlobalConfig(): Promise<{ success: boolean; action: string | null }> {
  try {
    const geminiDir = path.join(os.homedir(), '.gemini')
    const globalConfigPath = path.join(geminiDir, 'GEMINI.md')
    const templatePath = path.join(getPackageRoot(), 'templates', 'global', 'GEMINI.md')

    // Ensure ~/.gemini directory exists
    await fs.mkdir(geminiDir, { recursive: true })

    // Read template content
    const templateContent = await fs.readFile(templatePath, 'utf-8')

    // Check if global config already exists
    let existingContent = ''
    let configExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      configExists = true
    } catch (error) {
      if (isNotFoundError(error)) {
        configExists = false
      } else {
        throw error
      }
    }

    if (!configExists) {
      // Create new file with full template
      await fs.writeFile(globalConfigPath, templateContent, 'utf-8')
      return { success: true, action: 'created' }
    }

    // File exists - perform intelligent merge
    const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
    const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

    const hasMarkers = existingContent.includes(startMarker) && existingContent.includes(endMarker)

    if (!hasMarkers) {
      // No markers - append prjct section at the end
      const updatedContent = `${existingContent}\n\n${templateContent}`
      await fs.writeFile(globalConfigPath, updatedContent, 'utf-8')
      return { success: true, action: 'appended' }
    }

    // Markers exist - replace content between markers
    const beforeMarker = existingContent.substring(0, existingContent.indexOf(startMarker))
    const afterMarker = existingContent.substring(
      existingContent.indexOf(endMarker) + endMarker.length
    )

    // Extract prjct section from template
    const prjctSection = templateContent.substring(
      templateContent.indexOf(startMarker),
      templateContent.indexOf(endMarker) + endMarker.length
    )

    const updatedContent = beforeMarker + prjctSection + afterMarker
    await fs.writeFile(globalConfigPath, updatedContent, 'utf-8')
    return { success: true, action: 'updated' }
  } catch (error) {
    log.warn(`Gemini config warning: ${getErrorMessage(error)}`)
    return { success: false, action: null }
  }
}

// =============================================================================
// Antigravity Installation (Skills-based)
// =============================================================================

/**
 * Install prjct as a skill for Google Antigravity
 *
 * Antigravity uses SKILL.md files in ~/.gemini/antigravity/skills/
 * This is the recommended integration method (not MCP).
 */
export async function installAntigravitySkill(): Promise<{
  success: boolean
  action: string | null
}> {
  try {
    const antigravitySkillsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'skills')
    const prjctSkillDir = path.join(antigravitySkillsDir, 'prjct')
    const skillMdPath = path.join(prjctSkillDir, 'SKILL.md')
    const templatePath = path.join(getPackageRoot(), 'templates', 'antigravity', 'SKILL.md')

    // Ensure skills directory exists
    await fs.mkdir(prjctSkillDir, { recursive: true })

    // Check if SKILL.md already exists
    const skillExists = await fileExists(skillMdPath)

    // Read template content
    if (!(await fileExists(templatePath))) {
      log.warn('Antigravity SKILL.md template not found')
      return { success: false, action: null }
    }

    const templateContent = await fs.readFile(templatePath, 'utf-8')

    // Write SKILL.md
    await fs.writeFile(skillMdPath, templateContent, 'utf-8')

    return { success: true, action: skillExists ? 'updated' : 'created' }
  } catch (error) {
    log.warn(`Antigravity skill warning: ${getErrorMessage(error)}`)
    return { success: false, action: null }
  }
}

/**
 * Check if Antigravity skill needs installation or update
 */
export async function needsAntigravityInstallation(): Promise<boolean> {
  const detection = await detectAntigravity()
  return detection.installed && !detection.skillInstalled
}

// =============================================================================
// Cursor IDE Installation (Project-Level)
// =============================================================================

/**
 * Install prjct routers for Cursor IDE in a project
 *
 * Unlike Claude/Gemini which have global config, Cursor uses project-level
 * configuration in .cursor/rules/ and .cursor/commands/.
 *
 * Creates minimal routers that point to the npm package for real instructions.
 * Installs individual command files for better Cursor UX (/sync, /task, etc.)
 *
 * @param projectRoot - The project root directory
 * @returns Object with success status and files created
 */
export async function installCursorProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  commandsCreated: boolean
  gitignoreUpdated: boolean
}> {
  const result = {
    success: false,
    rulesCreated: false,
    commandsCreated: false,
    gitignoreUpdated: false,
  }

  try {
    const cursorDir = path.join(projectRoot, '.cursor')
    const rulesDir = path.join(cursorDir, 'rules')
    const commandsDir = path.join(cursorDir, 'commands')

    const routerMdcDest = path.join(rulesDir, 'prjct.mdc')

    const routerMdcSource = path.join(getPackageRoot(), 'templates', 'cursor', 'router.mdc')
    const cursorCommandsSource = path.join(getPackageRoot(), 'templates', 'cursor', 'commands')

    // Ensure directories exist
    await fs.mkdir(rulesDir, { recursive: true })
    await fs.mkdir(commandsDir, { recursive: true })

    // Copy router.mdc → .cursor/rules/prjct.mdc
    if (await fileExists(routerMdcSource)) {
      await fs.copyFile(routerMdcSource, routerMdcDest)
      result.rulesCreated = true
    }

    // Copy individual command files → .cursor/commands/
    // This enables /sync, /task, /done, /ship, etc. syntax in Cursor
    if (await fileExists(cursorCommandsSource)) {
      const commandFiles = (await fs.readdir(cursorCommandsSource)).filter((f) => f.endsWith('.md'))

      for (const file of commandFiles) {
        const src = path.join(cursorCommandsSource, file)
        const dest = path.join(commandsDir, file)
        await fs.copyFile(src, dest)
      }
      result.commandsCreated = commandFiles.length > 0
    }

    // Update .gitignore to exclude prjct Cursor routers
    result.gitignoreUpdated = await addCursorToGitignore(projectRoot)

    result.success = result.rulesCreated || result.commandsCreated
    return result
  } catch (error) {
    log.warn(`Cursor installation warning: ${getErrorMessage(error)}`)
    return result
  }
}

/**
 * Add Cursor prjct routers to .gitignore
 *
 * These files are per-developer and regenerated automatically.
 */
async function addCursorToGitignore(projectRoot: string): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, '.gitignore')
    const entriesToAdd = [
      '# prjct Cursor routers (regenerated per-developer)',
      '.cursor/rules/prjct.mdc',
      '.cursor/commands/sync.md',
      '.cursor/commands/task.md',
      '.cursor/commands/done.md',
      '.cursor/commands/ship.md',
      '.cursor/commands/bug.md',
      '.cursor/commands/pause.md',
      '.cursor/commands/resume.md',
    ]

    let content = ''
    let configExists = false

    try {
      content = await fs.readFile(gitignorePath, 'utf-8')
      configExists = true
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }

    // Check if already added
    if (content.includes('.cursor/rules/prjct.mdc')) {
      return false // Already added
    }

    // Append to .gitignore
    const newContent = configExists
      ? `${content.trimEnd()}\n\n${entriesToAdd.join('\n')}\n`
      : `${entriesToAdd.join('\n')}\n`

    await fs.writeFile(gitignorePath, newContent, 'utf-8')
    return true
  } catch (error) {
    log.warn(`Gitignore update warning: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Check if a project has Cursor configured (has .cursor/ directory)
 */
export async function hasCursorProject(projectRoot: string): Promise<boolean> {
  return await fileExists(path.join(projectRoot, '.cursor'))
}

/**
 * Check if Cursor routers need regeneration
 */
export async function needsCursorRegeneration(projectRoot: string): Promise<boolean> {
  const cursorDir = path.join(projectRoot, '.cursor')
  const routerPath = path.join(cursorDir, 'rules', 'prjct.mdc')

  // Only check if .cursor/ exists (project uses Cursor)
  return (await fileExists(cursorDir)) && !(await fileExists(routerPath))
}

// =============================================================================
// Windsurf IDE Installation (Project-Level)
// =============================================================================

/**
 * Install prjct routers for Windsurf IDE in a project
 *
 * Unlike Claude/Gemini which have global config, Windsurf uses project-level
 * configuration in .windsurf/rules/ and .windsurf/workflows/.
 *
 * Key differences from Cursor:
 * - Uses .md files (not .mdc) with YAML frontmatter
 * - Uses "workflows" directory instead of "commands"
 * - Frontmatter uses `trigger: always_on` instead of `alwaysApply: true`
 *
 * @param projectRoot - The project root directory
 * @returns Object with success status and files created
 */
export async function installWindsurfProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  workflowsCreated: boolean
  gitignoreUpdated: boolean
}> {
  const result = {
    success: false,
    rulesCreated: false,
    workflowsCreated: false,
    gitignoreUpdated: false,
  }

  try {
    const windsurfDir = path.join(projectRoot, '.windsurf')
    const rulesDir = path.join(windsurfDir, 'rules')
    const workflowsDir = path.join(windsurfDir, 'workflows')

    const routerDest = path.join(rulesDir, 'prjct.md')

    const routerSource = path.join(getPackageRoot(), 'templates', 'windsurf', 'router.md')
    const windsurfWorkflowsSource = path.join(
      getPackageRoot(),
      'templates',
      'windsurf',
      'workflows'
    )

    // Ensure directories exist
    await fs.mkdir(rulesDir, { recursive: true })
    await fs.mkdir(workflowsDir, { recursive: true })

    // Copy router.md → .windsurf/rules/prjct.md
    if (await fileExists(routerSource)) {
      await fs.copyFile(routerSource, routerDest)
      result.rulesCreated = true
    }

    // Copy individual workflow files → .windsurf/workflows/
    // This enables /sync, /task, /done, /ship, etc. syntax in Windsurf
    if (await fileExists(windsurfWorkflowsSource)) {
      const workflowFiles = (await fs.readdir(windsurfWorkflowsSource)).filter((f) =>
        f.endsWith('.md')
      )

      for (const file of workflowFiles) {
        const src = path.join(windsurfWorkflowsSource, file)
        const dest = path.join(workflowsDir, file)
        await fs.copyFile(src, dest)
      }
      result.workflowsCreated = workflowFiles.length > 0
    }

    // Update .gitignore to exclude prjct Windsurf routers
    result.gitignoreUpdated = await addWindsurfToGitignore(projectRoot)

    result.success = result.rulesCreated || result.workflowsCreated
    return result
  } catch (error) {
    log.warn(`Windsurf installation warning: ${getErrorMessage(error)}`)
    return result
  }
}

/**
 * Add Windsurf prjct routers to .gitignore
 *
 * These files are per-developer and regenerated automatically.
 */
async function addWindsurfToGitignore(projectRoot: string): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, '.gitignore')
    const entriesToAdd = [
      '# prjct Windsurf routers (regenerated per-developer)',
      '.windsurf/rules/prjct.md',
      '.windsurf/workflows/sync.md',
      '.windsurf/workflows/task.md',
      '.windsurf/workflows/done.md',
      '.windsurf/workflows/ship.md',
      '.windsurf/workflows/bug.md',
      '.windsurf/workflows/pause.md',
      '.windsurf/workflows/resume.md',
    ]

    let content = ''
    let configExists = false

    try {
      content = await fs.readFile(gitignorePath, 'utf-8')
      configExists = true
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }

    // Check if already added
    if (content.includes('.windsurf/rules/prjct.md')) {
      return false // Already added
    }

    // Append to .gitignore
    const newContent = configExists
      ? `${content.trimEnd()}\n\n${entriesToAdd.join('\n')}\n`
      : `${entriesToAdd.join('\n')}\n`

    await fs.writeFile(gitignorePath, newContent, 'utf-8')
    return true
  } catch (error) {
    log.warn(`Gitignore update warning: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Check if a project has Windsurf configured (has .windsurf/ directory)
 */
export async function hasWindsurfProject(projectRoot: string): Promise<boolean> {
  return await fileExists(path.join(projectRoot, '.windsurf'))
}

/**
 * Check if Windsurf routers need regeneration
 */
export async function needsWindsurfRegeneration(projectRoot: string): Promise<boolean> {
  const windsurfDir = path.join(projectRoot, '.windsurf')
  const routerPath = path.join(windsurfDir, 'rules', 'prjct.md')

  // Only check if .windsurf/ exists (project uses Windsurf)
  return (await fileExists(windsurfDir)) && !(await fileExists(routerPath))
}

/**
 * Migrate existing projects to add cliVersion field
 * This clears the status line warning after npm update
 */
async function migrateProjectsCliVersion(): Promise<void> {
  try {
    const projectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')

    if (!(await fileExists(projectsDir))) {
      return
    }

    const projectDirs = (await fs.readdir(projectsDir, { withFileTypes: true }))
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

    let migrated = 0

    for (const projectId of projectDirs) {
      const projectJsonPath = path.join(projectsDir, projectId, 'project.json')

      if (!(await fileExists(projectJsonPath))) {
        continue
      }

      try {
        const content = await fs.readFile(projectJsonPath, 'utf8')
        const project = JSON.parse(content)

        // Only update if cliVersion is missing or different
        if (project.cliVersion !== VERSION) {
          project.cliVersion = VERSION
          await fs.writeFile(projectJsonPath, JSON.stringify(project, null, 2))
          migrated++
        }
      } catch (error) {
        // Skip invalid project.json files (missing or malformed JSON)
        if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
          throw error
        }
      }
    }

    if (migrated > 0) {
      console.log(`   ${chalk.green('✓')} Updated ${migrated} project(s) to v${VERSION}`)
    }
  } catch (error) {
    // Silently fail if projects directory doesn't exist
    if (!isNotFoundError(error)) {
      // Log unexpected errors but don't crash - migration is optional
      log.warn(`Migration warning: ${getErrorMessage(error)}`)
    }
  }
}

/**
 * Ensure settings.json has statusLine configured
 */
async function ensureStatusLineSettings(
  settingsPath: string,
  statusLinePath: string
): Promise<void> {
  let settings: Record<string, unknown> = {}
  if (await fileExists(settingsPath)) {
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))
    } catch (error) {
      // Invalid JSON, start fresh - but propagate unexpected errors
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
  }
  settings.statusLine = { type: 'command', command: statusLinePath }
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
}

/**
 * Install status line script with version check
 * Copies modular statusline from assets/ to ~/.prjct-cli/statusline/
 * Includes: statusline.sh, lib/, components/, themes/, config.json
 * Creates symlink at ~/.claude/prjct-statusline.sh
 * Updates CLI_VERSION in the script
 */
async function installStatusLine(): Promise<void> {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const settingsPath = path.join(claudeDir, 'settings.json')
    const claudeStatusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

    // Target location for the actual script
    const prjctStatusLineDir = path.join(os.homedir(), '.prjct-cli', 'statusline')
    const prjctStatusLinePath = path.join(prjctStatusLineDir, 'statusline.sh')
    const prjctThemesDir = path.join(prjctStatusLineDir, 'themes')
    const prjctLibDir = path.join(prjctStatusLineDir, 'lib')
    const prjctComponentsDir = path.join(prjctStatusLineDir, 'components')
    const prjctConfigPath = path.join(prjctStatusLineDir, 'config.json')

    // Source assets (from the package)
    const assetsDir = path.join(getPackageRoot(), 'assets', 'statusline')
    const sourceScript = path.join(assetsDir, 'statusline.sh')
    const sourceThemeDir = path.join(assetsDir, 'themes')
    const sourceLibDir = path.join(assetsDir, 'lib')
    const sourceComponentsDir = path.join(assetsDir, 'components')
    const sourceConfigPath = path.join(assetsDir, 'default-config.json')

    // Ensure directories exist
    if (!(await fileExists(claudeDir))) {
      await fs.mkdir(claudeDir, { recursive: true })
    }
    if (!(await fileExists(prjctStatusLineDir))) {
      await fs.mkdir(prjctStatusLineDir, { recursive: true })
    }
    if (!(await fileExists(prjctThemesDir))) {
      await fs.mkdir(prjctThemesDir, { recursive: true })
    }
    if (!(await fileExists(prjctLibDir))) {
      await fs.mkdir(prjctLibDir, { recursive: true })
    }
    if (!(await fileExists(prjctComponentsDir))) {
      await fs.mkdir(prjctComponentsDir, { recursive: true })
    }

    // Check if statusline already exists
    if (await fileExists(prjctStatusLinePath)) {
      const existingContent = await fs.readFile(prjctStatusLinePath, 'utf8')

      if (existingContent.includes('CLI_VERSION=')) {
        // Has CLI_VERSION - update if needed
        const versionMatch = existingContent.match(/CLI_VERSION="([^"]*)"/)

        if (versionMatch && versionMatch[1] !== VERSION) {
          // Update CLI_VERSION in-place
          const updatedContent = existingContent.replace(
            /CLI_VERSION="[^"]*"/,
            `CLI_VERSION="${VERSION}"`
          )
          await fs.writeFile(prjctStatusLinePath, updatedContent, { mode: 0o755 })
        }

        // Ensure modular structure is installed (upgrade path)
        await installStatusLineModules(sourceLibDir, prjctLibDir)
        await installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

        // Ensure symlink and settings
        await ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
        await ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
        return
      }
      // else: Script exists WITHOUT CLI_VERSION - fall through to replace with new version
    }

    // Install fresh from assets if source exists
    if (await fileExists(sourceScript)) {
      // Copy script and update version
      let scriptContent = await fs.readFile(sourceScript, 'utf8')
      scriptContent = scriptContent.replace(/CLI_VERSION="[^"]*"/, `CLI_VERSION="${VERSION}"`)
      await fs.writeFile(prjctStatusLinePath, scriptContent, { mode: 0o755 })

      // Copy lib/ modules
      await installStatusLineModules(sourceLibDir, prjctLibDir)

      // Copy components/
      await installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

      // Copy themes
      if (await fileExists(sourceThemeDir)) {
        const themes = await fs.readdir(sourceThemeDir)
        for (const theme of themes) {
          const src = path.join(sourceThemeDir, theme)
          const dest = path.join(prjctThemesDir, theme)
          // Always update themes to get new icons/colors
          await fs.copyFile(src, dest)
        }
      }

      // Copy default config (only if not exists - preserve user customizations)
      if (!(await fileExists(prjctConfigPath)) && (await fileExists(sourceConfigPath))) {
        await fs.copyFile(sourceConfigPath, prjctConfigPath)
      }
    } else {
      // Fallback: create simple script inline
      const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
CLI_VERSION="${VERSION}"
input=$(cat)
CWD=$(echo "$input" | jq -r '.workspace.current_dir // "~"' 2>/dev/null)
CONFIG="$CWD/.prjct/prjct.config.json"
if [ -f "$CONFIG" ]; then
  PROJECT_ID=$(jq -r '.projectId // ""' "$CONFIG" 2>/dev/null)
  if [ -n "$PROJECT_ID" ]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"
    if [ -f "$PROJECT_JSON" ]; then
      PROJECT_VERSION=$(jq -r '.cliVersion // ""' "$PROJECT_JSON" 2>/dev/null)
      if [ -z "$PROJECT_VERSION" ] || [ "$PROJECT_VERSION" != "$CLI_VERSION" ]; then
        echo "prjct v$CLI_VERSION - run p. sync"
        exit 0
      fi
    else
      echo "prjct v$CLI_VERSION - run p. sync"
      exit 0
    fi
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [ -f "$STATE" ]; then
      TASK=$(jq -r '.currentTask.description // ""' "$STATE" 2>/dev/null)
      if [ -n "$TASK" ]; then
        echo "$TASK"
        exit 0
      fi
    fi
  fi
fi
echo "prjct"
`
      await fs.writeFile(prjctStatusLinePath, scriptContent, { mode: 0o755 })
    }

    // Create symlink and configure settings
    await ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
    await ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
  } catch (error) {
    // Silently fail if directories don't exist
    if (!isNotFoundError(error)) {
      // Log unexpected errors but don't crash - status line is optional
      log.warn(`Status line warning: ${getErrorMessage(error)}`)
    }
  }
}

/**
 * Install Context7 MCP server configuration
 *
 * Context7 is the ONLY MCP server prjct uses - for library documentation lookup.
 * All issue tracker integrations (Linear, JIRA) use SDK/REST API directly.
 */
async function installContext7MCP(): Promise<void> {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const mcpConfigPath = path.join(claudeDir, 'mcp.json')

    // Ensure ~/.claude directory exists
    if (!(await fileExists(claudeDir))) {
      await fs.mkdir(claudeDir, { recursive: true })
    }

    // Context7 MCP configuration
    const context7Config = {
      mcpServers: {
        context7: {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp@latest'],
        },
      },
    }

    // Check if mcp.json exists
    if (await fileExists(mcpConfigPath)) {
      // Read existing config
      const existingContent = await fs.readFile(mcpConfigPath, 'utf-8')
      const existingConfig = JSON.parse(existingContent)

      // Check if context7 is already configured
      if (existingConfig.mcpServers?.context7) {
        // Already configured, skip
        return
      }

      // Add context7 to existing config
      existingConfig.mcpServers = existingConfig.mcpServers || {}
      existingConfig.mcpServers.context7 = context7Config.mcpServers.context7
      await fs.writeFile(mcpConfigPath, JSON.stringify(existingConfig, null, 2), 'utf-8')
    } else {
      // Create new mcp.json with context7
      await fs.writeFile(mcpConfigPath, JSON.stringify(context7Config, null, 2), 'utf-8')
    }
  } catch (error) {
    // Non-fatal error, just log
    log.warn(`Context7 MCP setup warning: ${getErrorMessage(error)}`)
  }
}

/**
 * Install statusline modules (lib/ or components/)
 * Copies .sh files from source to destination, always overwriting for updates
 */
async function installStatusLineModules(sourceDir: string, destDir: string): Promise<void> {
  if (!(await fileExists(sourceDir))) {
    return
  }

  const files = await fs.readdir(sourceDir)
  for (const file of files) {
    if (file.endsWith('.sh')) {
      const src = path.join(sourceDir, file)
      const dest = path.join(destDir, file)
      await fs.copyFile(src, dest)
      await fs.chmod(dest, 0o755)
    }
  }
}

/**
 * Ensure symlink from Claude config to prjct statusline
 */
async function ensureStatusLineSymlink(linkPath: string, targetPath: string): Promise<void> {
  try {
    // Check if link already points to correct target
    if (await fileExists(linkPath)) {
      const stats = await fs.lstat(linkPath)
      if (stats.isSymbolicLink()) {
        const existingTarget = await fs.readlink(linkPath)
        if (existingTarget === targetPath) {
          return // Already correct
        }
      }
      // Remove existing file/symlink
      await fs.unlink(linkPath)
    }
    // Create symlink
    await fs.symlink(targetPath, linkPath)
  } catch (_error) {
    // If symlink fails (e.g., Windows, permission issues), try copy instead
    try {
      if (await fileExists(targetPath)) {
        await fs.copyFile(targetPath, linkPath)
        await fs.chmod(linkPath, 0o755)
      }
    } catch (copyError) {
      // Both symlink and copy failed - log if unexpected error
      if (!isNotFoundError(copyError)) {
        log.warn(`Symlink fallback warning: ${(copyError as Error).message}`)
      }
    }
  }
}

/**
 * Show setup results for a single provider
 */
function showResults(results: ProviderSetupResult, provider: AIProviderConfig): void {
  console.log('')

  if (results.cliInstalled) {
    console.log(`   ${chalk.green('✓')} ${provider.displayName} CLI installed`)
  } else {
    console.log(`   ${chalk.green('✓')} ${provider.displayName} CLI found`)
  }

  const totalCommands = results.commandsAdded + results.commandsUpdated
  if (totalCommands > 0) {
    const parts: string[] = []
    if (results.commandsAdded > 0) parts.push(`${results.commandsAdded} new`)
    if (results.commandsUpdated > 0) parts.push(`${results.commandsUpdated} updated`)
    console.log(`   ${chalk.green('✓')} Commands synced (${parts.join(', ')})`)
  } else {
    console.log(`   ${chalk.green('✓')} Commands up to date`)
  }

  if (results.configAction === 'created') {
    console.log(`   ${chalk.green('✓')} Global config created (${provider.contextFile})`)
  } else if (results.configAction === 'updated') {
    console.log(`   ${chalk.green('✓')} Global config updated (${provider.contextFile})`)
  } else if (results.configAction === 'appended') {
    console.log(`   ${chalk.green('✓')} Global config merged (${provider.contextFile})`)
  }

  console.log('')
}

// Auto-execute when run directly (for bun/node CLI usage)
// This enables: bun core/infrastructure/setup.ts
const isDirectRun = process.argv[1]?.includes('setup.ts') || process.argv[1]?.includes('setup.js')
if (isDirectRun) {
  run().catch((error) => {
    console.error('Setup error:', error.message)
    process.exit(1)
  })
}
