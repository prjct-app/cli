const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * CommandInstaller - Installs prjct commands to AI editors
 *
 * Handles installation and synchronization of /p:* commands across
 * multiple AI editor environments (Claude Code, Cursor, Codeium, etc.)
 *
 * @version 0.2.1
 */
class CommandInstaller {
  constructor() {
    this.homeDir = os.homedir()
    this.projectPath = process.cwd()

    this.editors = {
      claude: {
        name: 'Claude Code',
        commandsPath: path.join(this.homeDir, '.claude', 'commands', 'p'),
        configPath: path.join(this.homeDir, '.claude'),
        format: 'slash-commands', // *.md with frontmatter
        detected: false,
      },
      cursor: {
        name: 'Cursor AI',
        commandsPath: path.join(this.homeDir, '.cursor', 'commands', 'p'),
        configPath: path.join(this.homeDir, '.cursor'),
        format: 'slash-commands', // *.md with frontmatter
        detected: false,
      },
      codex: {
        name: 'OpenAI Codex',
        commandsPath: path.join(this.homeDir, '.codex', 'instructions.md'),
        configPath: path.join(this.homeDir, '.codex'),
        format: 'agents-md', // Single instructions.md file
        detected: false,
        projectBased: false,
      },
      windsurf: {
        name: 'Windsurf/Codeium',
        commandsPath: path.join(this.homeDir, '.windsurf', 'workflows'),
        configPath: path.join(this.homeDir, '.windsurf'),
        format: 'workflows', // *.md workflows
        detected: false,
        projectBased: false,
      },
    }

    this.templatesDir = path.join(__dirname, '..', 'templates', 'commands')
    this.agentsTemplateDir = path.join(__dirname, '..', 'templates', 'agents')
    this.workflowsTemplateDir = path.join(__dirname, '..', 'templates', 'workflows')
  }

  /**
   * Set project path for project-based editors
   * @param {string} projectPath - Path to the project
   */
  setProjectPath(projectPath) {
    this.projectPath = projectPath
    // codex and windsurf use global paths defined in constructor
  }

  /**
   * Detect which AI editors are installed
   * @param {string} projectPath - Optional project path for project-based editors
   * @returns {Promise<Object>} Object with editor detection results
   */
  async detectEditors(projectPath = null) {
    if (projectPath) {
      this.setProjectPath(projectPath)
    }

    const results = {}

    for (const [key, editor] of Object.entries(this.editors)) {
      try {
        await fs.access(editor.configPath)
        editor.detected = true

        let commandPath = editor.commandsPath
        if (!commandPath && editor.projectBased) {
          commandPath = path.join(this.projectPath, 'AGENTS.md')
        }

        results[key] = { detected: true, path: commandPath, format: editor.format }
      } catch {
        editor.detected = false
        results[key] = { detected: false, path: null, format: editor.format }
      }
    }

    return results
  }

  /**
   * Get list of command files to install
   * @returns {Promise<string[]>} Array of command filenames
   */
  async getCommandFiles() {
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter(f => f.endsWith('.md'))
    } catch (error) {
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
        'roadmap.md',
        'task.md',
        'git.md',
        'fix.md',
        'test.md',
      ]
    }
  }

  /**
   * Generate AGENTS.md content for Codex
   * @returns {Promise<string>} AGENTS.md content
   */
  async generateAgentsMd() {
    const templatePath = path.join(this.agentsTemplateDir, 'AGENTS.md')

    try {
      return await fs.readFile(templatePath, 'utf-8')
    } catch {
      const existingPath = path.join(this.projectPath, 'AGENTS.md')
      try {
        return await fs.readFile(existingPath, 'utf-8')
      } catch {
        return `# AGENTS.md - OpenAI Codex Configuration

This file provides guidance to OpenAI Codex when working with this repository.

## prjct Commands

The project uses prjct-cli for project management. All commands access global data in \`~/.prjct-cli/projects/{id}/\`.

### /p:init
Initialize prjct in current project. Creates global structure and local config.

### /p:now [task]
Set or show current task.
- Read: Show current task from global storage
- Write: Update task in \`~/.prjct-cli/projects/{id}/core/now.md\`

### /p:done
Complete current task and clear focus.

### /p:ship <feature>
Ship and celebrate a completed feature.

### /p:next
Show priority queue of upcoming tasks.

### /p:idea <text>
Capture an idea quickly to the backlog.

### /p:recap
Show project overview with progress metrics.

See complete command documentation in the prjct-cli repository.
`
      }
    }
  }

  /**
   * Generate Windsurf workflow content
   * @param {string} commandName - Command name (e.g., 'now', 'done')
   * @returns {Promise<string>} Workflow content
   */
  async generateWorkflow(commandName) {
    const templatePath = path.join(this.workflowsTemplateDir, `${commandName}.md`)

    try {
      return await fs.readFile(templatePath, 'utf-8')
    } catch {
      const invocableName = `p:${commandName}`
      return `---
title: prjct ${commandName}
invocable_name: ${invocableName}
description: Execute prjct ${commandName} command
---

# Steps

1. Read project config from \`.prjct/prjct.config.json\`
2. Get project ID from config
3. Execute ${commandName} operation on global data in \`~/.prjct-cli/projects/{id}/\`
4. Update relevant files in appropriate layers (core, progress, planning, memory)
5. Log action to memory with timestamp
6. Display confirmation with next suggested actions

For detailed implementation, see prjct-cli documentation.
`
    }
  }

  /**
   * Install commands to a specific editor
   * @param {string} editorKey - Editor identifier (claude, cursor, codex, windsurf)
   * @param {boolean} forceUpdate - Force update existing commands
   * @returns {Promise<Object>} Installation result
   */
  async installToEditor(editorKey, forceUpdate = false) {
    const editor = this.editors[editorKey]

    if (!editor) {
      return { success: false, message: `Unknown editor: ${editorKey}` }
    }

    if (!editor.detected) {
      return { success: false, message: `${editor.name} not detected` }
    }

    try {
      switch (editor.format) {
        case 'slash-commands':
          return await this.installSlashCommands(editorKey, forceUpdate)
        case 'agents-md':
          return await this.installAgentsMd(editorKey, forceUpdate)
        case 'workflows':
          return await this.installWorkflows(editorKey, forceUpdate)
        default:
          return {
            success: false,
            message: `Unknown format: ${editor.format}`,
          }
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed for ${editor.name}: ${error.message}`,
      }
    }
  }

  /**
   * Install slash commands format (Claude, Cursor)
   */
  async installSlashCommands(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]

    await fs.mkdir(editor.commandsPath, { recursive: true })

    const commandFiles = await this.getCommandFiles()
    const installed = []
    const skipped = []
    const updated = []

    for (const filename of commandFiles) {
      const targetPath = path.join(editor.commandsPath, filename)
      const templatePath = path.join(this.templatesDir, filename)

      const exists = await this.fileExists(targetPath)

      if (exists && !forceUpdate) {
        skipped.push(filename)
        continue
      }

      let content
      try {
        content = await fs.readFile(templatePath, 'utf-8')
      } catch {
        const claudePath = path.join(this.editors.claude.commandsPath, filename)
        try {
          content = await fs.readFile(claudePath, 'utf-8')
          content = this.updateCommandForGlobalArchitecture(content)
        } catch {
          skipped.push(filename)
          continue
        }
      }

      await fs.writeFile(targetPath, content, 'utf-8')

      if (exists) {
        updated.push(filename)
      } else {
        installed.push(filename)
      }
    }

    return {
      success: true,
      editor: editor.name,
      format: 'slash-commands',
      installed: installed.length,
      updated: updated.length,
      skipped: skipped.length,
      details: { installed, updated, skipped },
    }
  }

  /**
   * Install AGENTS.md format (Codex)
   */
  async installAgentsMd(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]
    const targetPath = editor.commandsPath

    const exists = await this.fileExists(targetPath)

    if (exists && !forceUpdate) {
      return {
        success: true,
        editor: editor.name,
        format: 'agents-md',
        installed: 0,
        updated: 0,
        skipped: 1,
        details: { installed: [], updated: [], skipped: ['AGENTS.md'] },
      }
    }

    const content = await this.generateAgentsMd()

    await fs.writeFile(targetPath, content, 'utf-8')

    return {
      success: true,
      editor: editor.name,
      format: 'agents-md',
      installed: exists ? 0 : 1,
      updated: exists ? 1 : 0,
      skipped: 0,
      details: {
        installed: exists ? [] : ['AGENTS.md'],
        updated: exists ? ['AGENTS.md'] : [],
        skipped: [],
      },
    }
  }

  /**
   * Install workflows format (Windsurf)
   */
  async installWorkflows(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]

    await fs.mkdir(editor.commandsPath, { recursive: true })

    const commandFiles = await this.getCommandFiles()
    const commandNames = commandFiles.map(f => f.replace('.md', ''))

    const installed = []
    const skipped = []
    const updated = []

    for (const commandName of commandNames) {
      const filename = `p_${commandName}.md` // e.g., p_now.md
      const targetPath = path.join(editor.commandsPath, filename)

      const exists = await this.fileExists(targetPath)

      if (exists && !forceUpdate) {
        skipped.push(filename)
        continue
      }

      const content = await this.generateWorkflow(commandName)

      await fs.writeFile(targetPath, content, 'utf-8')

      if (exists) {
        updated.push(filename)
      } else {
        installed.push(filename)
      }
    }

    return {
      success: true,
      editor: editor.name,
      format: 'workflows',
      installed: installed.length,
      updated: updated.length,
      skipped: skipped.length,
      details: { installed, updated, skipped },
    }
  }

  /**
   * Install commands to selected editors
   * @param {string[]} selectedEditors - Array of editor keys to install to
   * @param {boolean} forceUpdate - Force update existing commands
   * @returns {Promise<Object>} Installation results for selected editors
   */
  async installToSelected(selectedEditors, forceUpdate = false) {
    await this.detectEditors(this.projectPath)

    const results = {}
    const installedTo = []
    const successfulEditors = []

    for (const editorKey of selectedEditors) {
      const editor = this.editors[editorKey]

      if (!editor) {
        results[editorKey] = {
          success: false,
          message: `Unknown editor: ${editorKey}`,
        }
        continue
      }

      if (!editor.detected) {
        results[editorKey] = {
          success: false,
          message: `${editor.name} not detected on this system`,
        }
        continue
      }

      results[editorKey] = await this.installToEditor(editorKey, forceUpdate)
      if (results[editorKey].success) {
        installedTo.push(editor.name)
        successfulEditors.push(editorKey)
      }
    }

    if (installedTo.length === 0) {
      return {
        success: false,
        message: 'No editors were successfully installed to',
        results,
      }
    }

    const totalInstalled = Object.values(results)
      .reduce((sum, r) => sum + (r.installed || 0), 0)
    const totalUpdated = Object.values(results)
      .reduce((sum, r) => sum + (r.updated || 0), 0)

    // Always save editor selections to config for tracking updates
    if (successfulEditors.length > 0) {
      await this.saveEditorConfig(successfulEditors)
    }

    return {
      success: true,
      editors: installedTo,
      totalInstalled,
      totalUpdated,
      results,
    }
  }

  /**
   * Install commands to all detected editors
   * @param {boolean} forceUpdate - Force update existing commands
   * @returns {Promise<Object>} Installation results for all editors
   */
  async installToAll(forceUpdate = false) {
    const detection = await this.detectEditors(this.projectPath)
    const detectedEditors = Object.entries(detection)
      .filter(([_, info]) => info.detected)
      .map(([key, _]) => key)

    if (detectedEditors.length === 0) {
      return {
        success: false,
        message: 'No AI editors detected',
        results: {},
      }
    }

    return await this.installToSelected(detectedEditors, forceUpdate)
  }

  /**
   * Uninstall commands from a specific editor
   * @param {string} editorKey - Editor key (claude, cursor, windsurf, codex)
   * @returns {Promise<Object>} Uninstall result
   */
  async uninstallFromEditor(editorKey) {
    const chalk = require('chalk')
    const editorsConfig = require('./editors-config')

    const editor = this.editors[editorKey]
    if (!editor) {
      return {
        success: false,
        message: `Unknown editor: ${editorKey}`,
      }
    }

    try {
      // Delete commands from editor
      const commandsPath = editor.path
      const fs = require('fs').promises

      // Get list of prjct commands
      const commands = ['init', 'now', 'done', 'ship', 'next', 'idea', 'recap', 'progress', 'stuck', 'context',
        'cleanup', 'design', 'task', 'git', 'test', 'roadmap', 'fix', 'analyze']

      let deletedCount = 0

      for (const command of commands) {
        const commandFile = path.join(commandsPath, `p:${command}.md`)
        try {
          await fs.unlink(commandFile)
          deletedCount++
        } catch {
          // Command file doesn't exist, skip
        }
      }

      // Remove editor from tracked list
      await editorsConfig.removeTrackedEditor(editorKey)

      console.log(chalk.yellow(`🗑️  Removed ${deletedCount} commands from ${editor.name}`))

      return {
        success: true,
        message: `Removed commands from ${editor.name}`,
        deleted: deletedCount,
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error removing commands from ${editor.name}:`), error.message)
      return {
        success: false,
        message: `Failed to remove commands: ${error.message}`,
      }
    }
  }

  /**
   * Interactive installation with user selection using prompts
   * @param {boolean} allowUninstall - Allow uninstalling editors
   * @returns {Promise<Object>} Installation results
   */
  async interactiveInstall(allowUninstall = false) {
    const prompts = require('prompts')
    const editorsConfig = require('./editors-config')

    // Detect all editors
    const detected = await this.detectEditors(this.projectPath)

    // Get currently installed editors if allowUninstall
    let installedEditors = []
    if (allowUninstall) {
      try {
        installedEditors = await editorsConfig.getTrackedEditors()
      } catch {
        // No editors installed yet
      }
    }

    // Create choices for prompts
    const availableEditors = Object.entries(detected)
      .filter(([_, info]) => info.detected)
      .map(([key, info]) => ({
        title: `${this.editors[key].name} (${info.path})`,
        value: key,
        // Pre-select if allowUninstall and already installed, otherwise select all
        selected: allowUninstall ? installedEditors.includes(key) : true,
      }))

    if (availableEditors.length === 0) {
      return {
        success: false,
        message: 'No AI editors detected on this system.\n\nSupported editors:\n  • Claude Code (~/.claude)\n  • Cursor AI (~/.cursor)\n  • Windsurf/Codeium (~/.windsurf)\n  • OpenAI Codex (~/.codex)',
        editors: [],
        results: {},
      }
    }

    // Show interactive selection prompt
    const response = await prompts({
      type: 'multiselect',
      name: 'selectedEditors',
      message: allowUninstall ? 'Select AI editors (uncheck to remove):' : 'Select AI editors to install commands to:',
      choices: availableEditors,
      min: allowUninstall ? 0 : 1, // Allow 0 selections if uninstalling
      hint: '- Space to select. Return to submit',
      instructions: false,
    })

    // Check if user cancelled
    if (response.selectedEditors === undefined) {
      return {
        success: false,
        message: 'Installation cancelled by user',
        editors: [],
        results: {},
      }
    }

    const selectedEditors = response.selectedEditors || []

    // If allowUninstall, handle editors that were deselected
    if (allowUninstall) {
      const deselectedEditors = installedEditors.filter(e => !selectedEditors.includes(e))

      for (const editorKey of deselectedEditors) {
        await this.uninstallFromEditor(editorKey)
      }
    }

    // Install to selected editors (or return success if none selected)
    if (selectedEditors.length === 0) {
      return {
        success: true,
        message: 'All editors removed',
        editors: [],
        results: {},
      }
    }

    return await this.installToSelected(selectedEditors, true) // Force update
  }

  /**
   * Update command content to use global architecture
   * @param {string} content - Original command content
   * @returns {string} Updated content
   */
  updateCommandForGlobalArchitecture(content) {
    let updated = content.replace(
      /\.prjct\//g,
      '~/.prjct-cli/projects/{id}/',
    )

    if (!content.includes('Global Architecture')) {
      const frontmatter = content.match(/^---[\s\S]*?---/m)
      if (frontmatter) {
        const note = `

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: \`~/.prjct-cli/projects/{id}/\`
- Config stored in: \`{project}/.prjct/prjct.config.json\`
- Commands synchronized across all editors

`
        updated = content.replace(frontmatter[0], frontmatter[0] + note)
      }
    }

    return updated
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create command templates directory and copy existing commands
   * @returns {Promise<Object>} Template creation result
   */
  async createTemplates() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true })

      const claudeCommandsPath = this.editors.claude.commandsPath
      const hasClaudeCommands = await this.fileExists(claudeCommandsPath)

      if (!hasClaudeCommands) {
        return {
          success: false,
          message: 'No source commands found. Claude Code commands directory not detected.',
        }
      }

      const files = await fs.readdir(claudeCommandsPath)
      const mdFiles = files.filter(f => f.endsWith('.md'))

      let copied = 0
      for (const filename of mdFiles) {
        const sourcePath = path.join(claudeCommandsPath, filename)
        const targetPath = path.join(this.templatesDir, filename)

        const content = await fs.readFile(sourcePath, 'utf-8')
        const updated = this.updateCommandForGlobalArchitecture(content)

        await fs.writeFile(targetPath, updated, 'utf-8')
        copied++
      }

      return {
        success: true,
        message: `Created ${copied} command templates`,
        count: copied,
      }
    } catch (error) {
      return {
        success: false,
        message: `Template creation failed: ${error.message}`,
      }
    }
  }

  /**
   * Generate installation report
   * @param {Object} results - Installation results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    if (!results.success) {
      return `❌ Installation failed: ${results.message}`
    }

    // Handle single editor installation (installToEditor returns different format)
    if (results.editor && !results.editors) {
      const lines = [
        '✅ Command Installation Complete!',
        '',
        `📦 Editor: ${results.editor}`,
        `📝 Commands installed: ${results.installed}`,
        `🔄 Commands updated: ${results.updated}`,
        `⊘ Commands skipped: ${results.skipped}`,
        '',
        '💡 Commands are now available in your editor!',
      ]
      return lines.join('\n')
    }

    // Handle multiple editors installation (installToSelected/installToAll)
    const lines = [
      '✅ Command Installation Complete!',
      '',
      `📦 Editors: ${results.editors.join(', ')}`,
      `📝 Commands installed: ${results.totalInstalled}`,
      `🔄 Commands updated: ${results.totalUpdated}`,
      '',
    ]

    for (const [key, result] of Object.entries(results.results)) {
      if (result.success) {
        lines.push(`${this.editors[key].name}:`)
        lines.push(`  ✓ Installed: ${result.installed}`)
        lines.push(`  ↻ Updated: ${result.updated}`)
        lines.push(`  ⊘ Skipped: ${result.skipped}`)
      }
    }

    lines.push('')
    lines.push('💡 Commands are now available in all detected editors!')

    return lines.join('\n')
  }

  /**
   * Save editor configuration to track installed editors
   * @param {string[]} editors - Array of successfully installed editor keys
   * @returns {Promise<void>}
   */
  async saveEditorConfig(editors) {
    try {
      const editorsConfig = require('./editors-config')
      const packageJson = require('../package.json')

      // Build paths object
      const paths = {}
      for (const editorKey of editors) {
        const editor = this.editors[editorKey]
        if (editor) {
          paths[editorKey] = editor.commandsPath
        }
      }

      await editorsConfig.saveConfig(
        editors,
        paths,
        packageJson.version,
      )
    } catch (error) {
      // Don't fail installation if config save fails
      console.error('[command-installer] Error saving editor config:', error.message)
    }
  }

  /**
   * Install Context7 MCP configuration for all detected editors
   * @returns {Promise<Object>} Installation results
   */
  async installContext7MCP() {
    const results = {
      success: true,
      editors: [],
      details: {},
    }

    const mcpConfigTemplate = path.join(__dirname, '..', 'templates', 'mcp-config.json')
    const mcpConfig = JSON.parse(await fs.readFile(mcpConfigTemplate, 'utf-8'))

    try {
      // 1. Claude Code: ~/.config/claude/claude_desktop_config.json
      if (this.editors.claude.detected) {
        const claudeConfigDir = path.join(this.homeDir, '.config', 'claude')
        const claudeConfigFile = path.join(claudeConfigDir, 'claude_desktop_config.json')

        await fs.mkdir(claudeConfigDir, { recursive: true })

        let config = {}
        if (await this.fileExists(claudeConfigFile)) {
          const content = await fs.readFile(claudeConfigFile, 'utf-8')
          config = JSON.parse(content)
        }

        // Merge Context7 into existing config
        config.mcpServers = config.mcpServers || {}
        config.mcpServers.context7 = mcpConfig.mcpServers.context7

        await fs.writeFile(claudeConfigFile, JSON.stringify(config, null, 2), 'utf-8')
        results.editors.push('Claude Code')
        results.details.claude = { success: true, path: claudeConfigFile }
      }

      // 2. Cursor: ~/.cursor/mcp.json
      if (this.editors.cursor.detected) {
        const cursorMcpFile = path.join(this.homeDir, '.cursor', 'mcp.json')
        await fs.mkdir(path.dirname(cursorMcpFile), { recursive: true })

        let config = {}
        if (await this.fileExists(cursorMcpFile)) {
          const content = await fs.readFile(cursorMcpFile, 'utf-8')
          config = JSON.parse(content)
        }

        config.mcpServers = config.mcpServers || {}
        config.mcpServers.context7 = mcpConfig.mcpServers.context7

        await fs.writeFile(cursorMcpFile, JSON.stringify(config, null, 2), 'utf-8')
        results.editors.push('Cursor')
        results.details.cursor = { success: true, path: cursorMcpFile }
      }

      // 3. Windsurf: ~/.windsurf/mcp.json
      if (this.editors.windsurf.detected) {
        const windsurfMcpFile = path.join(this.homeDir, '.windsurf', 'mcp.json')
        await fs.mkdir(path.dirname(windsurfMcpFile), { recursive: true })

        let config = {}
        if (await this.fileExists(windsurfMcpFile)) {
          const content = await fs.readFile(windsurfMcpFile, 'utf-8')
          config = JSON.parse(content)
        }

        config.mcpServers = config.mcpServers || {}
        config.mcpServers.context7 = mcpConfig.mcpServers.context7

        await fs.writeFile(windsurfMcpFile, JSON.stringify(config, null, 2), 'utf-8')
        results.editors.push('Windsurf')
        results.details.windsurf = { success: true, path: windsurfMcpFile }
      }

      // 4. Codex: Add MCP instructions to ~/.codex/instructions.md
      if (this.editors.codex.detected) {
        const codexInstructions = this.editors.codex.commandsPath

        let content = ''
        if (await this.fileExists(codexInstructions)) {
          content = await fs.readFile(codexInstructions, 'utf-8')
        }

        // Add MCP section if not present
        if (!content.includes('## MCP Integration')) {
          const mcpSection = '\n\n## MCP Integration\n\nThe system integrates with MCP servers:\n\n- **Context7**: Library documentation lookup\n- **Filesystem**: Direct file manipulation\n- **Memory**: Persistent decision storage\n- **Sequential**: Deep reasoning for complex problems\n\n### Using Context7\n\nFor any library or framework questions, use Context7 MCP to lookup official documentation:\n\n```\n# Example: Get React hooks documentation\nUse Context7 to lookup React hooks patterns before implementing\n```\n'
          content += mcpSection
          await fs.writeFile(codexInstructions, content, 'utf-8')
        }

        results.editors.push('Codex')
        results.details.codex = { success: true, path: codexInstructions }
      }

      results.message = `Context7 MCP installed for: ${results.editors.join(', ')}`
    } catch (error) {
      results.success = false
      results.message = `Context7 installation failed: ${error.message}`
    }

    return results
  }

  /**
   * Uninstall commands from a specific editor
   * @param {string} editorKey - Editor identifier (claude, cursor, codex, windsurf)
   * @returns {Promise<Object>} Uninstallation result
   */
  async uninstallFromEditor(editorKey) {
    const editor = this.editors[editorKey]

    if (!editor) {
      return { success: false, editor: editorKey, message: `Unknown editor: ${editorKey}` }
    }

    try {
      switch (editor.format) {
        case 'slash-commands':
          // Remove the /p commands directory
          await fs.rm(editor.commandsPath, { recursive: true, force: true })
          return {
            success: true,
            editor: editor.name,
            path: editor.commandsPath,
            message: `Removed slash commands from ${editor.name}`,
          }

        case 'agents-md':
          // Remove AGENTS.md if it exists
          const exists = await this.fileExists(editor.commandsPath)
          if (exists) {
            await fs.unlink(editor.commandsPath)
          }
          return {
            success: true,
            editor: editor.name,
            path: editor.commandsPath,
            message: `Removed AGENTS.md from ${editor.name}`,
          }

        case 'workflows':
          // Remove all p_*.md workflow files
          try {
            const files = await fs.readdir(editor.commandsPath)
            const prjctWorkflows = files.filter(f => f.startsWith('p_') && f.endsWith('.md'))

            for (const file of prjctWorkflows) {
              await fs.unlink(path.join(editor.commandsPath, file))
            }

            return {
              success: true,
              editor: editor.name,
              path: editor.commandsPath,
              removed: prjctWorkflows.length,
              message: `Removed ${prjctWorkflows.length} workflows from ${editor.name}`,
            }
          } catch (error) {
            // Directory might not exist, that's ok
            return {
              success: true,
              editor: editor.name,
              message: `No workflows found in ${editor.name}`,
            }
          }

        default:
          return {
            success: false,
            editor: editor.name,
            message: `Unknown format: ${editor.format}`,
          }
      }
    } catch (error) {
      return {
        success: false,
        editor: editor.name,
        message: `Uninstall failed: ${error.message}`,
      }
    }
  }

  /**
   * Uninstall commands from all tracked editors
   * @returns {Promise<Object>} Uninstallation results
   */
  async uninstallFromAll() {
    const editorsConfig = require('./editors-config')
    const trackedEditors = await editorsConfig.getTrackedEditors()

    if (trackedEditors.length === 0) {
      return {
        success: true,
        message: 'No editors tracked, nothing to uninstall',
        results: {},
      }
    }

    const results = {}
    const successfulEditors = []

    for (const editorKey of trackedEditors) {
      results[editorKey] = await this.uninstallFromEditor(editorKey)
      if (results[editorKey].success) {
        successfulEditors.push(this.editors[editorKey]?.name || editorKey)
      }
    }

    return {
      success: true,
      editors: successfulEditors,
      totalRemoved: successfulEditors.length,
      results,
    }
  }
}

module.exports = new CommandInstaller()
