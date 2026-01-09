/**
 * Command Installer
 * Installs prjct commands in Claude Code and other editors.
 *
 * 100% Claude-focused architecture
 * Handles installation and synchronization of /p:* commands
 * to Claude's native slash command system
 *
 * @version 0.5.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type {
  InstallResult,
  UninstallResult,
  CheckResult,
  SyncResult,
  GlobalConfigResult,
} from '../types'

// =============================================================================
// Global Config
// =============================================================================

/**
 * Install documentation files to ~/.prjct-cli/docs/
 */
export async function installDocs(): Promise<{ success: boolean; error?: string }> {
  try {
    const docsDir = path.join(os.homedir(), '.prjct-cli', 'docs')
    const templateDocsDir = path.join(__dirname, '../../templates/global/docs')

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
 * Install or update global CLAUDE.md configuration
 */
export async function installGlobalConfig(
  claudeConfigPath: string,
  detectClaude: () => Promise<boolean>
): Promise<GlobalConfigResult> {
  const claudeDetected = await detectClaude()

  if (!claudeDetected) {
    return {
      success: false,
      error: 'Claude not detected',
      action: 'skipped',
    }
  }

  try {
    // Ensure ~/.claude directory exists
    const claudeDir = path.join(os.homedir(), '.claude')
    await fs.mkdir(claudeDir, { recursive: true })

    const globalConfigPath = path.join(claudeDir, 'CLAUDE.md')
    const templatePath = path.join(__dirname, '../../templates/global/CLAUDE.md')

    // Read template content
    const templateContent = await fs.readFile(templatePath, 'utf-8')

    // Check if global config already exists
    let existingContent = ''
    let fileExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      fileExists = true
    } catch {
      // File doesn't exist, will create new
      fileExists = false
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
        const updatedContent = existingContent + '\n\n' + templateContent
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
    // Commands are stored in p/ subdirectory, accessed via p. trigger
    // Note: Claude Code bug #2422 prevents native slash command discovery
    // We use the p.md router in commands/ root instead
    this.claudeCommandsPath = path.join(this.homeDir, '.claude', 'commands', 'p')
    this.claudeConfigPath = path.join(this.homeDir, '.claude')
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'commands')
  }

  /**
   * Detect if Claude is installed
   */
  async detectClaude(): Promise<boolean> {
    try {
      await fs.access(this.claudeConfigPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get list of command files to install
   */
  async getCommandFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter((f) => f.endsWith('.md'))
    } catch {
      // Fallback to core commands if template directory not accessible
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
   * Install commands to Claude
   */
  async installCommands(): Promise<InstallResult> {
    const claudeDetected = await this.detectClaude()

    if (!claudeDetected) {
      return {
        success: false,
        error: 'Claude not detected. Please install Claude Code or Claude Desktop first.',
      }
    }

    try {
      // Install the p.md router to enable "p. task" trigger
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
      } catch {
        // Directory not empty or doesn't exist - that's fine
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
    } catch {
      return {
        installed: false,
        claudeDetected: true,
        commands: [],
      }
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
    } catch {
      return false
    }
  }

  /**
   * Install the p.md router to ~/.claude/commands/
   * This enables the "p. task" natural language trigger
   * Claude Code bug #2422 prevents subdirectory slash command discovery
   */
  async installRouter(): Promise<boolean> {
    try {
      const routerSource = path.join(this.templatesDir, 'p.md')
      const routerDest = path.join(this.homeDir, '.claude', 'commands', 'p.md')

      const content = await fs.readFile(routerSource, 'utf-8')
      await fs.writeFile(routerDest, content, 'utf-8')
      return true
    } catch {
      return false
    }
  }

  /**
   * Sync commands - intelligent update that detects and removes orphans
   */
  async syncCommands(): Promise<SyncResult> {
    const claudeDetected = await this.detectClaude()

    if (!claudeDetected) {
      return {
        success: false,
        error: 'Claude not detected',
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
      } catch {
        // Directory doesn't exist yet
        installedFiles = []
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
   * Install or update global CLAUDE.md configuration
   */
  async installGlobalConfig(): Promise<GlobalConfigResult> {
    return installGlobalConfig(this.claudeConfigPath, () => this.detectClaude())
  }

  /**
   * Install documentation files to ~/.prjct-cli/docs/
   */
  async installDocs(): Promise<{ success: boolean; error?: string }> {
    return installDocs()
  }
}

// =============================================================================
// Exports
// =============================================================================

const commandInstaller = new CommandInstaller()
export default commandInstaller
