/**
 * Google Antigravity skill installation.
 *
 * Antigravity reads SKILL.md files from `~/.gemini/antigravity/skills/`.
 * This is the recommended integration method (not MCP).
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent } from '../../agentic/template-loader'
import { getErrorMessage } from '../../types/fs'
import { fileExists } from '../../utils/file-helper'
import log from '../../utils/logger'
import { PACKAGE_ROOT } from '../../utils/version'

export async function installAntigravitySkill(): Promise<{
  success: boolean
  action: string | null
}> {
  try {
    const antigravitySkillsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'skills')
    const prjctSkillDir = path.join(antigravitySkillsDir, 'prjct')
    const skillMdPath = path.join(prjctSkillDir, 'SKILL.md')
    await fs.mkdir(prjctSkillDir, { recursive: true })

    const skillExists = await fileExists(skillMdPath)

    let templateContent = getTemplateContent('antigravity/SKILL.md')
    if (!templateContent) {
      const templatePath = path.join(PACKAGE_ROOT, 'templates', 'antigravity', 'SKILL.md')
      if (!(await fileExists(templatePath))) {
        log.warn('Antigravity SKILL.md template not found')
        return { success: false, action: null }
      }
      templateContent = await fs.readFile(templatePath, 'utf-8')
    }

    await fs.writeFile(skillMdPath, templateContent, 'utf-8')

    return { success: true, action: skillExists ? 'updated' : 'created' }
  } catch (error) {
    log.warn(`Antigravity skill warning: ${getErrorMessage(error)}`)
    return { success: false, action: null }
  }
}
