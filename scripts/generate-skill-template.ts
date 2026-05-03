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
  buildPrjctSkill,
  emptySkillContext,
} from '../core/services/skill-generator/prjct-skill-body'

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'templates', 'skills', 'prjct', 'SKILL.md')

const content = buildPrjctSkill(emptySkillContext())

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, content)

console.log(`  → templates/skills/prjct/SKILL.md (${content.length} bytes)`)
