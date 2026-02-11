/**
 * Cursor IDE Installation (Project-Level)
 *
 * Unlike Claude/Gemini which have global config, Cursor uses project-level
 * configuration in .cursor/rules/ and .cursor/commands/.
 *
 * Extracted from setup.ts for maintainability.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getTemplateContent, listTemplates } from '../agentic/template-loader'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { fileExists } from '../utils/file-helper'
import log from '../utils/logger'
import { PACKAGE_ROOT } from '../utils/version'

/**
 * Install prjct routers for Cursor IDE in a project
 *
 * Unlike Claude/Gemini which have global config, Cursor uses project-level
 * configuration in .cursor/rules/ and .cursor/commands/.
 *
 * Creates minimal routers that point to the npm package for real instructions.
 * Installs individual command files for better Cursor UX (/sync, /task, etc.)
 *
 * @param projectRoot - The project root directory
 * @returns Object with success status and files created
 */
export async function installCursorProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  commandsCreated: boolean
  gitignoreUpdated: boolean
}> {
  const result = {
    success: false,
    rulesCreated: false,
    commandsCreated: false,
    gitignoreUpdated: false,
  }

  try {
    const cursorDir = path.join(projectRoot, '.cursor')
    const rulesDir = path.join(cursorDir, 'rules')
    const commandsDir = path.join(cursorDir, 'commands')

    const routerMdcDest = path.join(rulesDir, 'prjct.mdc')

    // Ensure directories exist
    await fs.mkdir(rulesDir, { recursive: true })
    await fs.mkdir(commandsDir, { recursive: true })

    // Copy router.mdc -> .cursor/rules/prjct.mdc
    const routerContent = getTemplateContent('cursor/router.mdc')
    if (routerContent) {
      await fs.writeFile(routerMdcDest, routerContent, 'utf-8')
      result.rulesCreated = true
    } else {
      const routerMdcSource = path.join(PACKAGE_ROOT, 'templates', 'cursor', 'router.mdc')
      if (await fileExists(routerMdcSource)) {
        await fs.copyFile(routerMdcSource, routerMdcDest)
        result.rulesCreated = true
      }
    }

    // Copy individual command files -> .cursor/commands/
    const bundledCommands = listTemplates('cursor/commands/')
    if (bundledCommands.length > 0) {
      for (const key of bundledCommands) {
        if (key.endsWith('.md')) {
          const content = getTemplateContent(key)
          if (content) {
            const fileName = path.basename(key)
            await fs.writeFile(path.join(commandsDir, fileName), content, 'utf-8')
          }
        }
      }
      result.commandsCreated = bundledCommands.length > 0
    } else {
      const cursorCommandsSource = path.join(PACKAGE_ROOT, 'templates', 'cursor', 'commands')
      if (await fileExists(cursorCommandsSource)) {
        const commandFiles = (await fs.readdir(cursorCommandsSource)).filter((f) =>
          f.endsWith('.md')
        )
        for (const file of commandFiles) {
          const src = path.join(cursorCommandsSource, file)
          const dest = path.join(commandsDir, file)
          await fs.copyFile(src, dest)
        }
        result.commandsCreated = commandFiles.length > 0
      }
    }

    // Update .gitignore to exclude prjct Cursor routers
    result.gitignoreUpdated = await addCursorToGitignore(projectRoot)

    result.success = result.rulesCreated || result.commandsCreated
    return result
  } catch (error) {
    log.warn(`Cursor installation warning: ${getErrorMessage(error)}`)
    return result
  }
}

/**
 * Add Cursor prjct routers to .gitignore
 *
 * These files are per-developer and regenerated automatically.
 */
async function addCursorToGitignore(projectRoot: string): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, '.gitignore')
    const entriesToAdd = [
      '# prjct Cursor routers (regenerated per-developer)',
      '.cursor/rules/prjct.mdc',
      '.cursor/commands/sync.md',
      '.cursor/commands/task.md',
      '.cursor/commands/done.md',
      '.cursor/commands/ship.md',
      '.cursor/commands/bug.md',
      '.cursor/commands/pause.md',
      '.cursor/commands/resume.md',
    ]

    let content = ''
    let configExists = false

    try {
      content = await fs.readFile(gitignorePath, 'utf-8')
      configExists = true
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }

    // Check if already added
    if (content.includes('.cursor/rules/prjct.mdc')) {
      return false // Already added
    }

    // Append to .gitignore
    const newContent = configExists
      ? `${content.trimEnd()}\n\n${entriesToAdd.join('\n')}\n`
      : `${entriesToAdd.join('\n')}\n`

    await fs.writeFile(gitignorePath, newContent, 'utf-8')
    return true
  } catch (error) {
    log.warn(`Gitignore update warning: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Check if a project has Cursor configured (has .cursor/ directory)
 */
export async function hasCursorProject(projectRoot: string): Promise<boolean> {
  return await fileExists(path.join(projectRoot, '.cursor'))
}

/**
 * Check if Cursor routers need regeneration
 */
export async function needsCursorRegeneration(projectRoot: string): Promise<boolean> {
  const cursorDir = path.join(projectRoot, '.cursor')
  const routerPath = path.join(cursorDir, 'rules', 'prjct.mdc')

  // Only check if .cursor/ exists (project uses Cursor)
  return (await fileExists(cursorDir)) && !(await fileExists(routerPath))
}
