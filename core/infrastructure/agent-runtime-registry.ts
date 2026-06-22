import os from 'node:os'
import path from 'node:path'
import { dirExists, fileExists } from '../utils/file-helper'

export type AgentRuntimeId =
  | 'agents-md'
  | 'mcp'
  | 'acp'
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'antigravity'
  | 'opencode'
  | 'qwen-code'
  | 'goose'
  | 'aider'
  | 'cursor'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'continue'
  | 'kiro'
  | 'copilot'
  | 'devin'
  | 'jules'
  | 'zed'
  | 'warp'
  | 'amp'
  | 'factory'
  | 'augment'
  | 'kilo-code'
  | 'phoenix'
  | 'ona'
  | 'semgrep'

export type AgentRuntimeKind = 'standard' | 'cli' | 'ide' | 'hosted' | 'model-runtime'

export interface AgentRuntimeRuleTarget {
  relativePath: string
  templateKey: string
  detectPath?: string
}

export interface AgentRuntimeMcpTarget {
  format: 'claude-json' | 'codex-toml' | 'opencode-json' | 'continue-yaml' | 'generic'
  pathHint: string
  writable: boolean
}

export interface AgentRuntimeDefinition {
  id: AgentRuntimeId
  displayName: string
  kind: AgentRuntimeKind
  status: 'stable' | 'emerging' | 'hosted'
  detectsBy?: {
    homeDirs?: string[]
    projectFiles?: string[]
    projectDirs?: string[]
    commands?: string[]
  }
  contextFiles: string[]
  projectRuleTargets?: AgentRuntimeRuleTarget[]
  mcpTargets?: AgentRuntimeMcpTarget[]
  supports: {
    agentsMd: boolean
    mcp: boolean
    skills: boolean
    hooks: boolean
    acp: boolean
    projectRules: boolean
  }
  notes: string
}

export interface RuntimeDetection {
  runtime: AgentRuntimeDefinition
  detected: boolean
  reason?: string
}

const home = os.homedir()

export const AGENT_RUNTIME_REGISTRY: readonly AgentRuntimeDefinition[] = [
  {
    id: 'agents-md',
    displayName: 'AGENTS.md-compatible agents',
    kind: 'standard',
    status: 'stable',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Universal project instruction surface shared by current and future coding agents.',
  },
  {
    id: 'mcp',
    displayName: 'Model Context Protocol clients',
    kind: 'standard',
    status: 'stable',
    contextFiles: [],
    supports: {
      agentsMd: false,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Universal tool surface for prjct memory, workflow, files, and code intelligence.',
  },
  {
    id: 'acp',
    displayName: 'Agent Client Protocol clients',
    kind: 'standard',
    status: 'emerging',
    contextFiles: [],
    supports: {
      agentsMd: false,
      mcp: false,
      skills: false,
      hooks: false,
      acp: true,
      projectRules: false,
    },
    notes: 'Editor/agent transport for clients such as Zed and other ACP-compatible tools.',
  },
  {
    id: 'claude',
    displayName: 'Claude Code',
    kind: 'cli',
    status: 'stable',
    detectsBy: { homeDirs: ['.claude'], commands: ['claude'] },
    contextFiles: ['CLAUDE.md', 'AGENTS.md'],
    mcpTargets: [{ format: 'claude-json', pathHint: '~/.claude/mcp.json', writable: true }],
    supports: {
      agentsMd: false,
      mcp: true,
      skills: true,
      hooks: true,
      acp: false,
      projectRules: true,
    },
    notes: 'Uses CLAUDE.md, global skills, hooks, and Claude-style MCP JSON.',
  },
  {
    id: 'codex',
    displayName: 'OpenAI Codex',
    kind: 'cli',
    status: 'stable',
    detectsBy: { homeDirs: ['.codex'], commands: ['codex'] },
    contextFiles: ['AGENTS.md'],
    mcpTargets: [{ format: 'codex-toml', pathHint: '~/.codex/config.toml', writable: true }],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: true,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Uses AGENTS.md, compact skills, and Codex config.toml MCP servers.',
  },
  {
    id: 'gemini',
    displayName: 'Gemini CLI',
    kind: 'cli',
    status: 'stable',
    detectsBy: { homeDirs: ['.gemini'], commands: ['gemini'] },
    contextFiles: ['GEMINI.md', 'AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: true,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Uses GEMINI.md and MCP; AGENTS.md keeps repo-level compatibility with other agents.',
  },
  {
    id: 'antigravity',
    displayName: 'Google Antigravity',
    kind: 'ide',
    status: 'emerging',
    detectsBy: { homeDirs: [path.join('.gemini', 'antigravity')] },
    contextFiles: ['ANTIGRAVITY.md', 'AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: true,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Uses Antigravity skills under the Gemini config tree.',
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    kind: 'cli',
    status: 'stable',
    detectsBy: {
      homeDirs: ['.config/opencode'],
      projectDirs: ['.opencode'],
      commands: ['opencode'],
    },
    contextFiles: ['AGENTS.md', 'opencode.json', 'opencode.jsonc'],
    mcpTargets: [{ format: 'opencode-json', pathHint: 'opencode.jsonc mcp', writable: false }],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Multi-provider coding agent with AGENTS.md, project agents, plugins, and MCP config.',
  },
  {
    id: 'qwen-code',
    displayName: 'Qwen Code',
    kind: 'model-runtime',
    status: 'emerging',
    detectsBy: { homeDirs: ['.qwen'], projectDirs: ['.qwen'], commands: ['qwen'] },
    contextFiles: ['AGENTS.md', 'GEMINI.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: true,
      hooks: true,
      acp: true,
      projectRules: true,
    },
    notes:
      'Qwen-family coding runtime; treat model/provider choice as separate from runtime setup.',
  },
  {
    id: 'goose',
    displayName: 'Goose',
    kind: 'cli',
    status: 'stable',
    detectsBy: { homeDirs: ['.config/goose'], projectDirs: ['.goose'], commands: ['goose'] },
    contextFiles: ['AGENTS.md'],
    mcpTargets: [{ format: 'generic', pathHint: 'Goose extensions', writable: false }],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Open-source coding agent with extension/MCP-style tool configuration.',
  },
  {
    id: 'aider',
    displayName: 'Aider',
    kind: 'cli',
    status: 'stable',
    detectsBy: { projectFiles: ['.aider.conf.yml', '.aider.conf.yaml'], commands: ['aider'] },
    contextFiles: ['AGENTS.md', 'CONVENTIONS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'CLI pair-programming agent; AGENTS.md provides durable repo instructions.',
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.cursor'], projectFiles: ['.cursorrules'] },
    contextFiles: ['AGENTS.md', '.cursor/rules/prjct.mdc'],
    projectRuleTargets: [
      {
        relativePath: '.cursor/rules/prjct.mdc',
        templateKey: 'global/CURSOR.mdc',
        detectPath: '.cursor',
      },
    ],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Project rules live under .cursor/rules; model/provider selection happens in Cursor.',
  },
  {
    id: 'windsurf',
    displayName: 'Windsurf',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.windsurf'], projectFiles: ['.windsurfrules'] },
    contextFiles: ['AGENTS.md', '.windsurf/rules/prjct.md'],
    projectRuleTargets: [
      {
        relativePath: '.windsurf/rules/prjct.md',
        templateKey: 'global/WINDSURF.md',
        detectPath: '.windsurf',
      },
    ],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Project rules live under .windsurf/rules; keep legacy support but do not center it.',
  },
  {
    id: 'cline',
    displayName: 'Cline',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.cline', '.clinerules'], projectFiles: ['.clinerules'] },
    contextFiles: ['AGENTS.md', '.clinerules/'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: true,
      hooks: true,
      acp: true,
      projectRules: true,
    },
    notes: 'VS Code agent with AGENTS.md, rules, skills, hooks, MCP, CLI, and ACP surfaces.',
  },
  {
    id: 'roo-code',
    displayName: 'Roo Code',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.roo'] },
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'VS Code agent with MCP and project rule surfaces.',
  },
  {
    id: 'continue',
    displayName: 'Continue',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.continue'] },
    contextFiles: ['AGENTS.md'],
    mcpTargets: [{ format: 'continue-yaml', pathHint: '.continue/mcpServers/', writable: false }],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'IDE assistant with dedicated MCP server config directory.',
  },
  {
    id: 'kiro',
    displayName: 'Kiro',
    kind: 'ide',
    status: 'stable',
    detectsBy: { homeDirs: ['.kiro'], projectDirs: ['.kiro'] },
    contextFiles: ['AGENTS.md', '.kiro/steering/'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: true,
      acp: false,
      projectRules: true,
    },
    notes: 'Agentic IDE with steering docs and MCP.',
  },
  {
    id: 'copilot',
    displayName: 'GitHub Copilot coding agent',
    kind: 'hosted',
    status: 'hosted',
    detectsBy: { projectFiles: [path.join('.github', 'copilot-instructions.md')] },
    contextFiles: ['AGENTS.md', '.github/copilot-instructions.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes:
      'Hosted GitHub agent; repo instructions and MCP-compatible setup are the portable layer.',
  },
  {
    id: 'devin',
    displayName: 'Devin',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Hosted coding agent; repo-level AGENTS.md is the safest portable surface.',
  },
  {
    id: 'jules',
    displayName: 'Google Jules',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Hosted coding agent; AGENTS.md carries repo-level prjct instructions.',
  },
  {
    id: 'zed',
    displayName: 'Zed Agent Panel',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.zed'] },
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: true,
      projectRules: true,
    },
    notes: 'Editor agent surface with ACP support; AGENTS.md remains the repo contract.',
  },
  {
    id: 'warp',
    displayName: 'Warp',
    kind: 'ide',
    status: 'stable',
    detectsBy: { homeDirs: ['.warp'] },
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Terminal agent surface; AGENTS.md plus MCP covers portable prjct usage.',
  },
  {
    id: 'amp',
    displayName: 'Amp',
    kind: 'cli',
    status: 'stable',
    detectsBy: { homeDirs: ['.config/amp'], commands: ['amp'] },
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Coding agent runtime; AGENTS.md and MCP are the portable contract.',
  },
  {
    id: 'factory',
    displayName: 'Factory',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Hosted/agentic development platform; repo instructions are the stable surface.',
  },
  {
    id: 'augment',
    displayName: 'Augment',
    kind: 'ide',
    status: 'stable',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'IDE agent; universal project instructions avoid model-specific coupling.',
  },
  {
    id: 'kilo-code',
    displayName: 'Kilo Code',
    kind: 'ide',
    status: 'stable',
    detectsBy: { projectDirs: ['.kilocode'] },
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: true,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: true,
    },
    notes: 'Agent runtime in the Cline/Roo family; AGENTS.md and MCP keep it compatible.',
  },
  {
    id: 'phoenix',
    displayName: 'Phoenix',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Hosted coding agent; AGENTS.md is the repo-level bridge.',
  },
  {
    id: 'ona',
    displayName: 'Ona',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Hosted coding agent; AGENTS.md is the repo-level bridge.',
  },
  {
    id: 'semgrep',
    displayName: 'Semgrep assistant',
    kind: 'hosted',
    status: 'hosted',
    contextFiles: ['AGENTS.md'],
    supports: {
      agentsMd: true,
      mcp: false,
      skills: false,
      hooks: false,
      acp: false,
      projectRules: false,
    },
    notes: 'Security/review agent surface; AGENTS.md carries project workflow guidance.',
  },
] as const

export function getAgentRuntime(id: AgentRuntimeId): AgentRuntimeDefinition {
  const runtime = AGENT_RUNTIME_REGISTRY.find((entry) => entry.id === id)
  if (!runtime) throw new Error(`Unknown agent runtime: ${id}`)
  return runtime
}

export function listAgentRuntimes(): readonly AgentRuntimeDefinition[] {
  return AGENT_RUNTIME_REGISTRY
}

export function listProjectRuleTargets(): AgentRuntimeRuleTarget[] {
  return AGENT_RUNTIME_REGISTRY.flatMap((runtime) => runtime.projectRuleTargets ?? [])
}

export async function detectRuntimeProjectSurfaces(
  projectPath: string
): Promise<RuntimeDetection[]> {
  return Promise.all(
    AGENT_RUNTIME_REGISTRY.map(async (runtime): Promise<RuntimeDetection> => {
      const projectFiles = runtime.detectsBy?.projectFiles ?? []
      for (const file of projectFiles) {
        if (await fileExists(path.join(projectPath, file))) {
          return { runtime, detected: true, reason: file }
        }
      }

      const projectDirs = runtime.detectsBy?.projectDirs ?? []
      for (const dir of projectDirs) {
        if (await dirExists(path.join(projectPath, dir))) {
          return { runtime, detected: true, reason: dir }
        }
      }

      const homeDirs = runtime.detectsBy?.homeDirs ?? []
      for (const dir of homeDirs) {
        if (await dirExists(path.join(home, dir))) {
          return { runtime, detected: true, reason: `~/${dir}` }
        }
      }

      return { runtime, detected: false }
    })
  )
}
