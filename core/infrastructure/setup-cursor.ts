/**
 * Cursor IDE Installation (Project-Level)
 *
 * Thin wrapper around the shared IDE project installer.
 * Defines Cursor-specific config (directory names, template paths, gitignore entries).
 */

import type { IDEProjectConfig } from './ide-project-installer'
import { hasIDEProject, installIDEProject, needsIDERegeneration } from './ide-project-installer'

const CURSOR_CONFIG: IDEProjectConfig = {
  name: 'Cursor',
  configDirName: '.cursor',
  rulesDirName: 'rules',
  commandsDirName: 'commands',
  routerFilename: 'prjct.mdc',
  routerTemplateKey: 'cursor/router.mdc',
  commandsTemplatePrefix: 'cursor/commands/',
  gitignoreEntries: [
    '# prjct Cursor routers (regenerated per-developer)',
    '.cursor/rules/prjct.mdc',
    '.cursor/commands/sync.md',
    '.cursor/commands/task.md',
    '.cursor/commands/done.md',
    '.cursor/commands/ship.md',
    '.cursor/commands/bug.md',
    '.cursor/commands/pause.md',
    '.cursor/commands/resume.md',
  ],
  gitignoreDedupMarker: '.cursor/rules/prjct.mdc',
}

/**
 * Install prjct routers for Cursor IDE in a project
 */
export async function installCursorProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  commandsCreated: boolean
  gitignoreUpdated: boolean
}> {
  return installIDEProject(projectRoot, CURSOR_CONFIG)
}

/**
 * Check if a project has Cursor configured (has .cursor/ directory)
 */
export async function hasCursorProject(projectRoot: string): Promise<boolean> {
  return hasIDEProject(projectRoot, CURSOR_CONFIG.configDirName)
}

/**
 * Check if Cursor routers need regeneration
 */
export async function needsCursorRegeneration(projectRoot: string): Promise<boolean> {
  return needsIDERegeneration(
    projectRoot,
    CURSOR_CONFIG.configDirName,
    CURSOR_CONFIG.rulesDirName,
    CURSOR_CONFIG.routerFilename
  )
}
