/**
 * OpenAI Codex skill installation + verification.
 *
 * Codex consumes prjct as a SKILL.md at `~/.codex/skills/prjct/`. The
 * router-ready check is what the doctor and sync flows poll to decide
 * whether to nag the user. Auto-repair re-runs the install on demand.
 *
 * Exposed:
 *   - installCodexSkill()       — write/refresh SKILL.md
 *   - verifyCodexPRouterReady() — pass/fail with optional autoRepair
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent } from '../../agentic/template-loader'
import { getErrorMessage } from '../../types/fs'
import type { CodexPRouterStatus } from '../../types/infrastructure.js'
import { fileExists } from '../../utils/file-helper'
import { sha256 } from '../../utils/hash'
import log from '../../utils/logger'
import { PACKAGE_ROOT, VERSION } from '../../utils/version'
import { detectCodex } from '../ai-provider'

const CODEX_SKILL_META_MARKER = 'prjct-codex-router'

function getCodexSkillPath(): string {
  return path.join(os.homedir(), '.codex', 'skills', 'prjct', 'SKILL.md')
}

function getCodexSkillMetadata(templateHash: string): string {
  return `<!-- ${CODEX_SKILL_META_MARKER}: ${JSON.stringify({
    version: VERSION,
    templateHash,
  })} -->`
}

function parseCodexSkillMetadata(
  content: string
): { version?: string; templateHash?: string } | null {
  const match = content.match(
    new RegExp(`<!--\\s*${CODEX_SKILL_META_MARKER}:\\s*(\\{[\\s\\S]*?\\})\\s*-->`)
  )
  if (!match) return null
  try {
    return JSON.parse(match[1]) as { version?: string; templateHash?: string }
  } catch {
    return null
  }
}

async function loadCodexSkillTemplate(): Promise<string | null> {
  const bundled = getTemplateContent('codex/SKILL.md')
  if (bundled) return bundled

  const templatePath = path.join(PACKAGE_ROOT, 'templates', 'codex', 'SKILL.md')
  if (!(await fileExists(templatePath))) {
    return null
  }

  return fs.readFile(templatePath, 'utf-8')
}

function buildCodexSkillContent(templateContent: string): {
  content: string
  templateHash: string
} {
  const normalized = templateContent.trimEnd()
  const templateHash = sha256(normalized)
  const metadata = getCodexSkillMetadata(templateHash)
  return {
    content: `${normalized}\n\n${metadata}\n`,
    templateHash,
  }
}

/**
 * Install prjct as a skill for OpenAI Codex.
 *
 * Codex uses SKILL.md files in ~/.codex/skills/, mirroring the
 * Antigravity integration pattern.
 */
export async function installCodexSkill(): Promise<{
  success: boolean
  action: string | null
}> {
  try {
    const skillMdPath = getCodexSkillPath()
    const prjctSkillDir = path.dirname(skillMdPath)
    await fs.mkdir(prjctSkillDir, { recursive: true })

    const skillExists = await fileExists(skillMdPath)

    const templateContent = await loadCodexSkillTemplate()
    if (!templateContent) {
      log.warn('Codex SKILL.md template not found')
      return { success: false, action: null }
    }

    const built = buildCodexSkillContent(templateContent)

    if (skillExists) {
      const existing = await fs.readFile(skillMdPath, 'utf-8').catch(() => '')
      if (existing === built.content) {
        return { success: true, action: 'unchanged' }
      }
    }

    await fs.writeFile(skillMdPath, built.content, 'utf-8')
    return { success: true, action: skillExists ? 'updated' : 'created' }
  } catch (error) {
    log.warn(`Codex skill warning: ${getErrorMessage(error)}`)
    return { success: false, action: null }
  }
}

export async function verifyCodexPRouterReady(
  options: { autoRepair?: boolean } = {}
): Promise<CodexPRouterStatus> {
  const skillPath = getCodexSkillPath()
  const codexDetection = await detectCodex()
  if (!codexDetection.installed) {
    return {
      installed: false,
      verified: true,
      skillPath,
      message: 'Codex not detected',
    }
  }

  const templateContent = await loadCodexSkillTemplate()
  if (!templateContent) {
    return {
      installed: true,
      verified: false,
      skillPath,
      message: 'Codex SKILL.md template missing from prjct installation',
      fix: ['Reinstall prjct-cli package', 'Run `prjct setup`'],
    }
  }

  const expected = buildCodexSkillContent(templateContent)

  const maybeRepair = async (): Promise<boolean> => {
    if (!options.autoRepair) return false
    const result = await installCodexSkill()
    return result.success
  }

  let skillContent = ''
  if (!(await fileExists(skillPath))) {
    if (!(await maybeRepair())) {
      return {
        installed: true,
        verified: false,
        skillPath,
        templateHash: expected.templateHash,
        message: 'Codex skill missing at ~/.codex/skills/prjct/SKILL.md',
        fix: ['Run `prjct start` to install Codex skill'],
      }
    }
  }

  skillContent = await fs.readFile(skillPath, 'utf-8').catch(() => '')
  let metadata = parseCodexSkillMetadata(skillContent)
  const metadataMatches =
    metadata?.version === VERSION && metadata?.templateHash === expected.templateHash

  if (!metadataMatches) {
    if (!(await maybeRepair())) {
      return {
        installed: true,
        verified: false,
        skillPath,
        templateHash: expected.templateHash,
        message: 'Codex skill metadata mismatch (outdated router)',
        fix: ['Run `prjct start` or `prjct setup` to refresh Codex skill'],
      }
    }

    skillContent = await fs.readFile(skillPath, 'utf-8').catch(() => '')
    metadata = parseCodexSkillMetadata(skillContent)
    const repaired =
      metadata?.version === VERSION && metadata?.templateHash === expected.templateHash
    if (!repaired) {
      return {
        installed: true,
        verified: false,
        skillPath,
        templateHash: expected.templateHash,
        message: 'Codex skill could not be repaired automatically',
        fix: ['Delete ~/.codex/skills/prjct/SKILL.md', 'Run `prjct setup`'],
      }
    }
  }

  return {
    installed: true,
    verified: true,
    skillPath,
    templateHash: expected.templateHash,
    message: 'Codex p. router ready',
  }
}
