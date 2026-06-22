import path from 'node:path'
import { fileExists } from '../utils/file-helper'
import { writeProjectAgentsMd } from './project-agents-md'
import { writeProjectClaudeMd } from './project-claude-md'
import { writeProjectIdeRules } from './project-ide-rules'
import type { RoutingWriteResult } from './routing-block'

export interface ProjectAgentSurfacesResult {
  agentsMd: RoutingWriteResult
  claudeMd?: RoutingWriteResult
  ideRules: string[]
}

/**
 * Install/refresh repo-local agent instruction surfaces.
 *
 * AGENTS.md is intentionally unconditional: it is the portable baseline for
 * Codex, OpenCode, Qwen Code, Cline, Roo, Copilot coding agent, hosted agents,
 * and future runtimes that adopt the standard. Runtime-specific files are
 * best-effort adapters on top of that baseline.
 */
export async function writeProjectAgentSurfaces(
  projectPath: string,
  options: { agents?: readonly string[] } = {}
): Promise<ProjectAgentSurfacesResult> {
  const selected = new Set(options.agents ?? [])
  const agentsMd = await writeProjectAgentsMd(projectPath)
  const projectClaude = await fileExists(path.join(projectPath, 'CLAUDE.md'))
  const shouldWriteClaude = selected.has('claude') || projectClaude
  const claudeMd = shouldWriteClaude ? await writeProjectClaudeMd(projectPath) : undefined
  const ideRules = await writeProjectIdeRules(projectPath, options)

  return {
    agentsMd,
    ...(claudeMd ? { claudeMd } : {}),
    ideRules: ideRules.written,
  }
}
