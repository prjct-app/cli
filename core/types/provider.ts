/**
 * AI Provider Types
 *
 * Abstractions for supporting multiple AI CLI agents (Claude Code, Gemini CLI).
 * Both agents share similar architectures, making compatibility achievable.
 *
 * Key discovery: Skills use identical SKILL.md format for both providers.
 *
 * @see https://geminicli.com/docs/cli/gemini-md/
 * @see https://geminicli.com/docs/cli/skills/
 */

/**
 * Supported AI provider names
 */
export type AIProviderName = 'claude' | 'gemini'

/**
 * Command format for each provider
 * - Claude: Markdown files (.md)
 * - Gemini: TOML files (.toml)
 */
export type CommandFormat = 'md' | 'toml'

/**
 * AI Provider configuration
 * Defines paths and formats for each AI CLI agent
 */
export interface AIProviderConfig {
  /** Provider identifier */
  name: AIProviderName

  /** Display name for UI/logs */
  displayName: string

  /** CLI command name (e.g., 'claude', 'gemini') */
  cliCommand: string

  /** Global config directory (e.g., ~/.claude, ~/.gemini) */
  configDir: string

  /** Context file name (CLAUDE.md or GEMINI.md) */
  contextFile: string

  /** Skills directory (e.g., ~/.claude/skills, ~/.gemini/skills) */
  skillsDir: string

  /** Commands directory relative to project (e.g., .claude/commands, .gemini/commands) */
  commandsDir: string

  /** Command file format */
  commandFormat: CommandFormat

  /** Settings file name (settings.json for both) */
  settingsFile: string

  /** Project settings file (e.g., settings.local.json, settings.json) */
  projectSettingsFile: string

  /** Ignore file name (.claudeignore, .geminiignore) */
  ignoreFile: string

  /** URL for provider website */
  websiteUrl: string

  /** URL for provider documentation */
  docsUrl: string
}

/**
 * Provider detection result
 */
export interface ProviderDetectionResult {
  /** Whether the provider CLI is installed */
  installed: boolean

  /** Provider version if installed */
  version?: string

  /** Path to the CLI executable */
  path?: string
}

/**
 * Result of provider selection during setup
 */
export interface ProviderSelectionResult {
  /** Selected provider */
  provider: AIProviderName

  /** Whether user was prompted to choose (both installed) */
  userSelected: boolean

  /** Detection details */
  detection: {
    claude: ProviderDetectionResult
    gemini: ProviderDetectionResult
  }
}

/**
 * Provider-aware branding configuration
 */
export interface ProviderBranding {
  /** Commit footer text */
  commitFooter: string

  /** Short signature */
  signature: string
}
