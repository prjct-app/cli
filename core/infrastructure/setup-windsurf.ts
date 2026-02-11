/**
 * Windsurf IDE Installation (Project-Level)
 *
 * Unlike Claude/Gemini which have global config, Windsurf uses project-level
 * configuration in .windsurf/rules/ and .windsurf/workflows/.
 *
 * Key differences from Cursor:
 * - Uses .md files (not .mdc) with YAML frontmatter
 * - Uses "workflows" directory instead of "commands"
 * - Frontmatter uses `trigger: always_on` instead of `alwaysApply: true`
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
 * Install prjct routers for Windsurf IDE in a project
 *
 * Unlike Claude/Gemini which have global config, Windsurf uses project-level
 * configuration in .windsurf/rules/ and .windsurf/workflows/.
 *
 * Key differences from Cursor:
 * - Uses .md files (not .mdc) with YAML frontmatter
 * - Uses "workflows" directory instead of "commands"
 * - Frontmatter uses `trigger: always_on` instead of `alwaysApply: true`
 *
 * @param projectRoot - The project root directory
 * @returns Object with success status and files created
 */
export async function installWindsurfProject(projectRoot: string): Promise<{
  success: boolean
  rulesCreated: boolean
  workflowsCreated: boolean
  gitignoreUpdated: boolean
}> {
  const result = {
    success: false,
    rulesCreated: false,
    workflowsCreated: false,
    gitignoreUpdated: false,
  }

  try {
    const windsurfDir = path.join(projectRoot, '.windsurf')
    const rulesDir = path.join(windsurfDir, 'rules')
    const workflowsDir = path.join(windsurfDir, 'workflows')

    const routerDest = path.join(rulesDir, 'prjct.md')

    // Ensure directories exist
    await fs.mkdir(rulesDir, { recursive: true })
    await fs.mkdir(workflowsDir, { recursive: true })

    // Copy router.md -> .windsurf/rules/prjct.md
    const routerContent = getTemplateContent('windsurf/router.md')
    if (routerContent) {
      await fs.writeFile(routerDest, routerContent, 'utf-8')
      result.rulesCreated = true
    } else {
      const routerSource = path.join(PACKAGE_ROOT, 'templates', 'windsurf', 'router.md')
      if (await fileExists(routerSource)) {
        await fs.copyFile(routerSource, routerDest)
        result.rulesCreated = true
      }
    }

    // Copy individual workflow files -> .windsurf/workflows/
    const bundledWorkflows = listTemplates('windsurf/workflows/')
    if (bundledWorkflows.length > 0) {
      for (const key of bundledWorkflows) {
        if (key.endsWith('.md')) {
          const content = getTemplateContent(key)
          if (content) {
            const fileName = path.basename(key)
            await fs.writeFile(path.join(workflowsDir, fileName), content, 'utf-8')
          }
        }
      }
      result.workflowsCreated = bundledWorkflows.length > 0
    } else {
      const windsurfWorkflowsSource = path.join(PACKAGE_ROOT, 'templates', 'windsurf', 'workflows')
      if (await fileExists(windsurfWorkflowsSource)) {
        const workflowFiles = (await fs.readdir(windsurfWorkflowsSource)).filter((f) =>
          f.endsWith('.md')
        )
        for (const file of workflowFiles) {
          const src = path.join(windsurfWorkflowsSource, file)
          const dest = path.join(workflowsDir, file)
          await fs.copyFile(src, dest)
        }
        result.workflowsCreated = workflowFiles.length > 0
      }
    }

    // Update .gitignore to exclude prjct Windsurf routers
    result.gitignoreUpdated = await addWindsurfToGitignore(projectRoot)

    result.success = result.rulesCreated || result.workflowsCreated
    return result
  } catch (error) {
    log.warn(`Windsurf installation warning: ${getErrorMessage(error)}`)
    return result
  }
}

/**
 * Add Windsurf prjct routers to .gitignore
 *
 * These files are per-developer and regenerated automatically.
 */
async function addWindsurfToGitignore(projectRoot: string): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, '.gitignore')
    const entriesToAdd = [
      '# prjct Windsurf routers (regenerated per-developer)',
      '.windsurf/rules/prjct.md',
      '.windsurf/workflows/sync.md',
      '.windsurf/workflows/task.md',
      '.windsurf/workflows/done.md',
      '.windsurf/workflows/ship.md',
      '.windsurf/workflows/bug.md',
      '.windsurf/workflows/pause.md',
      '.windsurf/workflows/resume.md',
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
    if (content.includes('.windsurf/rules/prjct.md')) {
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
 * Check if a project has Windsurf configured (has .windsurf/ directory)
 */
export async function hasWindsurfProject(projectRoot: string): Promise<boolean> {
  return await fileExists(path.join(projectRoot, '.windsurf'))
}

/**
 * Check if Windsurf routers need regeneration
 */
export async function needsWindsurfRegeneration(projectRoot: string): Promise<boolean> {
  const windsurfDir = path.join(projectRoot, '.windsurf')
  const routerPath = path.join(windsurfDir, 'rules', 'prjct.md')

  // Only check if .windsurf/ exists (project uses Windsurf)
  return (await fileExists(windsurfDir)) && !(await fileExists(routerPath))
}
