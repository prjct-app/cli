/**
 * AI Provider - Multi-agent support for prjct-cli
 *
 * Supports both Claude Code and Gemini CLI with a unified abstraction layer.
 * Both agents share similar architectures:
 * - Context files: CLAUDE.md / GEMINI.md
 * - Skills: Both use SKILL.md format (identical!)
 * - Commands: .md (Claude) / .toml (Gemini)
 * - MCP: Both support Model Context Protocol
 *
 * @see https://geminicli.com/docs/cli/gemini-md/
 * @see https://geminicli.com/docs/cli/skills/
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
 * All available providers
 */
export const Providers: Record<AIProviderName, AIProviderConfig> = {
  claude: ClaudeProvider,
  gemini: GeminiProvider,
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
 * Detect if a specific provider is installed
 */
export function detectProvider(provider: AIProviderName): ProviderDetectionResult {
  const config = Providers[provider]
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
 * Detect all available providers
 */
export function detectAllProviders(): Record<AIProviderName, ProviderDetectionResult> {
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
 */
export function hasProviderConfig(provider: AIProviderName): boolean {
  const config = Providers[provider]
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

  // Default: Claude
  return {
    commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](${config.websiteUrl})`,
    signature: '⚡ prjct + Claude',
  }
}

// =============================================================================
// Provider Paths
// =============================================================================

/**
 * Get full path to global context file
 */
export function getGlobalContextPath(provider: AIProviderName): string {
  const config = Providers[provider]
  return path.join(config.configDir, config.contextFile)
}

/**
 * Get full path to global settings file
 */
export function getGlobalSettingsPath(provider: AIProviderName): string {
  const config = Providers[provider]
  return path.join(config.configDir, config.settingsFile)
}

/**
 * Get full path to skills directory
 */
export function getSkillsPath(provider: AIProviderName): string {
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
  detectProvider,
  detectAllProviders,
  getActiveProvider,
  hasProviderConfig,
  getProviderBranding,
  getGlobalContextPath,
  getGlobalSettingsPath,
  getSkillsPath,
  getCommandsDir,
  getProjectCommandsPath,
  selectProvider,
}
