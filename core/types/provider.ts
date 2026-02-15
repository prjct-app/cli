/**
 * AI Provider Types
 *
 * Abstractions for supporting multiple AI coding agents:
 * - Claude Code (CLI)
 * - Gemini CLI (CLI)
 * - Cursor IDE (GUI, project-level config)
 * - Windsurf IDE (GUI, project-level config)
 *
 * Key discovery: Skills use identical SKILL.md format for CLI providers.
 * Cursor uses .mdc files with frontmatter for rules.
 * Windsurf uses .md files with YAML frontmatter for rules.
 *
 * @see https://geminicli.com/docs/cli/gemini-md/
 * @see https://geminicli.com/docs/cli/skills/
 * @see https://cursor.com/docs/context/rules
 * @see https://docs.windsurf.com/windsurf/cascade/memories
 */

/**
 * Supported AI provider names
 */
export type AIProviderName = 'claude' | 'gemini' | 'cursor' | 'antigravity' | 'windsurf' | 'codex'

/**
 * Command format for each provider
 * - Claude: Markdown files (.md)
 * - Gemini: TOML files (.toml)
 */
export type CommandFormat = 'md' | 'toml'

/**
 * AI Provider configuration
 * Defines paths and formats for each AI coding agent
 */
export interface AIProviderConfig {
  /** Provider identifier */
  name: AIProviderName

  /** Display name for UI/logs */
  displayName: string

  /** CLI command name (e.g., 'claude', 'gemini'). Null for GUI apps like Cursor */
  cliCommand: string | null

  /** Global config directory (e.g., ~/.claude, ~/.gemini). Null for project-level only (Cursor) */
  configDir: string | null

  /** Context file name (CLAUDE.md, GEMINI.md, or prjct.mdc for Cursor) */
  contextFile: string

  /** Skills directory (e.g., ~/.claude/skills). Null for providers without skill support */
  skillsDir: string | null

  /** Commands directory relative to project (e.g., .claude/commands, .cursor/commands) */
  commandsDir: string

  /** Rules directory for project-level config (e.g., .cursor/rules). Only used by Cursor */
  rulesDir?: string

  /** Command file format */
  commandFormat: CommandFormat

  /** Settings file name (settings.json). Null if not applicable */
  settingsFile: string | null

  /** Project settings file (e.g., settings.local.json). Null if not applicable */
  projectSettingsFile: string | null

  /** Ignore file name (.claudeignore, .geminiignore, .cursorignore) */
  ignoreFile: string

  /** Whether config is project-level only (no global config directory) */
  isProjectLevel?: boolean

  /** URL for provider website */
  websiteUrl: string

  /** URL for provider documentation */
  docsUrl: string

  /** Default model for this provider (e.g., 'sonnet', '2.5-flash'). Null for multi-model IDEs */
  defaultModel: string | null

  /** Supported model identifiers. Empty array for multi-model IDEs (user selects model) */
  supportedModels: readonly string[]

  /** Minimum CLI version required. Null for non-CLI providers */
  minCliVersion: string | null

  /** Capability tier preset */
  capabilityTier: CapabilityTier

  /** Optional per-provider overrides on top of the tier */
  capabilityOverrides?: Partial<ProviderCapabilities>
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

  /** Warning if CLI version is below minimum requirement */
  versionWarning?: string
}

/**
 * Result of provider selection during setup
 */
export interface ProviderSelectionResult {
  /** Selected provider */
  provider: AIProviderName

  /** Whether user was prompted to choose (multiple installed) */
  userSelected: boolean

  /** Detection details for CLI-based providers */
  detection: {
    claude: ProviderDetectionResult
    gemini: ProviderDetectionResult
  }
}

/**
 * Result of Cursor project detection
 */
export interface CursorProjectDetection {
  /** Whether .cursor/ directory exists in project */
  detected: boolean

  /** Whether prjct router is installed */
  routerInstalled: boolean

  /** Project root path */
  projectRoot?: string
}

/**
 * Result of Windsurf project detection
 */
export interface WindsurfProjectDetection {
  /** Whether .windsurf/ directory exists in project */
  detected: boolean

  /** Whether prjct router is installed */
  routerInstalled: boolean

  /** Project root path */
  projectRoot?: string
}

/**
 * What an AI provider can do — used by templates to emit provider-agnostic instructions
 */
export interface ProviderCapabilities {
  /** Execute shell commands */
  shell: boolean
  /** Read files */
  fileRead: boolean
  /** Write/edit files */
  fileWrite: boolean
  /** Search/glob files */
  fileSearch: boolean
  /** AskUserQuestion-style structured prompts */
  structuredQuestions: boolean
  /** Spawn parallel sub-agents */
  subagents: boolean
  /** Fetch URLs */
  webFetch: boolean
  /** Task/todo tracking */
  todoTracking: boolean
}

/**
 * Capability tiers — presets for common provider profiles.
 * Add new tiers as ecosystems evolve.
 */
export type CapabilityTier = 'full' | 'standard' | 'basic'

/**
 * Provider-aware branding configuration
 */
export interface ProviderBranding {
  /** Commit footer text */
  commitFooter: string

  /** Short signature */
  signature: string
}
