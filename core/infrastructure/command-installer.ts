/**
 * Command Installer
 * Installs prjct global config in Claude Code and other AI CLI agents.
 *
 * Simplified: No more router, templates, or module system.
 * prjct = data helper. Skills handle workflows natively.
 *
 * @version 1.0.0 - Post-template deprecation
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
import { fileExists } from '../utils/file-helper'
import { mergeWithMarkers } from './ide-project-installer'

// =============================================================================
// Inline CLAUDE.md content (replaces template files + module system)
// =============================================================================

const GLOBAL_CLAUDE_MD_CONTENT = `<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Context layer for AI agents

Skills auto-activate for: task, ship, status, tag, remember, capture, sync, workflow, seed, install, context
Other commands: run \`prjct <command> --md\` and follow CLI output

Task lifecycle (v2): \`prjct task "<desc>"\` → work → \`prjct status done\` → \`prjct ship\`
- Pause: \`prjct status paused\`  |  Resume: \`prjct status active\`  |  Reopen: \`prjct status active\` (on completed task)
- Capture to inbox (bugs, ideas, anything): \`prjct capture "<text>" --tags bug|idea|…\`

Data:
- prjct runs → LLM generates relevant data → prjct stores it → LLM requests it from prjct → LLM uses it
- Commit footer: \`Generated with [p/](https://www.prjct.app/)\`
- Path resolution: \`.prjct/prjct.config.json\` → \`~/.prjct-cli/projects/{projectId}\`
- Storage: \`prjct\` CLI (SQLite internally)

Memory (project RAG):
- Save with \`prjct remember <type> "<content>"\` or \`prjct capture "<text>"\` — these write to SQLite and hooks regenerate the Obsidian vault.
- Recall via the SessionStart / UserPromptSubmit hook context that prjct injects, or \`prjct context memory [topic]\`.
- Do **not** write to \`~/.claude/projects/<slug>/memory/\` — that is Claude Code auto-memory, disjoint from this project's RAG and invisible to other tools (Cursor, Gemini, web dashboard). In a prjct project, project memory is prjct.
- The vault at \`~/Documents/prjct/<slug>/_generated/\` is a read-only snapshot regenerated from DB. Do not hand-edit it — fix the pipeline instead.

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
`

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
    const { PACKAGE_ROOT } = require('../utils/version')
    const templateDocsDir = path.join(PACKAGE_ROOT, 'templates/global/docs')
    try {
      const docFiles = await fs.readdir(templateDocsDir)
      for (const file of docFiles) {
        if (file.endsWith('.md')) {
          const srcPath = path.join(templateDocsDir, file)
          const destPath = path.join(docsDir, file)
          const content = await fs.readFile(srcPath, 'utf-8')
          await fs.writeFile(destPath, content, 'utf-8')
        }
      }
    } catch {
      // No docs directory — that's fine
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

    // Use inline content for Claude, or provider-specific template for others
    let templateContent = GLOBAL_CLAUDE_MD_CONTENT

    if (providerName !== 'claude') {
      // Try provider-specific template (bundle then filesystem)
      const bundled = getTemplateContent(`global/${activeProvider.contextFile}`)
      if (bundled) {
        templateContent = bundled
      } else {
        const { PACKAGE_ROOT } = require('../utils/version')
        const templatePath = path.join(
          PACKAGE_ROOT,
          'templates',
          'global',
          activeProvider.contextFile
        )
        try {
          templateContent = await fs.readFile(templatePath, 'utf-8')
        } catch {
          // Fall back to inline content with provider name swap
          if (providerName === 'gemini') {
            templateContent = GLOBAL_CLAUDE_MD_CONTENT.replace(/Claude/g, 'Gemini')
          }
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
        fileExists = false
      } else {
        throw error
      }
    }

    // Strip legacy prjct-project sections (static context generation removed)
    const projectStartMarker = '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
    const projectEndMarker = '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'
    if (
      existingContent.includes(projectStartMarker) &&
      existingContent.includes(projectEndMarker)
    ) {
      const beforeProject = existingContent.substring(
        0,
        existingContent.indexOf(projectStartMarker)
      )
      const afterProject = existingContent.substring(
        existingContent.indexOf(projectEndMarker) + projectEndMarker.length
      )
      existingContent = `${(beforeProject + afterProject).replace(/\n{3,}/g, '\n\n').trim()}\n`
    }

    const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
    const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

    const merged = mergeWithMarkers(
      fileExists ? existingContent : '',
      templateContent,
      startMarker,
      endMarker
    )

    await fs.writeFile(globalConfigPath, merged.content, 'utf-8')
    return {
      success: true,
      action: merged.action,
      path: globalConfigPath,
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
  private _initialized = false

  constructor() {
    this.homeDir = os.homedir()
  }

  private async ensureInit(): Promise<void> {
    if (this._initialized) return

    const aiProvider = require('./ai-provider')
    const activeProvider = await aiProvider.getActiveProvider()

    this.commandsPath = path.join(activeProvider.configDir, 'commands')
    this.configPath = activeProvider.configDir
    this._initialized = true
  }

  /**
   * Detect if active provider is installed
   */
  async detectActiveProvider(): Promise<boolean> {
    await this.ensureInit()
    return fileExists(this.configPath)
  }

  /**
   * Install commands to active AI agent (no-op — router deprecated)
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

    // Clean up legacy router if it exists
    await this.cleanupRouter()

    return {
      success: true,
      installed: [],
      path: this.commandsPath,
    }
  }

  /**
   * Uninstall commands from provider
   */
  async uninstallCommands(): Promise<UninstallResult> {
    try {
      const uninstalled: string[] = []

      // Clean up legacy router files
      await this.ensureInit()
      for (const routerFile of ['p.md', 'p.toml']) {
        const routerPath = path.join(this.commandsPath, routerFile)
        try {
          await fs.unlink(routerPath)
          uninstalled.push(routerFile)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            return { success: false, error: getErrorMessage(error) }
          }
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
   * Check if commands are installed (skills-based — no router needed)
   */
  async checkInstallation(): Promise<CheckResult> {
    const providerDetected = await this.detectActiveProvider()

    if (!providerDetected) {
      return {
        installed: false,
        providerDetected: false,
      }
    }

    // Skills-based installation — always considered "installed" if provider is detected
    return {
      installed: true,
      providerDetected: true,
      commands: [],
      path: this.commandsPath,
    }
  }

  /**
   * Get installation path for commands
   */
  async getInstallPath(): Promise<string> {
    await this.ensureInit()
    return this.commandsPath
  }

  /**
   * Sync commands - cleanup legacy router + update global config
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
      // Clean up legacy router files
      const cleaned = await this.cleanupRouter()

      return {
        success: true,
        added: 0,
        updated: 0,
        removed: cleaned ? 1 : 0,
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
   * Remove legacy router files (p.md, p.toml) from commands directory.
   * Migration step — these are no longer needed with skills-based architecture.
   */
  async cleanupRouter(): Promise<boolean> {
    await this.ensureInit()
    let cleaned = false

    for (const routerFile of ['p.md', 'p.toml']) {
      const routerPath = path.join(this.commandsPath, routerFile)
      try {
        await fs.unlink(routerPath)
        cleaned = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          // Log but don't fail
        }
      }
    }

    return cleaned
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
   * Full legacy cleanup — removes ALL stale prjct artifacts from all providers.
   * Called during `prjct update` to ensure clean migration.
   *
   * Cleans:
   * - ~/.claude/commands/p.md, p.toml (legacy routers)
   * - ~/.claude/commands/p/ (pre-v1.25 subdirectory)
   * - ~/.gemini/commands/p.toml (legacy Gemini router)
   * - ~/.gemini/commands/p/ (legacy Gemini subdirectory)
   * - Homebrew formula remnants
   * - Old global config content (replaced via marker swap in installGlobalConfig)
   */
  async cleanupAllLegacy(): Promise<{ cleaned: string[] }> {
    const home = os.homedir()
    const cleaned: string[] = []

    // Legacy router files across all CLI providers
    const legacyFiles = [
      path.join(home, '.claude', 'commands', 'p.md'),
      path.join(home, '.claude', 'commands', 'p.toml'),
      path.join(home, '.gemini', 'commands', 'p.md'),
      path.join(home, '.gemini', 'commands', 'p.toml'),
    ]

    for (const filePath of legacyFiles) {
      try {
        await fs.unlink(filePath)
        cleaned.push(filePath)
      } catch {
        // Already gone
      }
    }

    // Legacy subdirectories (pre-v1.25 architecture)
    const legacyDirs = [
      path.join(home, '.claude', 'commands', 'p'),
      path.join(home, '.gemini', 'commands', 'p'),
    ]

    for (const dirPath of legacyDirs) {
      try {
        const stat = await fs.stat(dirPath).catch(() => null)
        if (stat?.isDirectory()) {
          await fs.rm(dirPath, { recursive: true, force: true })
          cleaned.push(dirPath)
        }
      } catch {
        // Already gone
      }
    }

    // Legacy homebrew config/metadata
    const brewLegacy = [path.join(home, '.prjct-cli', 'config', 'homebrew-migrated')]

    for (const filePath of brewLegacy) {
      try {
        await fs.unlink(filePath)
        cleaned.push(filePath)
      } catch {
        // Already gone
      }
    }

    return { cleaned }
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

// =============================================================================
// Exports
// =============================================================================

const commandInstaller = new CommandInstaller()
export default commandInstaller
