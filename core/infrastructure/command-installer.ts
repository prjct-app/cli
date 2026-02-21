/**
 * Command Installer
 * Installs prjct commands in Claude Code and other AI CLI agents.
 *
 * Architecture:
 * - Claude: Single router (p.md) in ~/.claude/commands/ — ONE entry point
 * - Gemini: Simple router (p.toml) in ~/.gemini/commands/
 *
 * The router loads templates at runtime from the npm package.
 * No subcommand files are installed — this prevents skill conflicts.
 *
 * @version 0.7.0 - Single source of truth (no p/ subdirectory)
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent, listTemplates } from '../agentic/template-loader'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type {
  CheckResult,
  GlobalConfigResult,
  InstallResult,
  SyncResult,
  UninstallResult,
} from '../types/infrastructure'
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

  if (!config) {
    const fallback = getTemplateContent('global/CLAUDE.md')
    if (fallback) return fallback
    const fallbackPath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
    return fs.readFile(fallbackPath, 'utf-8')
  }

  const profileName = profile || config.default
  const selectedProfile = config.profiles[profileName]

  if (!selectedProfile) {
    const defaultProfile = config.profiles[config.default]
    if (!defaultProfile) {
      const fallback = getTemplateContent('global/CLAUDE.md')
      if (fallback) return fallback
      const fallbackPath = path.join(PACKAGE_ROOT, 'templates/global/CLAUDE.md')
      return fs.readFile(fallbackPath, 'utf-8')
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
  commandsPath = ''
  configPath = ''
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

    // All providers use commands/ directly — no p/ subdirectory
    this.commandsPath = path.join(activeProvider.configDir, 'commands')

    this.configPath = activeProvider.configDir
    this._initialized = true
  }

  /**
   * Detect if active provider is installed
   */
  async detectActiveProvider(): Promise<boolean> {
    await this.ensureInit()
    try {
      await fs.access(this.configPath)
      return true
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }

  /**
   * Get list of command files to install
   */
  async getCommandFiles(): Promise<string[]> {
    // Router files are installed separately by installRouter()
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
    const files = await fs.readdir(this.templatesDir)
    return files.filter((f) => f.endsWith('.md') && !routerFiles.has(f))
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
      await this.installRouter()

      return {
        success: true,
        installed: ['p (router)'],
        path: this.commandsPath,
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
      const uninstalled: string[] = []

      // Remove the router (p.md)
      const aiProvider = require('./ai-provider')
      const activeProvider = await aiProvider.getActiveProvider()
      const routerFile = activeProvider.name === 'gemini' ? 'p.toml' : 'p.md'
      const routerPath = path.join(this.commandsPath, routerFile)

      try {
        await fs.unlink(routerPath)
        uninstalled.push('p (router)')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          return { success: false, error: getErrorMessage(error) }
        }
      }

      return {
        success: true,
        uninstalled,
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
    const providerDetected = await this.detectActiveProvider()

    if (!providerDetected) {
      return {
        installed: false,
        providerDetected: false,
      }
    }

    try {
      const aiProvider = require('./ai-provider')
      const activeProvider = await aiProvider.getActiveProvider()
      const routerFile = activeProvider.name === 'gemini' ? 'p.toml' : 'p.md'
      const routerPath = path.join(this.commandsPath, routerFile)

      await fs.access(routerPath)

      return {
        installed: true,
        providerDetected: true,
        commands: ['p (router)'],
        path: this.commandsPath,
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          installed: false,
          providerDetected: true,
          commands: [],
        }
      }
      throw error
    }
  }

  /**
   * Get installation path for Claude commands
   */
  async getInstallPath(): Promise<string> {
    await this.ensureInit()
    return this.commandsPath
  }

  /**
   * Install the router (p.md for Claude, p.toml for Gemini) to commands directory
   * This enables the "p. task" natural language trigger
   */
  async installRouter(): Promise<boolean> {
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    if (activeProvider.name === 'gemini') {
      // Gemini uses TOML — keep static
      return this.installStaticRouter('p.toml')
    }

    // Claude: generate dynamic router with current command list
    try {
      const routerDest = path.join(activeProvider.configDir, 'commands', 'p.md')
      await fs.mkdir(path.dirname(routerDest), { recursive: true })

      const content = await this.generateRouterContent()
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
   * Install a static router file (used for Gemini p.toml)
   */
  private async installStaticRouter(routerFile: string): Promise<boolean> {
    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    try {
      const routerDest = path.join(activeProvider.configDir, 'commands', routerFile)
      await fs.mkdir(path.dirname(routerDest), { recursive: true })

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
   * Generate dynamic router content from available templates
   */
  private async generateRouterContent(): Promise<string> {
    const commandFiles = await this.getCommandFiles()

    // Build Quick Reference table from available commands
    const commandDescriptions: Record<string, string> = {
      task: 'Start a task',
      done: 'Complete current subtask',
      ship: 'Ship feature with PR + version bump',
      sync: 'Analyze project, regenerate agents',
      pause: 'Pause current task',
      resume: 'Resume paused task',
      next: 'Show priority queue',
      idea: 'Quick idea capture',
      bug: 'Report bug with auto-priority',
      dash: 'Dashboard view',
      status: 'Project status check',
      linear: 'Linear integration (via MCP)',
      jira: 'JIRA integration (via MCP)',
      init: 'Initialize prjct in a project',
      analyze: 'Deep repository analysis',
      plan: 'Create implementation plan',
      design: 'UI/UX design workflow',
      test: 'Test workflow',
      cleanup: 'Code cleanup',
      git: 'Git operations',
      review: 'Code review',
      history: 'Task history & undo/redo',
      sessions: 'Session management',
      workflow: 'Workflow management',
      enrich: 'Enrich task context',
      impact: 'Impact analysis',
      learnings: 'View learned patterns',
      merge: 'Merge workflow',
      prd: 'Product requirements doc',
      serve: 'Start dev server',
      setup: 'Setup prjct',
      spec: 'Technical specification',
      update: 'Update prjct',
      verify: 'Verify analysis integrity',
      auth: 'Authentication',
    }

    // Filter to only available commands
    const tableRows: string[] = []
    for (const file of commandFiles) {
      const name = file.replace('.md', '')
      const desc = commandDescriptions[name] || `${name} command`
      tableRows.push(
        `| \`p. ${name}${['task', 'idea', 'bug', 'ship'].includes(name) ? ' <desc>' : ''}\` | ${desc} |`
      )
    }

    return `---
description: 'prjct CLI - Context layer for AI agents'
allowed-tools: ["*"]
---

# prjct Command Router

**ARGUMENTS**: $ARGUMENTS

All commands use the \`p.\` prefix.

## Quick Reference

| Command | Description |
|---------|-------------|
${tableRows.join('\n')}

## Execution

\`\`\`
1. PARSE: $ARGUMENTS → extract command (first word) + remaining args
2. CHECK: if command is in Passthrough list below → run directly (no template needed)
3. ELSE: GET npm root (npm root -g) → LOAD template: {npmRoot}/prjct-cli/templates/commands/{command}.md → EXECUTE
\`\`\`

## Passthrough Commands (run directly — no template needed)

These commands just need the CLI output. Run them directly:

| Command | Run |
|---------|-----|
| status | \`prjct status {args} --md\` |
| analyze | \`prjct analyze {args} --md\` |
| learnings | \`prjct learnings --md\` |
| verify | \`prjct verify {args} --md\` |
| update | \`prjct update --md\` |
| serve | \`prjct serve {args} --md\` |
| cleanup | \`prjct cleanup {args} --md\` |
| auth | \`prjct auth {args} --md\` |
| skill | \`prjct skill {args} --md\` |
| sessions | \`prjct sessions {args} --md\` |
| next | \`prjct next {args} --md\` — if output has \`options\`, present to user |
| pause | \`prjct pause "{args}" --md\` — if no reason, ask user why (Blocked/Switching/Break/Researching) |
| resume | \`prjct resume {args} --md\` — if output has \`options\`, present to user; switch branch if told |
| dash | \`prjct dash {args} --md\` — present tables from output as scannable dashboard |

Follow the instructions in the CLI output.

## Template Commands (require template file)

task, done, ship, sync, bug, idea, plan, design, test, review, git, merge, history,
workflow, enrich, impact, prd, spec, init, setup, jira, linear

Load these via: \`{npmRoot}/prjct-cli/templates/commands/{command}.md\`

## Command Aliases

| Input | Redirects To |
|-------|--------------|
| \`p. undo\` | \`p. history undo\` |
| \`p. redo\` | \`p. history redo\` |

## State Context

All state is managed by the \`prjct\` CLI via SQLite (prjct.db).
Templates should use CLI commands for data operations — never read/write JSON storage files directly.

## Error Handling

| Error | Action |
|-------|--------|
| Unknown command | "Unknown command: {command}. Run \`p. help\` for available commands." |
| No project | "No prjct project. Run \`p. init\` first." |
| Template not found | "Template not found: {command}.md" |

## NOW: Execute

1. Parse command from $ARGUMENTS
2. Handle aliases (undo → history undo, redo → history redo)
3. If passthrough command → run CLI directly
4. Else → load and execute command template
`
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
      await this.installRouter()

      return {
        success: true,
        added: 0,
        updated: 1,
        removed: 0,
      } as SyncResult
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
   * Remove legacy ~/.claude/commands/p/ subdirectory (pre-v1.25 architecture).
   * Those stale files (jira.md, linear.md, etc.) stay on disk forever otherwise.
   */
  async cleanupLegacyCommands(): Promise<boolean> {
    await this.ensureInit()
    const pSubdirPath = path.join(this.commandsPath, 'p')
    try {
      const stat = await fs.stat(pSubdirPath).catch(() => null)
      if (stat?.isDirectory()) {
        await fs.rm(pSubdirPath, { recursive: true, force: true })
        return true
      }
    } catch {
      // already gone
    }
    return false
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
      commands: path.join(homeDir, '.claude', 'commands'),
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
