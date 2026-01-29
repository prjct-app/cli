/**
 * AI Tools Registry
 *
 * Registry of AI coding tools (Claude Code, Cursor, Copilot, etc.)
 * Each tool has its own context file format and token budget.
 *
 * Phase 1: Claude Code + Cursor
 * Phase 2: + Copilot + Windsurf
 * Phase 3: + Continue.dev + Auto-detection
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface AIToolConfig {
  id: string
  name: string
  outputFile: string
  outputPath: 'repo' | 'global' // 'repo' = project root, 'global' = ~/.prjct-cli/projects/{id}/context/
  maxTokens: number
  format: 'detailed' | 'concise' | 'minimal' | 'json'
  description: string
}

/**
 * Supported AI tools registry
 */
export const AI_TOOLS: Record<string, AIToolConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    outputFile: 'CLAUDE.md',
    outputPath: 'global',
    maxTokens: 3000,
    format: 'detailed',
    description: 'Anthropic Claude Code CLI',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    outputFile: '.cursorrules',
    outputPath: 'repo',
    maxTokens: 2000,
    format: 'concise',
    description: 'Cursor AI Editor',
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    outputFile: '.github/copilot-instructions.md',
    outputPath: 'repo',
    maxTokens: 1500,
    format: 'minimal',
    description: 'GitHub Copilot',
  },
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf',
    outputFile: '.windsurfrules',
    outputPath: 'repo',
    maxTokens: 2000,
    format: 'concise',
    description: 'Codeium Windsurf Editor',
  },
  continue: {
    id: 'continue',
    name: 'Continue.dev',
    outputFile: '.continue/config.json',
    outputPath: 'repo',
    maxTokens: 1500,
    format: 'json',
    description: 'Continue.dev open-source AI assistant',
  },
}

/**
 * Default tools to generate (Phase 2: all major tools)
 */
export const DEFAULT_AI_TOOLS = ['claude', 'cursor', 'copilot', 'windsurf']

/**
 * All supported tool IDs
 */
export const SUPPORTED_AI_TOOLS = Object.keys(AI_TOOLS)

/**
 * Get tool config by ID
 */
export function getAIToolConfig(id: string): AIToolConfig | null {
  return AI_TOOLS[id] || null
}

/**
 * Parse --agents flag value
 * Examples: "claude,cursor" or "all"
 */
export function parseAgentsFlag(value: string): string[] {
  if (value === 'all') {
    return SUPPORTED_AI_TOOLS
  }

  const requested = value.split(',').map((s) => s.trim().toLowerCase())
  return requested.filter((id) => AI_TOOLS[id])
}

/**
 * Validate tool IDs
 */
export function validateToolIds(ids: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []

  for (const id of ids) {
    if (AI_TOOLS[id]) {
      valid.push(id)
    } else {
      invalid.push(id)
    }
  }

  return { valid, invalid }
}

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Detect installed AI tools
 * Returns list of tool IDs that are detected on the system
 */
export function detectInstalledTools(repoPath: string = process.cwd()): string[] {
  const detected: string[] = []

  // Claude Code: check for 'claude' command
  if (commandExists('claude')) {
    detected.push('claude')
  }

  // Cursor: check for command or .cursor/ directory in repo
  if (commandExists('cursor') || fs.existsSync(path.join(repoPath, '.cursor'))) {
    detected.push('cursor')
  }

  // Copilot: check for .github/ directory (likely has Copilot if using GitHub)
  if (fs.existsSync(path.join(repoPath, '.github'))) {
    detected.push('copilot')
  }

  // Windsurf: check for command or .windsurf/ directory
  if (commandExists('windsurf') || fs.existsSync(path.join(repoPath, '.windsurf'))) {
    detected.push('windsurf')
  }

  // Continue.dev: check for .continue/ directory
  if (
    fs.existsSync(path.join(repoPath, '.continue')) ||
    fs.existsSync(path.join(os.homedir(), '.continue'))
  ) {
    detected.push('continue')
  }

  return detected
}

/**
 * Get tools to generate based on mode
 * - 'auto': detect installed tools
 * - 'all': all supported tools
 * - specific: use provided list
 */
export function resolveToolIds(
  mode: 'auto' | 'all' | string[],
  repoPath: string = process.cwd()
): string[] {
  if (mode === 'auto') {
    const detected = detectInstalledTools(repoPath)
    // Always include claude if nothing detected (safe default)
    return detected.length > 0 ? detected : ['claude']
  }

  if (mode === 'all') {
    return SUPPORTED_AI_TOOLS
  }

  // Specific list provided
  return mode.filter((id) => AI_TOOLS[id])
}
