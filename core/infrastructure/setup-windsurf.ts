/**
 * Windsurf IDE Installation (Project-Level)
 *
 * Thin wrapper around the shared IDE project installer.
 * Defines Windsurf-specific config (directory names, template paths, gitignore entries).
 */

import type { IDEProjectConfig } from './ide-project-installer'
import { hasIDEProject, installIDEProject, needsIDERegeneration } from './ide-project-installer'

const WINDSURF_CONFIG: IDEProjectConfig = {
  name: 'Windsurf',
  configDirName: '.windsurf',
  rulesDirName: 'rules',
  commandsDirName: 'workflows',
  routerFilename: 'prjct.md',
  routerTemplateKey: 'windsurf/router.md',
  commandsTemplatePrefix: 'windsurf/workflows/',
  gitignoreEntries: [
    '# prjct Windsurf routers (regenerated per-developer)',
    '.windsurf/rules/prjct.md',
    '.windsurf/workflows/sync.md',
    '.windsurf/workflows/task.md',
    '.windsurf/workflows/done.md',
    '.windsurf/workflows/ship.md',
    '.windsurf/workflows/bug.md',
    '.windsurf/workflows/pause.md',
    '.windsurf/workflows/resume.md',
  ],
  gitignoreDedupMarker: '.windsurf/rules/prjct.md',
}

/**
 * Install prjct routers for Windsurf IDE in a project
 */
export async function installWindsurfProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  workflowsCreated: boolean
  gitignoreUpdated: boolean
}> {
  const result = await installIDEProject(projectRoot, WINDSURF_CONFIG)
  return {
    success: result.success,
    rulesCreated: result.rulesCreated,
    workflowsCreated: result.commandsCreated,
    gitignoreUpdated: result.gitignoreUpdated,
  }
}

/**
 * Check if a project has Windsurf configured (has .windsurf/ directory)
 */
export async function hasWindsurfProject(projectRoot: string): Promise<boolean> {
  return hasIDEProject(projectRoot, WINDSURF_CONFIG.configDirName)
}

/**
 * Check if Windsurf routers need regeneration
 */
export async function needsWindsurfRegeneration(projectRoot: string): Promise<boolean> {
  return needsIDERegeneration(
    projectRoot,
    WINDSURF_CONFIG.configDirName,
    WINDSURF_CONFIG.rulesDirName,
    WINDSURF_CONFIG.routerFilename
  )
}
