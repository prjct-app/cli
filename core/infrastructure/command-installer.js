const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * CommandInstaller - Installs prjct commands to Claude (Code + Desktop)
 *
 * 100% Claude-focused architecture
 * Handles installation and synchronization of /p:* commands
 * to Claude's native slash command system
 *
 * @version 0.5.0
 */
class CommandInstaller {
  constructor() {
    this.homeDir = os.homedir()
    this.claudeCommandsPath = path.join(this.homeDir, '.claude', 'commands', 'p')
    this.claudeConfigPath = path.join(this.homeDir, '.claude')
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'commands')
  }

  /**
   * Detect if Claude is installed
   * @returns {Promise<boolean>} True if Claude directory exists
   */
  async detectClaude() {
    try {
      await fs.access(this.claudeConfigPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get list of command files to install
   * @returns {Promise<string[]>} Array of command filenames
   */
  async getCommandFiles() {
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter((f) => f.endsWith('.md'))
    } catch (error) {
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
   * @returns {Promise<Object>} Installation results
   */
  async installCommands() {
    const claudeDetected = await this.detectClaude()

    if (!claudeDetected) {
      return {
        success: false,
        error: 'Claude not detected. Please install Claude Code or Claude Desktop first.',
      }
    }

    try {
      // Ensure commands directory exists
      await fs.mkdir(this.claudeCommandsPath, { recursive: true })

      const commandFiles = await this.getCommandFiles()
      const installed = []
      const errors = []

      for (const file of commandFiles) {
        try {
          const sourcePath = path.join(this.templatesDir, file)
          const destPath = path.join(this.claudeCommandsPath, file)

          const content = await fs.readFile(sourcePath, 'utf-8')
          await fs.writeFile(destPath, content, 'utf-8')

          installed.push(file.replace('.md', ''))
        } catch (error) {
          errors.push({ file, error: error.message })
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
        error: error.message,
      }
    }
  }

  /**
   * Uninstall commands from Claude
   * @returns {Promise<Object>} Uninstallation results
   */
  async uninstallCommands() {
    try {
      const commandFiles = await this.getCommandFiles()
      const uninstalled = []
      const errors = []

      for (const file of commandFiles) {
        try {
          const filePath = path.join(this.claudeCommandsPath, file)
          await fs.unlink(filePath)
          uninstalled.push(file.replace('.md', ''))
        } catch (error) {
          if (error.code !== 'ENOENT') {
            errors.push({ file, error: error.message })
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
        error: error.message,
      }
    }
  }

  /**
   * Check if commands are already installed
   * @returns {Promise<Object>} Installation status
   */
  async checkInstallation() {
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
   * @returns {Promise<Object>} Update results
   */
  async updateCommands() {
    // Simply reinstall - will overwrite with latest templates
    console.log('🔄 Updating commands with latest templates...')
    const result = await this.installCommands()
    if (result.success) {
      console.log(`✅ Updated ${result.installed.length} commands`)
    }
    return result
  }

  /**
   * Install to all detected editors (alias for installCommands)
   * @returns {Promise<Object>} Installation results
   */
  async installToAll() {
    return await this.installCommands()
  }

  /**
   * Get installation path for Claude commands
   * @returns {string} Path to Claude commands directory
   */
  getInstallPath() {
    return this.claudeCommandsPath
  }

  /**
   * Verify command template exists
   * @param {string} commandName - Command name (without .md extension)
   * @returns {Promise<boolean>} True if template exists
   */
  async verifyTemplate(commandName) {
    try {
      const templatePath = path.join(this.templatesDir, `${commandName}.md`)
      await fs.access(templatePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Sync commands - intelligent update that detects and removes orphans
   * @returns {Promise<Object>} Sync results with added, updated, removed counts
   */
  async syncCommands() {
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
      // Ensure commands directory exists
      await fs.mkdir(this.claudeCommandsPath, { recursive: true })

      // Get current state
      const templateFiles = await this.getCommandFiles()
      let installedFiles = []

      try {
        installedFiles = await fs.readdir(this.claudeCommandsPath)
        installedFiles = installedFiles.filter((f) => f.endsWith('.md'))
      } catch {
        // Directory doesn't exist yet
        installedFiles = []
      }

      const results = {
        success: true,
        added: 0,
        updated: 0,
        removed: 0,
        errors: [],
      }

      // Detect new and updated files
      for (const file of templateFiles) {
        try {
          const sourcePath = path.join(this.templatesDir, file)
          const destPath = path.join(this.claudeCommandsPath, file)

          // Check if file exists in installed location
          const exists = installedFiles.includes(file)

          if (!exists) {
            // New file
            const content = await fs.readFile(sourcePath, 'utf-8')
            await fs.writeFile(destPath, content, 'utf-8')
            results.added++
          } else {
            // Check if updated (compare modification time or content)
            const sourceStats = await fs.stat(sourcePath)
            const destStats = await fs.stat(destPath)

            if (sourceStats.mtime > destStats.mtime) {
              // Updated file
              const content = await fs.readFile(sourcePath, 'utf-8')
              await fs.writeFile(destPath, content, 'utf-8')
              results.updated++
            }
          }
        } catch (error) {
          results.errors.push({ file, error: error.message })
        }
      }

      // Detect and remove orphaned files
      const orphans = installedFiles.filter((file) => !templateFiles.includes(file))

      for (const orphan of orphans) {
        try {
          const orphanPath = path.join(this.claudeCommandsPath, orphan)
          await fs.unlink(orphanPath)
          results.removed++
        } catch (error) {
          results.errors.push({ file: orphan, error: error.message })
        }
      }

      return results
    } catch (error) {
      return {
        success: false,
        error: error.message,
        added: 0,
        updated: 0,
        removed: 0,
      }
    }
  }

  /**
   * Install or update global CLAUDE.md configuration
   * @returns {Promise<Object>} Result with success status and action taken
   */
  async installGlobalConfig() {
    const claudeDetected = await this.detectClaude()

    if (!claudeDetected) {
      return {
        success: false,
        error: 'Claude not detected',
        action: 'skipped',
      }
    }

    try {
      // Ensure ~/.claude directory exists
      const claudeDir = path.join(require('os').homedir(), '.claude')
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
          const beforeMarker = existingContent.substring(
            0,
            existingContent.indexOf(startMarker)
          )
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
        error: error.message,
        action: 'failed',
      }
    }
  }
}

module.exports = new CommandInstaller()
