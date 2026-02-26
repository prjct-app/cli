/**
 * Shared IDE Project Installer
 *
 * Parameterized installer for project-level IDE integrations (Cursor, Windsurf).
 * Both use the same pattern: config dir → rules dir → commands/workflows dir.
 *
 * Differences are captured in IDEProjectConfig:
 * - Cursor: .cursor/rules/*.mdc, .cursor/commands/*.md
 * - Windsurf: .windsurf/rules/*.md, .windsurf/workflows/*.md
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getTemplateContent, listTemplates } from '../agentic/template-loader'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { fileExists } from '../utils/file-helper'
import log from '../utils/logger'
import { PACKAGE_ROOT } from '../utils/version'

// =============================================================================
// IDE Project Installer
// =============================================================================

export interface IDEProjectConfig {
  /** Display name for logging (e.g. "Cursor", "Windsurf") */
  name: string
  /** Config directory name relative to project root (e.g. ".cursor", ".windsurf") */
  configDirName: string
  /** Rules subdirectory name (e.g. "rules") */
  rulesDirName: string
  /** Commands/workflows subdirectory name (e.g. "commands", "workflows") */
  commandsDirName: string
  /** Router filename in rules dir (e.g. "prjct.mdc", "prjct.md") */
  routerFilename: string
  /** Template key for router (e.g. "cursor/router.mdc", "windsurf/router.md") */
  routerTemplateKey: string
  /** Template prefix for commands (e.g. "cursor/commands/", "windsurf/workflows/") */
  commandsTemplatePrefix: string
  /** Gitignore entries to add */
  gitignoreEntries: string[]
  /** Gitignore dedup check string (e.g. ".cursor/rules/prjct.mdc") */
  gitignoreDedupMarker: string
}

export interface IDEProjectResult {
  success: boolean
  rulesCreated: boolean
  commandsCreated: boolean
  gitignoreUpdated: boolean
}

/**
 * Install prjct routers for a project-level IDE
 *
 * Shared logic: mkdir dirs -> copy router -> copy command files -> update gitignore
 */
export async function installIDEProject(
  projectRoot: string,
  config: IDEProjectConfig
): Promise<IDEProjectResult> {
  const result: IDEProjectResult = {
    success: false,
    rulesCreated: false,
    commandsCreated: false,
    gitignoreUpdated: false,
  }

  try {
    const ideDir = path.join(projectRoot, config.configDirName)
    const rulesDir = path.join(ideDir, config.rulesDirName)
    const commandsDir = path.join(ideDir, config.commandsDirName)
    const routerDest = path.join(rulesDir, config.routerFilename)

    // Ensure directories exist
    await fs.mkdir(rulesDir, { recursive: true })
    await fs.mkdir(commandsDir, { recursive: true })

    // Copy router template -> rules dir
    const routerContent = getTemplateContent(config.routerTemplateKey)
    if (routerContent) {
      await fs.writeFile(routerDest, routerContent, 'utf-8')
      result.rulesCreated = true
    } else {
      const routerSource = path.join(
        PACKAGE_ROOT,
        'templates',
        ...config.routerTemplateKey.split('/')
      )
      if (await fileExists(routerSource)) {
        await fs.copyFile(routerSource, routerDest)
        result.rulesCreated = true
      }
    }

    // Copy individual command/workflow files -> commands dir
    const bundledCommands = listTemplates(config.commandsTemplatePrefix)
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
      const commandsSource = path.join(
        PACKAGE_ROOT,
        'templates',
        ...config.commandsTemplatePrefix.split('/').filter(Boolean)
      )
      if (await fileExists(commandsSource)) {
        const commandFiles = (await fs.readdir(commandsSource)).filter((f) => f.endsWith('.md'))
        for (const file of commandFiles) {
          const src = path.join(commandsSource, file)
          const dest = path.join(commandsDir, file)
          await fs.copyFile(src, dest)
        }
        result.commandsCreated = commandFiles.length > 0
      }
    }

    // Update .gitignore
    result.gitignoreUpdated = await addToGitignore(
      projectRoot,
      config.gitignoreEntries,
      config.gitignoreDedupMarker,
      config.name
    )

    result.success = result.rulesCreated || result.commandsCreated
    return result
  } catch (error) {
    log.warn(`${config.name} installation warning: ${getErrorMessage(error)}`)
    return result
  }
}

/**
 * Check if a project has an IDE configured (has config directory)
 */
export async function hasIDEProject(projectRoot: string, configDirName: string): Promise<boolean> {
  return await fileExists(path.join(projectRoot, configDirName))
}

/**
 * Check if IDE routers need regeneration
 */
export async function needsIDERegeneration(
  projectRoot: string,
  configDirName: string,
  rulesDirName: string,
  routerFilename: string
): Promise<boolean> {
  const ideDir = path.join(projectRoot, configDirName)
  const routerPath = path.join(ideDir, rulesDirName, routerFilename)
  return (await fileExists(ideDir)) && !(await fileExists(routerPath))
}

// =============================================================================
// Gitignore Helper
// =============================================================================

/**
 * Add IDE-specific entries to .gitignore
 *
 * These files are per-developer and regenerated automatically.
 */
async function addToGitignore(
  projectRoot: string,
  entries: string[],
  dedupMarker: string,
  _ideName: string
): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, '.gitignore')

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
    if (content.includes(dedupMarker)) {
      return false
    }

    // Append to .gitignore
    const newContent = configExists
      ? `${content.trimEnd()}\n\n${entries.join('\n')}\n`
      : `${entries.join('\n')}\n`

    await fs.writeFile(gitignorePath, newContent, 'utf-8')
    return true
  } catch (error) {
    log.warn(`Gitignore update warning: ${getErrorMessage(error)}`)
    return false
  }
}

// =============================================================================
// Merge with Markers (shared HTML comment marker merge logic)
// =============================================================================

/**
 * Intelligent merge using HTML comment markers.
 *
 * Handles three cases:
 * 1. No existing content -> create with template
 * 2. Existing content without markers -> append template
 * 3. Existing content with markers -> replace section between markers
 *
 * Used by setup.ts (Gemini config) and command-installer.ts (Claude config).
 */
export function mergeWithMarkers(
  existing: string,
  template: string,
  startMarker: string,
  endMarker: string
): { content: string; action: 'created' | 'appended' | 'updated' } {
  if (!existing) {
    return { content: template, action: 'created' }
  }

  const hasMarkers = existing.includes(startMarker) && existing.includes(endMarker)

  if (!hasMarkers) {
    return {
      content: `${existing}\n\n${template}`,
      action: 'appended',
    }
  }

  // Markers exist - replace content between markers
  const beforeMarker = existing.substring(0, existing.indexOf(startMarker))
  const afterMarker = existing.substring(existing.indexOf(endMarker) + endMarker.length)

  // Extract prjct section from template (in case template has extra content around markers)
  let prjctSection: string
  if (template.includes(startMarker) && template.includes(endMarker)) {
    prjctSection = template.substring(
      template.indexOf(startMarker),
      template.indexOf(endMarker) + endMarker.length
    )
  } else {
    // Template IS the section
    prjctSection = template
  }

  return {
    content: beforeMarker + prjctSection + afterMarker,
    action: 'updated',
  }
}
