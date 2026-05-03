/**
 * `prjct team` — turn this repo into a prjct-shared project.
 *
 * What it does (v1):
 *   1. Writes `.prjct/team.json` with `{required, minVersion}`. Tracked
 *      in git so teammates pick up the same expectations.
 *   2. Ensures `.claude/CLAUDE.md` (per-project) has a "prjct context"
 *      section pointing at `prjct sync`. If the file exists, the section
 *      is upserted between markers; otherwise the file is created.
 *   3. Stages both files for the next commit. Does NOT commit — the
 *      user controls when to ship the change.
 *
 * What it deliberately does NOT do (v1):
 *   - Install a pre-commit hook in the repo. Doing that requires a
 *     framework choice (husky, lefthook, simple-git-hooks) and is too
 *     opinionated for a first cut. The `required` flag is documentary
 *     today; an enforcement layer can read it later.
 *   - Touch `.gitignore` or any other repo config. Surface area must
 *     stay small.
 *
 * Anti-harness contract (mem_899): no automatic git commits, no
 * background pushes, no LLM-mediated decisions. A user-invoked command
 * with deterministic file writes only.
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import { mdOutput, mdSection } from '../utils/md-formatter'
import out from '../utils/output'
import { VERSION } from '../utils/version'
import { PrjctCommandsBase } from './base'

const execP = promisify(exec)

const CLAUDE_MD_START = '<!-- prjct-team:start - DO NOT REMOVE THIS MARKER -->'
const CLAUDE_MD_END = '<!-- prjct-team:end - DO NOT REMOVE THIS MARKER -->'

interface TeamOptions {
  md?: boolean
  required?: boolean
  minVersion?: string
  /** Install .githooks/pre-commit + set core.hooksPath. Default: false. */
  enforce?: boolean
}

interface TeamConfig {
  required: boolean
  minVersion: string
  enrolledAt: string
}

export class TeamCommands extends PrjctCommandsBase {
  async team(
    _input: string | null = null,
    projectPath: string = process.cwd(),
    options: TeamOptions = {}
  ): Promise<CommandResult> {
    try {
      const teamConfig: TeamConfig = {
        required: options.required === true,
        minVersion: options.minVersion ?? VERSION ?? '0.0.0',
        enrolledAt: new Date().toISOString(),
      }

      const teamPath = path.join(projectPath, '.prjct', 'team.json')
      const claudeMdPath = path.join(projectPath, '.claude', 'CLAUDE.md')

      // 1. Write .prjct/team.json
      await fs.mkdir(path.dirname(teamPath), { recursive: true })
      await fs.writeFile(teamPath, `${JSON.stringify(teamConfig, null, 2)}\n`, 'utf-8')

      // 2. Upsert .claude/CLAUDE.md (per-project)
      await fs.mkdir(path.dirname(claudeMdPath), { recursive: true })
      const block = teamClaudeMdBlock(teamConfig)
      let existing = ''
      try {
        existing = await fs.readFile(claudeMdPath, 'utf-8')
      } catch {
        // file doesn't exist yet — create with just the team block
      }
      const next = upsertBetweenMarkers(existing, block, CLAUDE_MD_START, CLAUDE_MD_END)
      await fs.writeFile(claudeMdPath, next, 'utf-8')

      // 3. Stage both files. Don't fail the command if git isn't
      // present or the user is outside a repo — print a hint instead.
      let staged = false
      const stagedPaths = [teamPath, claudeMdPath]
      try {
        await execP('git rev-parse --show-toplevel', { cwd: projectPath })

        // 3a. Optional: install pre-commit hook that blocks commits
        // when team.json says required:true and prjct isn't on PATH.
        // Lives at .githooks/pre-commit (committed) and we point
        // core.hooksPath at it for THIS clone. Teammates run the same
        // command to wire their own clone.
        let hookPath: string | null = null
        if (options.enforce === true) {
          hookPath = path.join(projectPath, '.githooks', 'pre-commit')
          await fs.mkdir(path.dirname(hookPath), { recursive: true })
          await fs.writeFile(hookPath, PRE_COMMIT_HOOK_BODY, 'utf-8')
          await fs.chmod(hookPath, 0o755)
          await execP('git config core.hooksPath .githooks', { cwd: projectPath })
          stagedPaths.push(hookPath)
        }

        await execP(`git add ${stagedPaths.map((p) => JSON.stringify(p)).join(' ')}`, {
          cwd: projectPath,
        })
        staged = true

        if (hookPath) {
          // The git config setting is local to this clone — print a
          // note so the user understands teammates need the same step.
        }
      } catch {
        // not in a git repo, or git missing — fall through
      }

      const enforceLabel = options.enforce ? ' + pre-commit enforce' : ''
      const summary = `${teamConfig.required ? '✓ team mode (required)' : '✓ team mode (optional)'}${enforceLabel} — minVersion ${teamConfig.minVersion}`
      const stagedHint = staged
        ? `Staged: ${stagedPaths.map((p) => p.replace(`${projectPath}/`, '')).join(', ')}`
        : 'Files written but not staged (no git repo or git missing).'
      const nextSteps = [
        '1. Review the diff: `git diff --staged`',
        '2. Commit: `git commit -m "chore: enroll repo in prjct team mode"`',
        '3. Push: `git push`',
        '4. Teammates run `curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash` (or `npm install -g prjct-cli@latest`).',
        ...(options.enforce
          ? [
              '5. **Each teammate** runs `git config core.hooksPath .githooks` once (or `prjct team --enforce` to do it automatically).',
            ]
          : []),
      ].join('\n')

      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Team mode enrolled', summary),
            mdSection('Files', stagedHint),
            mdSection('Next', nextSteps)
          )
        )
      } else {
        out.done(summary)
        console.log(stagedHint)
        console.log('\nNext steps:')
        console.log(nextSteps)
      }

      return {
        success: true,
        teamConfig,
        staged,
        teamPath,
        claudeMdPath,
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }
}

/**
 * Pre-commit hook body. Pure POSIX sh so it runs everywhere git
 * runs. Reads .prjct/team.json — if `required:true` and `prjct` is
 * not on PATH, blocks the commit with an install instruction.
 *
 * Idempotent: if .prjct/team.json doesn't exist or is malformed, the
 * hook exits 0 (silent no-op). If `required:false`, also no-op.
 */
const PRE_COMMIT_HOOK_BODY = `#!/usr/bin/env sh
# prjct team enforce — blocks commits when team.json says required:true
# and the contributor doesn't have prjct installed locally.
# Generated by 'prjct team --enforce'. Safe to delete; safe to re-run.
set -e

TEAM_FILE=".prjct/team.json"
[ -f "$TEAM_FILE" ] || exit 0

# Cheap JSON parse — match "required": true with optional whitespace
if ! grep -qE '"required"[[:space:]]*:[[:space:]]*true' "$TEAM_FILE"; then
  exit 0
fi

if ! command -v prjct >/dev/null 2>&1; then
  printf '\\n\\033[1;31m✗ prjct is required for this repo (.prjct/team.json: required=true)\\033[0m\\n' >&2
  printf '  Install once:\\n' >&2
  printf '  \\033[36mcurl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash\\033[0m\\n' >&2
  printf '  Or: npm install -g prjct-cli@latest\\n' >&2
  printf '  (Bypass with --no-verify if you must, but the team agreed otherwise.)\\n\\n' >&2
  exit 1
fi

exit 0
`

function teamClaudeMdBlock(cfg: TeamConfig): string {
  return [
    CLAUDE_MD_START,
    '# prjct (team mode)',
    '',
    `This repo is enrolled in prjct team mode (required: ${cfg.required}, minVersion: ${cfg.minVersion}, enrolled: ${cfg.enrolledAt}).`,
    '',
    'When working in this repo:',
    '- prjct stores project memory (decisions, learnings, gotchas, patterns) per project.',
    '- The vault lives at `~/Documents/prjct/<slug>/_generated/`.',
    '- Always lookup the vault before re-reading source for project context.',
    '- Capture substantive analysis back via `prjct remember <type> "..."`.',
    '',
    "Don't have prjct? Install once: `curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash`",
    `${cfg.required ? 'This repo *requires* prjct — please install before contributing.' : ''}`,
    CLAUDE_MD_END,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

function upsertBetweenMarkers(
  existing: string,
  block: string,
  startMarker: string,
  endMarker: string
): string {
  if (!existing.trim()) return `${block}\n`
  const startIdx = existing.indexOf(startMarker)
  const endIdx = existing.indexOf(endMarker)
  if (startIdx >= 0 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + endMarker.length)
    return `${`${before}${block}${after}`.replace(/\n{3,}/g, '\n\n').trim()}\n`
  }
  // No marker — append block at the end with a separator.
  const trimmed = existing.replace(/\s+$/, '')
  return `${trimmed}\n\n${block}\n`
}
