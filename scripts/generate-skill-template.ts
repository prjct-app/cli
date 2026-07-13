#!/usr/bin/env bun
/**
 * Generate templates/skills/prjct/SKILL.md (baseline, no-project ctx).
 *
 * SSOT for the skill body lives in core/services/skill-generator/. This
 * script runs at build time and emits the static template that bin/prjct
 * self-heals into ~/.claude/skills/prjct/ on every CLI invocation.
 *
 * The generated file is .gitignored — `npm run build` produces it, and
 * `prepublishOnly` ensures it ships in the npm tarball.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  buildAntigravityConfig,
  buildAntigravitySkill,
  buildCodexSkill,
  buildCursorRule,
  buildGeminiConfig,
  buildWindsurfRule,
} from '../core/services/skill-generator/editor-surfaces'
import {
  buildPrjctSkill,
  emptySkillContext,
} from '../core/services/skill-generator/prjct-skill-body'

const ROOT = path.resolve(__dirname, '..')

function emit(relParts: string[], content: string): void {
  const out = path.join(ROOT, 'templates', ...relParts)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, content)
  console.log(`  → templates/${relParts.join('/')} (${Buffer.byteLength(content, 'utf-8')} bytes)`)
}

// Canonical Claude skill — always portable L0 (no project stamp; multi-LLM safe).
emit(['skills', 'prjct', 'SKILL.md'], buildPrjctSkill(emptySkillContext()))

// Compact non-Claude surfaces — generated from the same contract SSOT so they
// can never drift from the canonical skill (editor-surfaces.ts).
emit(['codex', 'SKILL.md'], buildCodexSkill())
emit(['antigravity', 'SKILL.md'], buildAntigravitySkill())
emit(['global', 'GEMINI.md'], buildGeminiConfig())
emit(['global', 'ANTIGRAVITY.md'], buildAntigravityConfig())

// IDE rule pointers (clean-repo: same minimal pointer as AGENTS.md/CLAUDE.md).
emit(['global', 'CURSOR.mdc'], buildCursorRule())
emit(['global', 'WINDSURF.md'], buildWindsurfRule())
