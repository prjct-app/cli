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
import type {
  CheckResult,
  GlobalConfigResult,
  InstallResult,
  SyncResult,
  UninstallResult,
} from '../types'
import { isNotFoundError } from '../types/fs'
import { getPackageRoot } from '../utils/version'

// =============================================================================
// Global Config
// =============================================================================

/**
 * Install documentation files to ~/.prjct-cli/docs/
 */
export async function installDocs(): Promise<{ success: boolean; error?: string }> {
  try {
    const docsDir = path.join(os.homedir(), '.prjct-cli', 'docs')
    const templateDocsDir = path.join(getPackageRoot(), 'templates/global/docs')

    // Ensure docs directory exists
    await fs.mkdir(docsDir, { recursive: true })

    // Read all doc files from template
    const docFiles = await fs.readdir(templateDocsDir)

    // Copy each doc file
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
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Install or update global AI agent configuration (CLAUDE.md / GEMINI.md)
 */
export async function installGlobalConfig(): Promise<GlobalConfigResult> {
  const aiProvider = require('./ai-provider')
  const activeProvider = aiProvider.getActiveProvider()
  const providerName = activeProvider.name

  // Check if provider is installed
  const detection = aiProvider.detectProvider(providerName)
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
    const templatePath = path.join(
      getPackageRoot(),
      'templates',
      'global',
      activeProvider.contextFile
    )

    // Read template content
    let templateContent = ''
    try {
      templateContent = await fs.readFile(templatePath, 'utf-8')
    } catch (_error) {
      // Fallback if provider-specific template not found
      const fallbackTemplatePath = path.join(getPackageRoot(), 'templates/global/CLAUDE.md')
      templateContent = await fs.readFile(fallbackTemplatePath, 'utf-8')
      // If it is Gemini, we should rename Claude to Gemini in the fallback content
      if (providerName === 'gemini') {
        templateContent = templateContent.replace(/Claude/g, 'Gemini')
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
      error: (error as Error).message,
      action: 'failed',
    }
  }
}

// =============================================================================
// Command Installer
// =============================================================================

export class CommandInstaller {
  homeDir: string
  claudeCommandsPath: string
  claudeConfigPath: string
  templatesDir: string

  constructor() {
    this.homeDir = os.homedir()

    const aiProvider = require('./ai-provider')
    const activeProvider = aiProvider.getActiveProvider()

    // Command paths are provider-specific
    if (activeProvider.name === 'gemini') {
      this.claudeCommandsPath = path.join(activeProvider.configDir, 'commands')
    } else {
      // Claude: Commands are in p/ subdirectory to avoid cluttering commands/
      this.claudeCommandsPath = path.join(activeProvider.configDir, 'commands', 'p')
    }

    this.claudeConfigPath = activeProvider.configDir
    this.templatesDir = path.join(getPackageRoot(), 'templates', 'commands')
  }

  /**
   * Detect if active provider is installed
   */
  async detectActiveProvider(): Promise<boolean> {
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
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter((f) => f.endsWith('.md'))
    } catch (_error) {
      // Fallback to core commands if template directory not accessible (ENOENT or other)
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
    const activeProvider = aiProvider.getActiveProvider()

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
          const sourcePath = path.join(this.templatesDir, file)
          const destPath = path.join(this.claudeCommandsPath, file)

          const content = await fs.readFile(sourcePath, 'utf-8')
          await fs.writeFile(destPath, content, 'utf-8')

          installed.push(file.replace('.md', ''))
        } catch (error) {
          errors.push({ file, error: (error as Error).message })
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
        error: (error as Error).message,
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
            errors.push({ file, error: (error as Error).message })
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
        error: (error as Error).message,
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
  getInstallPath(): string {
    return this.claudeCommandsPath
  }

  /**
   * Verify command template exists
   */
  async verifyTemplate(commandName: string): Promise<boolean> {
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
    const activeProvider = aiProvider.getActiveProvider()
    const routerFile = activeProvider.name === 'gemini' ? 'p.toml' : 'p.md'

    try {
      const routerSource = path.join(this.templatesDir, routerFile)
      const routerDest = path.join(activeProvider.configDir, 'commands', routerFile)

      // Ensure commands directory exists
      await fs.mkdir(path.dirname(routerDest), { recursive: true })

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
          const sourcePath = path.join(this.templatesDir, file)
          const destPath = path.join(this.claudeCommandsPath, file)

          // Check if file exists in installed location
          const exists = installedFiles.includes(file)

          // Read and write (always overwrite to ensure latest version)
          const content = await fs.readFile(sourcePath, 'utf-8')
          await fs.writeFile(destPath, content, 'utf-8')

          if (!exists) {
            results.added++
          } else {
            results.updated++
          }
        } catch (error) {
          results.errors!.push({ file, error: (error as Error).message })
        }
      }

      // Note: We do NOT remove orphaned files
      // Legacy commands from older versions are preserved
      // to avoid breaking existing workflows

      return results
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
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
