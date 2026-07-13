/**
 * Portable multi-host skill installer.
 *
 * L0 skill is project-agnostic (agentskills progressive disclosure).
 * Project identity never lands in global skills — last-writer-wins poison.
 * One content SSOT → N host paths (Claude full skill; Codex/Gemini compact).
 *
 * Live project facts = L1 SessionStart / prompt hooks + pull tools (MCP/CLI).
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../errors'
import type { ProjectSyncResult } from '../types/project-sync'
import type { SkillGenerationResult } from '../types/services.js'
import log from '../utils/logger'
import { buildCompactSkill } from './skill-generator/editor-surfaces'
import {
  buildPrjctSkillBody,
  buildPrjctSkillReference,
  emptySkillContext,
  PRJCT_SKILL_ALLOWED_TOOLS,
  PRJCT_SKILL_DESCRIPTION,
  PRJCT_SKILL_REFERENCE_FILE,
} from './skill-generator/prjct-skill-body'
import type { ConditionContext, SkillContext, SkillDefinition } from './skill-generator/types'

/**
 * Anti-harness skill template (canonical Anthropic shape).
 *
 * The body is `Use when` + `What's here` + `Gotchas` — zero numbered
 * steps. prjct describes state; the agent decides HOW.
 * Body is always portable (emptySkillContext) — never project-stamped.
 */
const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    name: 'prjct',
    description: PRJCT_SKILL_DESCRIPTION,
    allowedTools: [...PRJCT_SKILL_ALLOWED_TOOLS],
    condition: () => true,
    body: (ctx) => buildPrjctSkillBody(ctx),
    reference: () => buildPrjctSkillReference(),
    referenceFile: PRJCT_SKILL_REFERENCE_FILE,
  },
]

// CRITICAL — cache stability + multi-project isolation: description and
// body take NO project context. Project facts ship via SessionStart /
// prompt hooks (cwd-scoped) and pull tools.
function buildFrontmatter(skill: SkillDefinition): string {
  const isUserInvocable = skill.userInvocable !== false
  return `---
description: "${skill.description}"
allowed-tools: [${skill.allowedTools.map((t) => `"${t}"`).join(', ')}]
user-invocable: ${isUserInvocable}
---`
}

function buildSkillContent(def: SkillDefinition, ctx: SkillContext): string {
  return `${buildFrontmatter(def)}\n\n${def.body(ctx)}`
}

function homeDir(): string {
  return process.env.HOME || os.homedir()
}

/** Hosts that install the full Claude-format skill + workflows.md reference. */
function claudeSkillsRoot(): string {
  return path.join(homeDir(), '.claude', 'skills')
}

/**
 * Hosts that install the compact CONTRACT skill (agentskills-compatible,
 * Codex hard ~1024B including metadata when installed via codex-skill).
 */
function compactSkillRoots(): string[] {
  const home = homeDir()
  return [
    path.join(home, '.codex', 'skills'),
    path.join(home, '.gemini', 'skills'),
    path.join(home, '.gemini', 'antigravity', 'global_skills'),
  ]
}

/**
 * True when skill body embeds project identity (multi-project poison).
 * Portable skill uses baseline "What's here" only — no `# name` + stack line.
 */
export function skillBodyHasProjectStamp(content: string): boolean {
  // Pattern from formatProjectHeader when projectName is set:
  //   # my-app
  //   TypeScript/Hono | 200 files | v2.0.0 | Branch: feat/x
  if (/^# [^\n]+\n[^\n]*\|\s*\d+\s+files\s*\|/m.test(content)) return true
  if (/## Recent Deliveries/m.test(content)) return true
  if (/## Velocity/m.test(content) && /pts\/sprint/m.test(content)) return true
  return false
}

class SkillGenerator {
  /**
   * Install portable L0 skills to all host skill dirs.
   * syncResult / richContext are accepted for API stability but **ignored**
   * for skill body content (project facts never enter global skills).
   */
  async generateAndInstall(
    _syncResult?: ProjectSyncResult,
    conditionContext: ConditionContext = {
      backlogCount: 0,
      completedTaskCount: 0,
      pausedTaskCount: 0,
      hasActiveTask: false,
    },
    _richContext?: Partial<
      Omit<SkillContext, 'projectName' | 'stack' | 'branch' | 'commands' | 'projectId'>
    >
  ): Promise<SkillGenerationResult> {
    const result: SkillGenerationResult = { generated: [], skipped: [] }

    // Always portable — multi-project isolation.
    const ctx = emptySkillContext()
    const skillsDir = claudeSkillsRoot()

    for (const def of SKILL_DEFINITIONS) {
      if (!def.condition(conditionContext)) {
        result.skipped.push({ name: def.name, reason: 'condition not met' })
        await fs
          .rm(path.join(skillsDir, def.name), { recursive: true, force: true })
          .catch(() => {})
        continue
      }

      try {
        const content = buildSkillContent(def, ctx)
        if (skillBodyHasProjectStamp(content)) {
          throw new Error('refusing to install project-stamped skill body (isolation guard)')
        }
        const skillDir = path.join(skillsDir, def.name)
        const skillPath = path.join(skillDir, 'SKILL.md')

        await fs.mkdir(skillDir, { recursive: true })
        await fs.writeFile(skillPath, content, 'utf-8')

        if (def.reference && def.referenceFile) {
          await fs.writeFile(path.join(skillDir, def.referenceFile), def.reference(), 'utf-8')
        }

        result.generated.push({ name: def.name, path: skillPath })
      } catch (error) {
        log.debug(`Failed to generate skill ${def.name}`, { error: getErrorMessage(error) })
        result.skipped.push({ name: def.name, reason: getErrorMessage(error) })
      }
    }

    // Compact CONTRACT skill → Codex / Gemini / Antigravity (same SSOT).
    try {
      const compact = buildCompactSkill()
      for (const root of compactSkillRoots()) {
        try {
          const skillDir = path.join(root, 'prjct')
          const skillPath = path.join(skillDir, 'SKILL.md')
          await fs.mkdir(skillDir, { recursive: true })
          await fs.writeFile(skillPath, compact, 'utf-8')
          result.generated.push({ name: 'prjct-compact', path: skillPath })
        } catch (error) {
          log.debug('Compact skill install skipped', {
            root,
            error: getErrorMessage(error),
          })
        }
      }
    } catch (error) {
      log.debug('Compact skill fan-out failed (non-critical)', {
        error: getErrorMessage(error),
      })
    }

    // Clean up stale prjct-* skill directories not in current definitions
    const knownNames = new Set(SKILL_DEFINITIONS.map((d) => d.name))
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('prjct-') && !knownNames.has(entry.name)) {
          await fs
            .rm(path.join(skillsDir, entry.name), { recursive: true, force: true })
            .catch(() => {})
        }
      }
    } catch {
      // Non-critical — stale cleanup failure shouldn't block sync
    }

    if (result.generated.length > 0) {
      log.info('Generated portable multi-host skills', {
        count: result.generated.length,
        skills: result.generated.map((s) => s.name),
      })
    }

    return result
  }

  /**
   * Rewrite any poisoned global Claude skill to portable baseline.
   * Safe to call from doctor / self-heal / sync.
   */
  async healPortableSkills(): Promise<{ healed: string[]; ok: boolean }> {
    const healed: string[] = []
    const claudePath = path.join(claudeSkillsRoot(), 'prjct', 'SKILL.md')
    try {
      const existing = await fs.readFile(claudePath, 'utf-8').catch(() => null)
      if (existing && skillBodyHasProjectStamp(existing)) {
        await this.generateAndInstall()
        healed.push(claudePath)
      } else if (!existing) {
        await this.generateAndInstall()
        healed.push(claudePath)
      }
    } catch {
      /* best-effort */
    }
    return { healed, ok: true }
  }

  /** Get all skill definitions (for testing) */
  getDefinitions(): SkillDefinition[] {
    return SKILL_DEFINITIONS
  }
}

export const skillGenerator = new SkillGenerator()
export { SkillGenerator, SKILL_DEFINITIONS }
