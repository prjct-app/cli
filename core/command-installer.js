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

    // Editor configurations
    this.editors = {
      claude: {
        name: 'Claude Code',
        commandsPath: path.join(this.homeDir, '.claude', 'commands', 'p'),
        configPath: path.join(this.homeDir, '.claude'),
        format: 'slash-commands', // *.md with frontmatter
        detected: false
      },
      cursor: {
        name: 'Cursor AI',
        commandsPath: path.join(this.homeDir, '.cursor', 'commands', 'p'),
        configPath: path.join(this.homeDir, '.cursor'),
        format: 'slash-commands', // *.md with frontmatter
        detected: false
      },
      codex: {
        name: 'OpenAI Codex',
        commandsPath: null, // Will be set to {project}/AGENTS.md
        configPath: path.join(this.homeDir, '.codex'),
        format: 'agents-md', // Single AGENTS.md file
        detected: false,
        projectBased: true
      },
      windsurf: {
        name: 'Windsurf/Codeium',
        commandsPath: null, // Will be set to {project}/.windsurf/workflows
        configPath: path.join(this.homeDir, '.codeium', 'windsurf'),
        format: 'workflows', // *.md workflows
        detected: false,
        projectBased: true
      }
    }

    // Template directories
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

    // Update paths for project-based editors
    this.editors.codex.commandsPath = path.join(projectPath, 'AGENTS.md')
    this.editors.windsurf.commandsPath = path.join(projectPath, '.windsurf', 'workflows')
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

        // Set actual command path for results
        let commandPath = editor.commandsPath
        if (!commandPath && editor.projectBased) {
          commandPath = key === 'codex'
            ? path.join(this.projectPath, 'AGENTS.md')
            : path.join(this.projectPath, '.windsurf', 'workflows')
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
      // Templates directory doesn't exist yet, return default commands
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
        'test.md'
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
      // Try to read template
      return await fs.readFile(templatePath, 'utf-8')
    } catch {
      // If template doesn't exist, generate from existing AGENTS.md or create basic one
      const existingPath = path.join(this.projectPath, 'AGENTS.md')
      try {
        return await fs.readFile(existingPath, 'utf-8')
      } catch {
        // Create basic AGENTS.md
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
      // Try to read template
      return await fs.readFile(templatePath, 'utf-8')
    } catch {
      // Generate basic workflow
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
      // Handle different editor formats
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
            message: `Unknown format: ${editor.format}`
          }
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed for ${editor.name}: ${error.message}`
      }
    }
  }

  /**
   * Install slash commands format (Claude, Cursor)
   */
  async installSlashCommands(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]

    // Ensure commands directory exists
    await fs.mkdir(editor.commandsPath, { recursive: true })

    // Get command files
    const commandFiles = await this.getCommandFiles()
    const installed = []
    const skipped = []
    const updated = []

    for (const filename of commandFiles) {
      const targetPath = path.join(editor.commandsPath, filename)
      const templatePath = path.join(this.templatesDir, filename)

      // Check if command already exists
      const exists = await this.fileExists(targetPath)

      if (exists && !forceUpdate) {
        skipped.push(filename)
        continue
      }

      // Read template or use source from Claude Code
      let content
      try {
        content = await fs.readFile(templatePath, 'utf-8')
      } catch {
        // Template doesn't exist, try to copy from Claude Code
        const claudePath = path.join(this.editors.claude.commandsPath, filename)
        try {
          content = await fs.readFile(claudePath, 'utf-8')
          // Update content to use global architecture
          content = this.updateCommandForGlobalArchitecture(content)
        } catch {
          // Skip if neither template nor source exists
          skipped.push(filename)
          continue
        }
      }

      // Write command file
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
      details: { installed, updated, skipped }
    }
  }

  /**
   * Install AGENTS.md format (Codex)
   */
  async installAgentsMd(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]
    const targetPath = editor.commandsPath

    // Check if AGENTS.md already exists
    const exists = await this.fileExists(targetPath)

    if (exists && !forceUpdate) {
      return {
        success: true,
        editor: editor.name,
        format: 'agents-md',
        installed: 0,
        updated: 0,
        skipped: 1,
        details: { installed: [], updated: [], skipped: ['AGENTS.md'] }
      }
    }

    // Generate AGENTS.md content
    const content = await this.generateAgentsMd()

    // Write AGENTS.md
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
        skipped: []
      }
    }
  }

  /**
   * Install workflows format (Windsurf)
   */
  async installWorkflows(editorKey, forceUpdate) {
    const editor = this.editors[editorKey]

    // Ensure workflows directory exists
    await fs.mkdir(editor.commandsPath, { recursive: true })

    // Get command names (without .md extension)
    const commandFiles = await this.getCommandFiles()
    const commandNames = commandFiles.map(f => f.replace('.md', ''))

    const installed = []
    const skipped = []
    const updated = []

    for (const commandName of commandNames) {
      const filename = `p_${commandName}.md` // e.g., p_now.md
      const targetPath = path.join(editor.commandsPath, filename)

      // Check if workflow already exists
      const exists = await this.fileExists(targetPath)

      if (exists && !forceUpdate) {
        skipped.push(filename)
        continue
      }

      // Generate workflow content
      const content = await this.generateWorkflow(commandName)

      // Write workflow file
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
      details: { installed, updated, skipped }
    }
  }

  /**
   * Install commands to all detected editors
   * @param {boolean} forceUpdate - Force update existing commands
   * @returns {Promise<Object>} Installation results for all editors
   */
  async installToAll(forceUpdate = false) {
    // Set project path for project-based editors (Codex, Windsurf)
    await this.detectEditors(this.projectPath)

    const results = {}
    const detectedEditors = Object.entries(this.editors)
      .filter(([_, editor]) => editor.detected)

    if (detectedEditors.length === 0) {
      return {
        success: false,
        message: 'No AI editors detected',
        results: {}
      }
    }

    // Install to all detected editors (cumulative, not exclusive)
    for (const [key, editor] of detectedEditors) {
      results[key] = await this.installToEditor(key, forceUpdate)
    }

    const totalInstalled = Object.values(results)
      .reduce((sum, r) => sum + (r.installed || 0), 0)
    const totalUpdated = Object.values(results)
      .reduce((sum, r) => sum + (r.updated || 0), 0)

    return {
      success: true,
      editors: detectedEditors.map(([_, e]) => e.name),
      totalInstalled,
      totalUpdated,
      results
    }
  }

  /**
   * Update command content to use global architecture
   * @param {string} content - Original command content
   * @returns {string} Updated content
   */
  updateCommandForGlobalArchitecture(content) {
    // Replace local .prjct references with global architecture notes
    let updated = content.replace(
      /\.prjct\//g,
      '~/.prjct-cli/projects/{id}/'
    )

    // Add note about global architecture if not present
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
      // Ensure templates directory exists
      await fs.mkdir(this.templatesDir, { recursive: true })

      // Get source commands from Claude Code if available
      const claudeCommandsPath = this.editors.claude.commandsPath
      const hasClaudeCommands = await this.fileExists(claudeCommandsPath)

      if (!hasClaudeCommands) {
        return {
          success: false,
          message: 'No source commands found. Claude Code commands directory not detected.'
        }
      }

      // Copy commands to templates
      const files = await fs.readdir(claudeCommandsPath)
      const mdFiles = files.filter(f => f.endsWith('.md'))

      let copied = 0
      for (const filename of mdFiles) {
        const sourcePath = path.join(claudeCommandsPath, filename)
        const targetPath = path.join(this.templatesDir, filename)

        // Read, update, and write
        const content = await fs.readFile(sourcePath, 'utf-8')
        const updated = this.updateCommandForGlobalArchitecture(content)

        await fs.writeFile(targetPath, updated, 'utf-8')
        copied++
      }

      return {
        success: true,
        message: `Created ${copied} command templates`,
        count: copied
      }
    } catch (error) {
      return {
        success: false,
        message: `Template creation failed: ${error.message}`
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

    const lines = [
      '✅ Command Installation Complete!',
      '',
      `📦 Editors: ${results.editors.join(', ')}`,
      `📝 Commands installed: ${results.totalInstalled}`,
      `🔄 Commands updated: ${results.totalUpdated}`,
      ''
    ]

    // Details per editor
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
}

module.exports = new CommandInstaller()
