/**
 * AI Provider - Multi-agent support for prjct-cli
 *
 * Supports multiple AI coding agents with a unified abstraction layer:
 * - Claude Code (CLI): ~/.claude/, CLAUDE.md, .md commands
 * - Gemini CLI (CLI): ~/.gemini/, GEMINI.md, .toml commands
 * - Cursor IDE (GUI): .cursor/ (project-level), .mdc rules
 *
 * Key differences:
 * - CLI providers (Claude/Gemini) have global config directories
 * - Cursor has project-level config only (no ~/.cursor/)
 *
 * @see https://geminicli.com/docs/cli/gemini-md/
 * @see https://geminicli.com/docs/cli/skills/
 * @see https://cursor.com/docs/context/rules
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type {
  AIProviderName,
  AIProviderConfig,
  ProviderDetectionResult,
  ProviderSelectionResult,
  ProviderBranding,
  CursorProjectDetection,
} from '../types/provider'

// =============================================================================
// Provider Configurations
// =============================================================================

/**
 * Claude Code provider configuration
 */
export const ClaudeProvider: AIProviderConfig = {
  name: 'claude',
  displayName: 'Claude Code',
  cliCommand: 'claude',
  configDir: path.join(os.homedir(), '.claude'),
  contextFile: 'CLAUDE.md',
  skillsDir: path.join(os.homedir(), '.claude', 'skills'),
  commandsDir: '.claude/commands',
  commandFormat: 'md',
  settingsFile: 'settings.json',
  projectSettingsFile: 'settings.local.json',
  ignoreFile: '.claudeignore',
  websiteUrl: 'https://www.anthropic.com/claude',
  docsUrl: 'https://docs.anthropic.com/claude-code',
}

/**
 * Gemini CLI provider configuration
 */
export const GeminiProvider: AIProviderConfig = {
  name: 'gemini',
  displayName: 'Gemini CLI',
  cliCommand: 'gemini',
  configDir: path.join(os.homedir(), '.gemini'),
  contextFile: 'GEMINI.md',
  skillsDir: path.join(os.homedir(), '.gemini', 'skills'),
  commandsDir: '.gemini/commands',
  commandFormat: 'toml',
  settingsFile: 'settings.json',
  projectSettingsFile: 'settings.json',
  ignoreFile: '.geminiignore',
  websiteUrl: 'https://geminicli.com',
  docsUrl: 'https://geminicli.com/docs',
}

/**
 * Google Antigravity provider configuration
 *
 * An "agent-first" platform that manages multiple agents.
 * Config is located in ~/.gemini/antigravity/
 * Uses SKILL.md for skills and mcp_config.json for tools.
 */
export const AntigravityProvider: AIProviderConfig = {
  name: 'antigravity',
  displayName: 'Google Antigravity',
  cliCommand: null, // Not a CLI command, but a platform/app
  configDir: path.join(os.homedir(), '.gemini', 'antigravity'),
  contextFile: 'ANTIGRAVITY.md',
  skillsDir: path.join(os.homedir(), '.gemini', 'antigravity', 'global_skills'),
  commandsDir: '.agent/skills', // Antigravity uses .agent/skills in projects
  commandFormat: 'md', // Uses SKILL.md
  settingsFile: 'mcp_config.json', // Uses MCP config
  projectSettingsFile: null,
  ignoreFile: '.agentignore', // Assumed
  websiteUrl: 'https://gemini.google.com/app/antigravity',
  docsUrl: 'https://gemini.google.com/app/antigravity',
}

/**
 * Cursor IDE provider configuration
 *
 * Key differences from Claude/Gemini:
 * - NOT a CLI (GUI app, VS Code fork)
 * - No global config directory (~/.cursor/ doesn't exist)
 * - Project-level config only (.cursor/rules/, .cursor/commands/)
 * - User can select any model (GPT, Claude, Gemini, DeepSeek, etc.)
 *
 * @see https://cursor.com/docs/context/rules
 */
export const CursorProvider: AIProviderConfig = {
  name: 'cursor',
  displayName: 'Cursor IDE',
  cliCommand: null,              // Not a CLI - GUI app
  configDir: null,               // No global config directory
  contextFile: 'prjct.mdc',      // Uses .mdc format with frontmatter
  skillsDir: null,               // No skills directory
  commandsDir: '.cursor/commands',
  rulesDir: '.cursor/rules',     // Cursor-specific: rules directory
  commandFormat: 'md',
  settingsFile: null,
  projectSettingsFile: null,
  ignoreFile: '.cursorignore',
  isProjectLevel: true,          // Config is project-level only
  websiteUrl: 'https://cursor.com',
  docsUrl: 'https://cursor.com/docs',
}

/**
 * All available providers
 */
export const Providers: Record<AIProviderName, AIProviderConfig> = {
  claude: ClaudeProvider,
  gemini: GeminiProvider,
  cursor: CursorProvider,
  antigravity: AntigravityProvider,
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Check if a CLI command is available
 */
function whichCommand(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, { stdio: 'pipe', encoding: 'utf-8' })
    return result.trim()
  } catch {
    return null
  }
}

/**
 * Get CLI version
 */
function getCliVersion(command: string): string | null {
  try {
    const result = execSync(`${command} --version`, { stdio: 'pipe', encoding: 'utf-8' })
    // Extract version number from output (e.g., "claude 1.0.0" -> "1.0.0")
    const match = result.match(/\d+\.\d+\.\d+/)
    return match ? match[0] : result.trim()
  } catch {
    return null
  }
}

/**
 * Detect if a specific CLI-based provider is installed
 * Note: Cursor is NOT a CLI, use detectCursorProject() instead
 */
export function detectProvider(provider: AIProviderName): ProviderDetectionResult {
  const config = Providers[provider]

  // Cursor is not a CLI - return not installed for CLI detection
  if (!config.cliCommand) {
    return { installed: false }
  }

  const cliPath = whichCommand(config.cliCommand)

  if (!cliPath) {
    return { installed: false }
  }

  const version = getCliVersion(config.cliCommand)

  return {
    installed: true,
    version: version || undefined,
    path: cliPath,
  }
}

/**
 * Detect all available CLI-based providers
 * Note: Cursor detection is project-level, use detectCursorProject() separately
 */
export function detectAllProviders(): { claude: ProviderDetectionResult; gemini: ProviderDetectionResult } {
  return {
    claude: detectProvider('claude'),
    gemini: detectProvider('gemini'),
  }
}

/**
 * Get the active provider based on detection or configuration
 *
 * Priority:
 * 1. Check project config for saved provider preference
 * 2. Auto-detect single installed provider
 * 3. Default to Claude if both installed (backward compatibility)
 */
export function getActiveProvider(projectProvider?: AIProviderName): AIProviderConfig {
  // If project has a saved preference, use it
  if (projectProvider && Providers[projectProvider]) {
    return Providers[projectProvider]
  }

  // Auto-detect
  const detection = detectAllProviders()

  // If only one is installed, use it
  if (detection.claude.installed && !detection.gemini.installed) {
    return ClaudeProvider
  }
  if (detection.gemini.installed && !detection.claude.installed) {
    return GeminiProvider
  }

  // Default to Claude for backward compatibility
  return ClaudeProvider
}

/**
 * Check if config directory exists for a provider
 * Returns false for project-level providers (Cursor)
 */
export function hasProviderConfig(provider: AIProviderName): boolean {
  const config = Providers[provider]
  if (!config.configDir) {
    return false // Cursor has no global config directory
  }
  return fs.existsSync(config.configDir)
}

// =============================================================================
// Provider Branding
// =============================================================================

/**
 * Get provider-specific branding
 */
export function getProviderBranding(provider: AIProviderName): ProviderBranding {
  const config = Providers[provider]

  if (provider === 'gemini') {
    return {
      commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Gemini](${config.websiteUrl})`,
      signature: '⚡ prjct + Gemini',
    }
  }

  if (provider === 'cursor') {
    return {
      commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Built with [Cursor](${config.websiteUrl})`,
      signature: '⚡ prjct + Cursor',
    }
  }

  if (provider === 'antigravity') {
    return {
      commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Powered by [Antigravity](${config.websiteUrl})`,
      signature: '⚡ prjct + Antigravity',
    }
  }

  // Default: Claude
  return {
    commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](${config.websiteUrl})`,
    signature: '⚡ prjct + Claude',
  }
}

// =============================================================================
// Cursor Project Detection
// =============================================================================

/**
 * Detect if a project is configured for Cursor IDE
 *
 * Cursor has NO global config (~/.cursor/ doesn't exist).
 * Detection is based on project-level .cursor/ directory.
 */
export function detectCursorProject(projectRoot: string): CursorProjectDetection {
  const cursorDir = path.join(projectRoot, '.cursor')
  const rulesDir = path.join(cursorDir, 'rules')
  const routerPath = path.join(rulesDir, 'prjct.mdc')

  const detected = fs.existsSync(cursorDir)
  const routerInstalled = fs.existsSync(routerPath)

  return {
    detected,
    routerInstalled,
    projectRoot: detected ? projectRoot : undefined,
  }
}

/**
 * Check if Cursor routers need to be regenerated
 */
export function needsCursorRouterRegeneration(projectRoot: string): boolean {
  const detection = detectCursorProject(projectRoot)

  // Only check if .cursor/ exists (project uses Cursor)
  // and prjct router is missing
  return detection.detected && !detection.routerInstalled
}

// =============================================================================
// Antigravity Detection
// =============================================================================

/**
 * Result of Antigravity detection
 */
export interface AntigravityDetection {
  /** Whether ~/.gemini/antigravity/ exists */
  installed: boolean

  /** Whether prjct skill is installed */
  skillInstalled: boolean

  /** Path to config directory */
  configPath?: string
}

/**
 * Detect if Google Antigravity is installed
 *
 * Antigravity is NOT a CLI command - it's a GUI platform.
 * Detection is based on ~/.gemini/antigravity/ directory.
 */
export function detectAntigravity(): AntigravityDetection {
  const configPath = AntigravityProvider.configDir
  if (!configPath) {
    return { installed: false, skillInstalled: false }
  }

  const installed = fs.existsSync(configPath)
  const skillPath = path.join(configPath, 'skills', 'prjct', 'SKILL.md')
  const skillInstalled = fs.existsSync(skillPath)

  return {
    installed,
    skillInstalled,
    configPath: installed ? configPath : undefined,
  }
}

// =============================================================================
// Provider Paths
// =============================================================================

/**
 * Get full path to global context file
 * Returns null for project-level providers (Cursor)
 */
export function getGlobalContextPath(provider: AIProviderName): string | null {
  const config = Providers[provider]
  if (!config.configDir) {
    return null // Cursor has no global config
  }
  return path.join(config.configDir, config.contextFile)
}

/**
 * Get full path to global settings file
 * Returns null for project-level providers (Cursor)
 */
export function getGlobalSettingsPath(provider: AIProviderName): string | null {
  const config = Providers[provider]
  if (!config.configDir || !config.settingsFile) {
    return null // Cursor has no global settings
  }
  return path.join(config.configDir, config.settingsFile)
}

/**
 * Get full path to skills directory
 * Returns null for providers without skill support (Cursor)
 */
export function getSkillsPath(provider: AIProviderName): string | null {
  return Providers[provider].skillsDir
}

/**
 * Get commands directory relative to project root
 */
export function getCommandsDir(provider: AIProviderName): string {
  return Providers[provider].commandsDir
}

/**
 * Get full path to commands directory in a project
 */
export function getProjectCommandsPath(provider: AIProviderName, projectRoot: string): string {
  const config = Providers[provider]
  return path.join(projectRoot, config.commandsDir)
}

// =============================================================================
// Provider Selection (for setup)
// =============================================================================

/**
 * Determine which provider to use during setup
 * Returns selection result with detection details
 */
export function selectProvider(): ProviderSelectionResult {
  const detection = detectAllProviders()

  const claudeInstalled = detection.claude.installed
  const geminiInstalled = detection.gemini.installed

  // Neither installed
  if (!claudeInstalled && !geminiInstalled) {
    // Default to Claude, setup will prompt to install
    return {
      provider: 'claude',
      userSelected: false,
      detection,
    }
  }

  // Only Claude installed
  if (claudeInstalled && !geminiInstalled) {
    return {
      provider: 'claude',
      userSelected: false,
      detection,
    }
  }

  // Only Gemini installed
  if (geminiInstalled && !claudeInstalled) {
    return {
      provider: 'gemini',
      userSelected: false,
      detection,
    }
  }

  // Both installed - will need user selection
  // For now, default to Claude (caller should prompt user)
  return {
    provider: 'claude',
    userSelected: true, // Indicates user should be prompted
    detection,
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  Providers,
  ClaudeProvider,
  GeminiProvider,
  CursorProvider,
  AntigravityProvider,
  detectProvider,
  detectAllProviders,
  detectAntigravity,
  getActiveProvider,
  hasProviderConfig,
  getProviderBranding,
  getGlobalContextPath,
  getGlobalSettingsPath,
  getSkillsPath,
  getCommandsDir,
  getProjectCommandsPath,
  selectProvider,
  detectCursorProject,
  needsCursorRouterRegeneration,
}
