/**
 * Gemini CLI integration. The legacy `p.toml` router under
 * `~/.gemini/commands/` is deprecated in favor of skill-driven
 * workflows; this module owns its cleanup, plus the global
 * `GEMINI.md` configuration write that mirrors what we do for Claude.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent } from '../../agentic/template-loader'
import { getErrorMessage, isNotFoundError } from '../../types/fs'
import log from '../../utils/logger'
import { PACKAGE_ROOT } from '../../utils/version'
import { mergeWithMarkers } from '../ide-project-installer'

/**
 * Cleanup legacy Gemini router (p.toml) if it exists.
 * Router is deprecated — skills handle workflows natively.
 */
export async function installGeminiRouter(): Promise<boolean> {
  try {
    const geminiCommandsDir = path.join(os.homedir(), '.gemini', 'commands')
    const routerDest = path.join(geminiCommandsDir, 'p.toml')

    try {
      await fs.unlink(routerDest)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false // Already gone
      }
      throw error
    }
  } catch (error) {
    log.warn(`Gemini router cleanup warning: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Install or update global GEMINI.md configuration.
 */
export async function installGeminiGlobalConfig(): Promise<{
  success: boolean
  action: string | null
}> {
  try {
    const geminiDir = path.join(os.homedir(), '.gemini')
    const globalConfigPath = path.join(geminiDir, 'GEMINI.md')
    await fs.mkdir(geminiDir, { recursive: true })

    let templateContent = getTemplateContent('global/GEMINI.md')
    if (!templateContent) {
      const templatePath = path.join(PACKAGE_ROOT, 'templates', 'global', 'GEMINI.md')
      templateContent = await fs.readFile(templatePath, 'utf-8')
    }

    let existingContent = ''
    let configExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      configExists = true
    } catch (error) {
      if (isNotFoundError(error)) {
        configExists = false
      } else {
        throw error
      }
    }

    const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
    const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

    const merged = mergeWithMarkers(
      configExists ? existingContent : '',
      templateContent,
      startMarker,
      endMarker
    )

    await fs.writeFile(globalConfigPath, merged.content, 'utf-8')
    return { success: true, action: merged.action }
  } catch (error) {
    log.warn(`Gemini config warning: ${getErrorMessage(error)}`)
    return { success: false, action: null }
  }
}
