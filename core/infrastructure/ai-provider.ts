/**
 * AI Provider - Multi-agent support for prjct-cli
 *
 * Supports multiple AI coding agents with a unified abstraction layer:
 * - Claude Code (CLI): ~/.claude/, CLAUDE.md, .md commands
 * - Gemini CLI (CLI): ~/.gemini/, GEMINI.md, .toml commands
 * - Cursor IDE (GUI): .cursor/ (project-level), .mdc rules
 * - Windsurf IDE (GUI): .windsurf/ (project-level), .md rules with YAML frontmatter
 *
 * Key differences:
 * - CLI providers (Claude/Gemini) have global config directories
 * - Cursor/Windsurf have project-level config only (no ~/.cursor/ or ~/.windsurf/)
 *
 * @see https://geminicli.com/docs/cli/gemini-md/
 * @see https://geminicli.com/docs/cli/skills/
 * @see https://cursor.com/docs/context/rules
 * @see https://docs.windsurf.com/windsurf/cascade/memories
 */

import { exec } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { compareSemver } from '../schemas/model'
import { fileExists } from '../utils/file-helper'
import { readProviderCache, writeProviderCache } from '../utils/provider-cache'

const execAsync = promisify(exec)
const SPAWN_TIMEOUT_MS = 2000

import type {
  AIProviderConfig,
  AIProviderName,
  CapabilityTier,
  CursorProjectDetection,
  ProviderBranding,
  ProviderCapabilities,
  ProviderDetectionResult,
  ProviderSelectionResult,
  WindsurfProjectDetection,
} from '../types/provider'

// =============================================================================
// Capability Tiers
// =============================================================================

const CAPABILITY_TIERS: Record<CapabilityTier, ProviderCapabilities> = {
  /** Claude Code — all features */
  full: {
    shell: true,
    fileRead: true,
    fileWrite: true,
    fileSearch: true,
    structuredQuestions: true,
    subagents: true,
    webFetch: true,
    todoTracking: true,
  },
  /** Gemini CLI — most features, no subagents/web/todo */
  standard: {
    shell: true,
    fileRead: true,
    fileWrite: true,
    fileSearch: true,
    structuredQuestions: true,
    subagents: false,
    webFetch: false,
    todoTracking: false,
  },
  /** Codex, Cursor, Windsurf — shell + files only */
  basic: {
    shell: true,
    fileRead: true,
    fileWrite: true,
    fileSearch: true,
    structuredQuestions: false,
    subagents: false,
    webFetch: false,
    todoTracking: false,
  },
}

/**
 * Get resolved capabilities for a provider, with optional overrides
 */
export function getCapabilities(
  tier: CapabilityTier,
  overrides?: Partial<ProviderCapabilities>
): ProviderCapabilities {
  return { ...CAPABILITY_TIERS[tier], ...overrides }
}

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
  defaultModel: 'sonnet',
  supportedModels: ['opus', 'sonnet', 'haiku'],
  minCliVersion: '1.0.0',
  capabilityTier: 'full',
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
  defaultModel: '2.5-flash',
  supportedModels: ['2.5-pro', '2.5-flash', '2.0-flash'],
  minCliVersion: '1.0.0',
  capabilityTier: 'standard',
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
  defaultModel: null, // Platform-managed
  supportedModels: [],
  minCliVersion: null,
  capabilityTier: 'basic',
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
  cliCommand: null, // Not a CLI - GUI app
  configDir: null, // No global config directory
  contextFile: 'prjct.mdc', // Uses .mdc format with frontmatter
  skillsDir: null, // No skills directory
  commandsDir: '.cursor/commands',
  rulesDir: '.cursor/rules', // Cursor-specific: rules directory
  commandFormat: 'md',
  settingsFile: null,
  projectSettingsFile: null,
  ignoreFile: '.cursorignore',
  isProjectLevel: true, // Config is project-level only
  websiteUrl: 'https://cursor.com',
  docsUrl: 'https://cursor.com/docs',
  defaultModel: null, // Multi-model IDE, user selects
  supportedModels: [],
  minCliVersion: null,
  capabilityTier: 'basic',
}

/**
 * Windsurf IDE provider configuration
 *
 * Key differences from Cursor:
 * - Uses .md files (not .mdc) with YAML frontmatter
 * - Uses "workflows" instead of "commands"
 * - Frontmatter uses `trigger: always_on` instead of `alwaysApply: true`
 * - Character limits: 6000 per file, 12000 total
 *
 * @see https://docs.windsurf.com/windsurf/cascade/memories
 * @see https://docs.windsurf.com/windsurf/cascade/workflows
 */
export const WindsurfProvider: AIProviderConfig = {
  name: 'windsurf',
  displayName: 'Windsurf IDE',
  cliCommand: null, // Not a CLI - GUI app
  configDir: null, // No global config directory
  contextFile: 'prjct.md', // Uses .md format (not .mdc)
  skillsDir: null, // No skills directory
  commandsDir: '.windsurf/workflows', // Windsurf uses "workflows" not "commands"
  rulesDir: '.windsurf/rules',
  commandFormat: 'md',
  settingsFile: null,
  projectSettingsFile: null,
  ignoreFile: '.windsurfignore',
  isProjectLevel: true, // Config is project-level only
  websiteUrl: 'https://windsurf.com',
  docsUrl: 'https://docs.windsurf.com',
  defaultModel: null, // Multi-model IDE, user selects
  supportedModels: [],
  minCliVersion: null,
  capabilityTier: 'basic',
}

/**
 * OpenAI Codex CLI provider configuration
 *
 * Agent-first CLI that uses AGENTS.md for project context.
 * Skills live in .agents/skills/ (project) or ~/.codex/skills/ (global).
 *
 * @see https://github.com/openai/codex
 */
export const CodexProvider: AIProviderConfig = {
  name: 'codex',
  displayName: 'OpenAI Codex',
  cliCommand: 'codex',
  configDir: path.join(os.homedir(), '.codex'),
  contextFile: 'AGENTS.md',
  skillsDir: path.join(os.homedir(), '.codex', 'skills'),
  commandsDir: '.agents/skills',
  commandFormat: 'md',
  settingsFile: null,
  projectSettingsFile: null,
  ignoreFile: '.codexignore',
  websiteUrl: 'https://openai.com/codex',
  docsUrl: 'https://github.com/openai/codex',
  defaultModel: null,
  supportedModels: [],
  minCliVersion: null,
  capabilityTier: 'basic',
}

/**
 * All available providers
 */
export const Providers: Record<AIProviderName, AIProviderConfig> = {
  claude: ClaudeProvider,
  gemini: GeminiProvider,
  cursor: CursorProvider,
  antigravity: AntigravityProvider,
  windsurf: WindsurfProvider,
  codex: CodexProvider,
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Check if a CLI command is available
 */
async function whichCommand(command: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`which ${command}`, { timeout: SPAWN_TIMEOUT_MS })
    return stdout.trim()
  } catch {
    return null
  }
}

/**
 * Get CLI version
 */
async function getCliVersion(command: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`${command} --version`, { timeout: SPAWN_TIMEOUT_MS })
    // Extract version number from output (e.g., "claude 1.0.0" -> "1.0.0")
    const match = stdout.match(/\d+\.\d+\.\d+/)
    return match ? match[0] : stdout.trim()
  } catch {
    return null
  }
}

/**
 * Detect if a specific CLI-based provider is installed
 * Note: Cursor is NOT a CLI, use detectCursorProject() instead
 */
export async function detectProvider(provider: AIProviderName): Promise<ProviderDetectionResult> {
  const config = Providers[provider]

  // Cursor is not a CLI - return not installed for CLI detection
  if (!config.cliCommand) {
    return { installed: false }
  }

  const cliPath = await whichCommand(config.cliCommand)

  if (!cliPath) {
    return { installed: false }
  }

  const version = await getCliVersion(config.cliCommand)
  const versionWarning = validateCliVersion(provider, version || undefined)

  return {
    installed: true,
    version: version || undefined,
    path: cliPath,
    versionWarning: versionWarning || undefined,
  }
}

/**
 * Validate that a detected CLI version meets the provider's minimum requirement.
 * Returns a warning message if the version is below minimum, or null if OK.
 */
export function validateCliVersion(
  provider: AIProviderName,
  version: string | undefined
): string | null {
  const config = Providers[provider]
  if (!config.minCliVersion || !version) return null

  if (compareSemver(version, config.minCliVersion) < 0) {
    return `⚠️ ${config.displayName} v${version} is below minimum v${config.minCliVersion}. Some features may not work correctly.`
  }
  return null
}

/**
 * Detect all available CLI-based providers
 * Results are cached to disk with a 10-minute TTL to avoid redundant shell spawns.
 * Pass refresh=true to force re-detection.
 */
export async function detectAllProviders(refresh = false): Promise<{
  claude: ProviderDetectionResult
  gemini: ProviderDetectionResult
  codex: ProviderDetectionResult
}> {
  if (!refresh) {
    const cached = await readProviderCache()
    if (cached) return cached
  }

  const [claude, gemini, codexDetection] = await Promise.all([
    detectProvider('claude'),
    detectProvider('gemini'),
    detectCodex(),
  ])
  const codex: ProviderDetectionResult = {
    installed: codexDetection.installed,
  }
  const detection = { claude, gemini, codex }

  await writeProviderCache(detection).catch(() => {})

  return detection
}

/**
 * Get the active provider based on detection or configuration
 *
 * Priority:
 * 1. Check project config for saved provider preference
 * 2. Auto-detect single installed provider
 * 3. Default to Claude if both installed
 */
export async function getActiveProvider(
  projectProvider?: AIProviderName
): Promise<AIProviderConfig> {
  // If project has a saved preference, use it
  if (projectProvider && Providers[projectProvider]) {
    return Providers[projectProvider]
  }

  // Auto-detect
  const detection = await detectAllProviders()

  // If only one is installed, use it
  if (detection.claude.installed && !detection.gemini.installed) {
    return ClaudeProvider
  }
  if (detection.gemini.installed && !detection.claude.installed) {
    return GeminiProvider
  }

  // Default to Claude
  return ClaudeProvider
}

/**
 * Check if config directory exists for a provider
 * Returns false for project-level providers (Cursor)
 */
export async function hasProviderConfig(provider: AIProviderName): Promise<boolean> {
  const config = Providers[provider]
  if (!config.configDir) {
    return false // Cursor has no global config directory
  }
  return fileExists(config.configDir)
}

// =============================================================================
// Provider Branding
// =============================================================================

/**
 * Get provider-specific branding
 */
export function getProviderBranding(provider: AIProviderName): ProviderBranding {
  // Generic commit footer for all providers
  const commitFooter = `Generated with [p/](https://www.prjct.app/)`

  const signatures: Record<AIProviderName, string> = {
    claude: '⚡ prjct + Claude',
    gemini: '⚡ prjct + Gemini',
    cursor: '⚡ prjct + Cursor',
    antigravity: '⚡ prjct + Antigravity',
    windsurf: '⚡ prjct + Windsurf',
    codex: '⚡ prjct + Codex',
  }

  return {
    commitFooter,
    signature: signatures[provider] || '⚡ prjct',
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
export async function detectCursorProject(projectRoot: string): Promise<CursorProjectDetection> {
  const cursorDir = path.join(projectRoot, '.cursor')
  const rulesDir = path.join(cursorDir, 'rules')
  const routerPath = path.join(rulesDir, 'prjct.mdc')

  const [detected, routerInstalled] = await Promise.all([
    fileExists(cursorDir),
    fileExists(routerPath),
  ])

  return {
    detected,
    routerInstalled,
    projectRoot: detected ? projectRoot : undefined,
  }
}

/**
 * Check if Cursor routers need to be regenerated
 */
export async function needsCursorRouterRegeneration(projectRoot: string): Promise<boolean> {
  const detection = await detectCursorProject(projectRoot)

  // Only check if .cursor/ exists (project uses Cursor)
  // and prjct router is missing
  return detection.detected && !detection.routerInstalled
}

// =============================================================================
// Windsurf Project Detection
// =============================================================================

/**
 * Detect if a project is configured for Windsurf IDE
 *
 * Windsurf has NO global config (~/.windsurf/ doesn't exist).
 * Detection is based on project-level .windsurf/ directory.
 */
export async function detectWindsurfProject(
  projectRoot: string
): Promise<WindsurfProjectDetection> {
  const windsurfDir = path.join(projectRoot, '.windsurf')
  const rulesDir = path.join(windsurfDir, 'rules')
  const routerPath = path.join(rulesDir, 'prjct.md')

  const [detected, routerInstalled] = await Promise.all([
    fileExists(windsurfDir),
    fileExists(routerPath),
  ])

  return {
    detected,
    routerInstalled,
    projectRoot: detected ? projectRoot : undefined,
  }
}

/**
 * Check if Windsurf routers need to be regenerated
 */
export async function needsWindsurfRouterRegeneration(projectRoot: string): Promise<boolean> {
  const detection = await detectWindsurfProject(projectRoot)

  // Only check if .windsurf/ exists (project uses Windsurf)
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
export async function detectAntigravity(): Promise<AntigravityDetection> {
  const configPath = AntigravityProvider.configDir
  if (!configPath) {
    return { installed: false, skillInstalled: false }
  }

  const skillPath = path.join(configPath, 'skills', 'prjct', 'SKILL.md')
  const [installed, skillInstalled] = await Promise.all([
    fileExists(configPath),
    fileExists(skillPath),
  ])

  return {
    installed,
    skillInstalled,
    configPath: installed ? configPath : undefined,
  }
}

// =============================================================================
// Codex Detection
// =============================================================================

/**
 * Result of Codex detection
 */
export interface CodexDetection {
  /** Whether `codex` CLI is available */
  installed: boolean

  /** Whether prjct skill is installed */
  skillInstalled: boolean

  /** Path to config directory */
  configPath?: string
}

/**
 * Detect if OpenAI Codex CLI is installed
 *
 * Detection: check for `codex` CLI command or ~/.codex/ directory.
 */
export async function detectCodex(): Promise<CodexDetection> {
  const configPath = CodexProvider.configDir
  if (!configPath) {
    return { installed: false, skillInstalled: false }
  }

  const cliPath = await whichCommand('codex')
  const skillPath = path.join(configPath, 'skills', 'prjct', 'SKILL.md')
  const skillInstalled = await fileExists(skillPath)

  // Require the CLI binary to be present — a leftover ~/.codex/ directory alone
  // does not mean Codex is installed and should not block other providers.
  const installed = !!cliPath

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
export async function selectProvider(): Promise<ProviderSelectionResult> {
  const detection = await detectAllProviders()

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
