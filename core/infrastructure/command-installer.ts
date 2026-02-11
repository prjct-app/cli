/**
 * Command Installer
 * Installs prjct commands in Claude Code and other AI CLI agents.
 *
 * Architecture:
 * - Claude: Full command sync to ~/.claude/commands/p/ (workaround for bug #2422)
 * - Gemini: Simple router (p.toml) to ~/.gemini/commands/ (handled by setup.ts)
 *
 * This module handles the more complex Claude installation.
 * For Gemini, see setup.ts::installGeminiRouter()
 *
 * @version 0.6.0 - Multi-provider support
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent, listTemplates } from '../agentic/template-loader'
import type {
  CheckResult,
  GlobalConfigResult,
  InstallResult,
  SyncResult,
  UninstallResult,
} from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { PACKAGE_ROOT } from '../utils/version'

// =============================================================================
// Module Types
// =============================================================================

interface ModuleProfile {
  description: string
  modules: string[]
}

interface ModuleConfig {
  description: string
  version: string
  profiles: Record<string, ModuleProfile>
  default: string
  commandProfiles: Record<string, string>
}

// =============================================================================
// Modular Template Composition (PRJ-94)
// =============================================================================

/**
 * Load module configuration
 */
async function loadModuleConfig(): Promise<ModuleConfig | null> {
  try {
    // Try bundled templates first, fall back to filesystem
    const content = getTemplateContent('global/modules/module-config.json')
    if (content) return JSON.parse(content) as ModuleConfig

    const configPath = path.join(PACKAGE_ROOT, 'templates/global/modules/module-config.json')
    const fsContent = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(fsContent) as ModuleConfig
  } catch {
    return null
  }
}

/**
 * Compose global template from modules based on profile
 * @param profile - Profile name ('full', 'standard', 'minimal') or null for default
 * @returns Composed template content with markers
 */
export async function composeGlobalTemplate(profile?: string): Promise<string> {
  const config = await loadModuleConfig()

  // Fallback to legacy template if config not found
  if (!config) {
    const legacy = getTemplateContent('global/CLAUDE.md')
    if (legacy) return legacy
    const legacyPath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
    return fs.readFile(legacyPath, 'utf-8')
  }

  const profileName = profile || config.default
  const selectedProfile = config.profiles[profileName]

  if (!selectedProfile) {
    const defaultProfile = config.profiles[config.default]
    if (!defaultProfile) {
      const legacy = getTemplateContent('global/CLAUDE.md')
      if (legacy) return legacy
      const legacyPath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
      return fs.readFile(legacyPath, 'utf-8')
    }
  }

  const modules = (selectedProfile || config.profiles[config.default]).modules

  // Load and compose modules
  const parts: string[] = []
  parts.push('<!-- prjct:start - DO NOT REMOVE THIS MARKER -->')

  for (const moduleName of modules) {
    // Try bundle first, then filesystem
    const content = getTemplateContent(`global/modules/${moduleName}`)
    if (content) {
      parts.push('')
      parts.push(content)
    } else {
      try {
        const modulePath = path.join(PACKAGE_ROOT, 'templates/global/modules', moduleName)
        const fsContent = await fs.readFile(modulePath, 'utf-8')
        parts.push('')
        parts.push(fsContent)
      } catch {
        console.warn(`Module not found: ${moduleName}`)
      }
    }
  }

  parts.push('')
  parts.push('<!-- prjct:end - DO NOT REMOVE THIS MARKER -->')
  parts.push('')

  return parts.join('\n')
}

/**
 * Get recommended profile for a command
 */
export async function getProfileForCommand(command: string): Promise<string> {
  const config = await loadModuleConfig()
  if (!config) return 'default'
  return config.commandProfiles[command] || config.default
}

// =============================================================================
// Global Config
// =============================================================================

/**
 * Install documentation files to ~/.prjct-cli/docs/
 */
export async function installDocs(): Promise<{ success: boolean; error?: string }> {
  try {
    const docsDir = path.join(os.homedir(), '.prjct-cli', 'docs')
    await fs.mkdir(docsDir, { recursive: true })

    // Try bundled templates first
    const docKeys = listTemplates('global/docs/')
    if (docKeys.length > 0) {
      for (const key of docKeys) {
        if (key.endsWith('.md')) {
          const content = getTemplateContent(key)
          if (content) {
            const fileName = path.basename(key)
            await fs.writeFile(path.join(docsDir, fileName), content, 'utf-8')
          }
        }
      }
      return { success: true }
    }

    // Fall back to filesystem
    const templateDocsDir = path.join(PACKAGE_ROOT, 'templates/global/docs')
    const docFiles = await fs.readdir(templateDocsDir)
    for (const file of docFiles) {
      if (file.endsWith('.md')) {
        const srcPath = path.join(templateDocsDir, file)
        const destPath = path.join(docsDir, file)
        const content = await fs.readFile(srcPath, 'utf-8')
        await fs.writeFile(destPath, content, 'utf-8')
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}

/**
 * Install or update global AI agent configuration (CLAUDE.md / GEMINI.md)
 */
export async function installGlobalConfig(): Promise<GlobalConfigResult> {
  const aiProvider = require('./ai-provider')
  const activeProvider = await aiProvider.getActiveProvider()
  const providerName = activeProvider.name

  // Check if provider is installed
  const detection = await aiProvider.detectProvider(providerName)
  if (!detection.installed && !activeProvider.configDir) {
    return {
      success: false,
      error: `${activeProvider.displayName} not detected`,
      action: 'skipped',
    }
  }

  try {
    // Ensure config directory exists
    await fs.mkdir(activeProvider.configDir, { recursive: true })

    const globalConfigPath = path.join(activeProvider.configDir, activeProvider.contextFile)
    const templatePath = path.join(PACKAGE_ROOT, 'templates', 'global', activeProvider.contextFile)

    // Read template content - use modular composition (PRJ-94)
    let templateContent = ''
    try {
      // First try provider-specific template (bundle then filesystem)
      const bundled = getTemplateContent(`global/${activeProvider.contextFile}`)
      if (bundled) {
        templateContent = bundled
      } else {
        templateContent = await fs.readFile(templatePath, 'utf-8')
      }
    } catch (_error) {
      // Use modular composition for Claude (PRJ-94)
      if (providerName === 'claude') {
        try {
          templateContent = await composeGlobalTemplate()
        } catch {
          const fallback = getTemplateContent('global/CLAUDE.md')
          if (fallback) {
            templateContent = fallback
          } else {
            const fallbackTemplatePath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
            templateContent = await fs.readFile(fallbackTemplatePath, 'utf-8')
          }
        }
      } else {
        const fallback = getTemplateContent('global/CLAUDE.md')
        if (fallback) {
          templateContent = fallback
        } else {
          const fallbackTemplatePath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
          templateContent = await fs.readFile(fallbackTemplatePath, 'utf-8')
        }
        if (providerName === 'gemini') {
          templateContent = templateContent.replace(/Claude/g, 'Gemini')
        }
      }
    }

    // Check if global config already exists
    let existingContent = ''
    let fileExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      fileExists = true
    } catch (error) {
      if (isNotFoundError(error)) {
        // File doesn't exist, will create new
        fileExists = false
      } else {
        throw error
      }
    }

    if (!fileExists) {
      // Create new file with full template
      await fs.writeFile(globalConfigPath, templateContent, 'utf-8')
      return {
        success: true,
        action: 'created',
        path: globalConfigPath,
      }
    } else {
      // File exists - perform intelligent merge
      const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
      const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

      // Check if markers exist in existing file
      const hasMarkers =
        existingContent.includes(startMarker) && existingContent.includes(endMarker)

      if (!hasMarkers) {
        // No markers - append prjct section at the end
        const updatedContent = `${existingContent}\n\n${templateContent}`
        await fs.writeFile(globalConfigPath, updatedContent, 'utf-8')
        return {
          success: true,
          action: 'appended',
          path: globalConfigPath,
        }
      } else {
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
        return {
          success: true,
          action: 'updated',
          path: globalConfigPath,
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      action: 'failed',
    }
  }
}

// =============================================================================
// Command Installer
// =============================================================================

export class CommandInstaller {
  homeDir: string
  claudeCommandsPath = ''
  claudeConfigPath = ''
  templatesDir: string
  private _initialized = false

  constructor() {
    this.homeDir = os.homedir()
    this.templatesDir = path.join(PACKAGE_ROOT, 'templates', 'commands')
  }

  private async ensureInit(): Promise<void> {
    if (this._initialized) return

    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    // Command paths are provider-specific
    if (activeProvider.name === 'gemini') {
      this.claudeCommandsPath = path.join(activeProvider.configDir, 'commands')
    } else {
      // Claude: Commands are in p/ subdirectory to avoid cluttering commands/
      this.claudeCommandsPath = path.join(activeProvider.configDir, 'commands', 'p')
    }

    this.claudeConfigPath = activeProvider.configDir
    this._initialized = true
  }

  /**
   * Detect if active provider is installed
   */
  async detectActiveProvider(): Promise<boolean> {
    await this.ensureInit()
    try {
      await fs.access(this.claudeConfigPath)
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  /**
   * Detect if Claude is installed (legacy support)
   */
  async detectClaude(): Promise<boolean> {
    return this.detectActiveProvider()
  }

  /**
   * Get list of command files to install
   */
  async getCommandFiles(): Promise<string[]> {
    // Router files are installed separately by installRouter()
    // Exclude them from subcommand list to avoid duplicates in ~/.claude/commands/p/
    const routerFiles = new Set(['p.md', 'p.toml'])

    // Try bundled templates first
    const bundled = listTemplates('commands/')
    if (bundled.length > 0) {
      return bundled
        .filter((k) => k.endsWith('.md'))
        .map((k) => k.replace('commands/', ''))
        .filter((f) => !routerFiles.has(f))
    }

    // Fall back to filesystem
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter((f) => f.endsWith('.md') && !routerFiles.has(f))
    } catch (_error) {
      return [
        'init.md',
        'now.md',
        'done.md',
        'ship.md',
        'next.md',
        'idea.md',
        'recap.md',
        'progress.md',
        'stuck.md',
        'context.md',
        'analyze.md',
        'sync.md',
        'roadmap.md',
        'task.md',
        'git.md',
        'fix.md',
        'test.md',
        'cleanup.md',
        'design.md',
      ]
    }
  }

  /**
   * Install commands to active AI agent
   */
  async installCommands(): Promise<InstallResult> {
    const providerDetected = await this.detectActiveProvider()
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    if (!providerDetected) {
      return {
        success: false,
        error: `${activeProvider.displayName} not detected. Please install it first.`,
      }
    }

    try {
      // Install the router to enable "p. task" trigger
      await this.installRouter()

      // Ensure commands directory exists
      await fs.mkdir(this.claudeCommandsPath, { recursive: true })

      const commandFiles = await this.getCommandFiles()
      const installed: string[] = []
      const errors: Array<{ file: string; error: string }> = []

      for (const file of commandFiles) {
        try {
          const destPath = path.join(this.claudeCommandsPath, file)

          // Try bundle first, then filesystem
          const bundled = getTemplateContent(`commands/${file}`)
          if (bundled) {
            await fs.writeFile(destPath, bundled, 'utf-8')
          } else {
            const sourcePath = path.join(this.templatesDir, file)
            const content = await fs.readFile(sourcePath, 'utf-8')
            await fs.writeFile(destPath, content, 'utf-8')
          }

          installed.push(file.replace('.md', ''))
        } catch (error) {
          errors.push({ file, error: getErrorMessage(error) })
        }
      }

      return {
        success: true,
        installed,
        errors,
        path: this.claudeCommandsPath,
      }
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      }
    }
  }

  /**
   * Uninstall commands from Claude
   */
  async uninstallCommands(): Promise<UninstallResult> {
    try {
      const commandFiles = await this.getCommandFiles()
      const uninstalled: string[] = []
      const errors: Array<{ file: string; error: string }> = []

      for (const file of commandFiles) {
        try {
          const filePath = path.join(this.claudeCommandsPath, file)
          await fs.unlink(filePath)
          uninstalled.push(file.replace('.md', ''))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            errors.push({ file, error: getErrorMessage(error) })
          }
        }
      }

      // Try to remove the /p directory if empty
      try {
        await fs.rmdir(this.claudeCommandsPath)
      } catch (_error) {
        // Directory not empty or doesn't exist - that's fine (ENOTEMPTY or ENOENT)
      }

      return {
        success: true,
        uninstalled,
        errors,
      }
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      }
    }
  }

  /**
   * Check if commands are already installed
   */
  async checkInstallation(): Promise<CheckResult> {
    const claudeDetected = await this.detectClaude()

    if (!claudeDetected) {
      return {
        installed: false,
        claudeDetected: false,
      }
    }

    try {
      await fs.access(this.claudeCommandsPath)
      const files = await fs.readdir(this.claudeCommandsPath)
      const installedCommands = files
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))

      return {
        installed: installedCommands.length > 0,
        claudeDetected: true,
        commands: installedCommands,
        path: this.claudeCommandsPath,
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          installed: false,
          claudeDetected: true,
          commands: [],
        }
      }
      throw error
    }
  }

  /**
   * Update commands (reinstall with latest templates)
   */
  async updateCommands(): Promise<InstallResult> {
    // Simply reinstall - will overwrite with latest templates
    console.log('Updating commands with latest templates...')
    const result = await this.installCommands()
    if (result.success && result.installed) {
      console.log(`Updated ${result.installed.length} commands`)
    }
    return result
  }

  /**
   * Install to all detected editors (alias for installCommands)
   */
  async installToAll(): Promise<InstallResult> {
    return await this.installCommands()
  }

  /**
   * Get installation path for Claude commands
   */
  async getInstallPath(): Promise<string> {
    await this.ensureInit()
    return this.claudeCommandsPath
  }

  /**
   * Verify command template exists
   */
  async verifyTemplate(commandName: string): Promise<boolean> {
    // Check bundle first
    const bundled = getTemplateContent(`commands/${commandName}.md`)
    if (bundled) return true

    // Fall back to filesystem
    try {
      const templatePath = path.join(this.templatesDir, `${commandName}.md`)
      await fs.access(templatePath)
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  /**
   * Install the router (p.md for Claude, p.toml for Gemini) to commands directory
   * This enables the "p. task" natural language trigger
   */
  async installRouter(): Promise<boolean> {
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()
    const routerFile = activeProvider.name === 'gemini' ? 'p.toml' : 'p.md'

    try {
      const routerDest = path.join(activeProvider.configDir, 'commands', routerFile)
      await fs.mkdir(path.dirname(routerDest), { recursive: true })

      // Try bundle first, then filesystem
      const bundled = getTemplateContent(`commands/${routerFile}`)
      if (bundled) {
        await fs.writeFile(routerDest, bundled, 'utf-8')
        return true
      }

      const routerSource = path.join(this.templatesDir, routerFile)
      const content = await fs.readFile(routerSource, 'utf-8')
      await fs.writeFile(routerDest, content, 'utf-8')
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  /**
   * Remove legacy p.*.md files from commands root directory
   * These were replaced by the p/ subdirectory structure in v0.50+
   */
  async removeLegacyCommands(): Promise<number> {
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()
    const commandsRoot = path.join(activeProvider.configDir, 'commands')

    let removed = 0

    try {
      const files = await fs.readdir(commandsRoot)
      const legacyFiles = files.filter((f) => f.startsWith('p.') && f.endsWith('.md'))

      for (const file of legacyFiles) {
        try {
          await fs.unlink(path.join(commandsRoot, file))
          removed++
        } catch {
          // Ignore errors removing individual files
        }
      }
    } catch {
      // Ignore errors if directory doesn't exist
    }

    return removed
  }

  /**
   * Sync commands - intelligent update that detects and removes orphans
   */
  async syncCommands(): Promise<SyncResult> {
    const providerDetected = await this.detectActiveProvider()

    if (!providerDetected) {
      return {
        success: false,
        error: 'AI agent not detected',
        added: 0,
        updated: 0,
        removed: 0,
      }
    }

    try {
      // Install the p.md router to enable "p. task" trigger
      await this.installRouter()

      // Ensure commands directory exists
      await fs.mkdir(this.claudeCommandsPath, { recursive: true })

      // Get current state
      const templateFiles = await this.getCommandFiles()
      let installedFiles: string[] = []

      try {
        installedFiles = await fs.readdir(this.claudeCommandsPath)
        installedFiles = installedFiles.filter((f) => f.endsWith('.md'))
      } catch (error) {
        if (isNotFoundError(error)) {
          // Directory doesn't exist yet
          installedFiles = []
        } else {
          throw error
        }
      }

      const results: SyncResult = {
        success: true,
        added: 0,
        updated: 0,
        removed: 0,
        errors: [],
      }

      // Install/update all template files (always overwrite)
      for (const file of templateFiles) {
        try {
          const destPath = path.join(this.claudeCommandsPath, file)

          // Check if file exists in installed location
          const exists = installedFiles.includes(file)

          // Try bundle first, then filesystem
          const bundled = getTemplateContent(`commands/${file}`)
          if (bundled) {
            await fs.writeFile(destPath, bundled, 'utf-8')
          } else {
            const sourcePath = path.join(this.templatesDir, file)
            const content = await fs.readFile(sourcePath, 'utf-8')
            await fs.writeFile(destPath, content, 'utf-8')
          }

          if (!exists) {
            results.added++
          } else {
            results.updated++
          }
        } catch (error) {
          results.errors!.push({ file, error: getErrorMessage(error) })
        }
      }

      // Remove legacy p.*.md files from commands root (old naming convention)
      // These were replaced by p/ subdirectory structure
      await this.removeLegacyCommands()

      return results
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        added: 0,
        updated: 0,
        removed: 0,
      }
    }
  }

  /**
   * Install or update global AI agent configuration (CLAUDE.md / GEMINI.md)
   */
  async installGlobalConfig(): Promise<GlobalConfigResult> {
    return installGlobalConfig()
  }

  /**
   * Install documentation files to ~/.prjct-cli/docs/
   */
  async installDocs(): Promise<{ success: boolean; error?: string }> {
    return installDocs()
  }
}

// =============================================================================
// Multi-Provider Support
// =============================================================================

/**
 * Get installation paths for all providers
 */
export function getProviderPaths(): {
  claude: { commands: string; config: string; router: string }
  gemini: { commands: string; config: string; router: string }
} {
  const homeDir = os.homedir()
  return {
    claude: {
      commands: path.join(homeDir, '.claude', 'commands', 'p'),
      config: path.join(homeDir, '.claude'),
      router: path.join(homeDir, '.claude', 'commands', 'p.md'),
    },
    gemini: {
      commands: path.join(homeDir, '.gemini', 'commands'),
      config: path.join(homeDir, '.gemini'),
      router: path.join(homeDir, '.gemini', 'commands', 'p.toml'),
    },
  }
}

/**
 * Check if provider router is installed
 */
export async function isRouterInstalled(provider: 'claude' | 'gemini'): Promise<boolean> {
  const paths = getProviderPaths()
  const routerPath = paths[provider].router

  try {
    await fs.access(routerPath)
    return true
  } catch {
    return false
  }
}

// =============================================================================
// Exports
// =============================================================================

const commandInstaller = new CommandInstaller()
export default commandInstaller
