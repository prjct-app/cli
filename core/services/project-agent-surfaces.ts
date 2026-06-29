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
 * Install/refresh repo-local agent instruction surfaces — ONLY when the
 * caller explicitly asks (`options.explicit`).
 *
 * Clean-repo sovereignty doctrine: prjct never writes rule/routing files into
 * a client repo automatically. A project's sole prjct footprint is `.prjct/`;
 * all rules + knowledge live in the global agent config + prjct's SQLite and
 * are pulled on demand. Automatic flows (sync, install, setup, work) call this
 * without `explicit` and get a no-op. The only opt-in path is `prjct agents`,
 * which passes `explicit: true` and writes the MINIMAL pointer block (never a
 * ruleset). Default: write nothing.
 */
export async function writeProjectAgentSurfaces(
  projectPath: string,
  options: { agents?: readonly string[]; explicit?: boolean } = {}
): Promise<ProjectAgentSurfacesResult> {
  if (!options.explicit) {
    return {
      agentsMd: { action: 'unchanged', path: path.join(projectPath, 'AGENTS.md') },
      ideRules: [],
    }
  }
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
