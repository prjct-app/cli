/**
 * AI Tools Registry
 *
 * Registry of AI coding tools (Claude Code, Cursor, Copilot, etc.)
 * Each tool has its own context file format and token budget.
 *
 * Phase 1: Claude Code + Cursor
 * Phase 2: + Copilot + Windsurf
 */

export interface AIToolConfig {
  id: string
  name: string
  outputFile: string
  outputPath: 'repo' | 'global'  // 'repo' = project root, 'global' = ~/.prjct-cli/projects/{id}/context/
  maxTokens: number
  format: 'detailed' | 'concise' | 'minimal'
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
}

/**
 * Default tools to generate (Phase 1)
 */
export const DEFAULT_AI_TOOLS = ['claude', 'cursor']

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

  const requested = value.split(',').map(s => s.trim().toLowerCase())
  return requested.filter(id => AI_TOOLS[id])
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
