/**
 * prjct crew — install/uninstall/status the crew-mode bundle.
 *
 * Crew mode is an opinionated multi-agent setup: a leader/implementer/reviewer
 * trio in `.claude/agents/`, a project-level `CHECKPOINTS.md`, and a CLAUDE.md
 * snippet that locks the main session into leader role. Strictly opt-in.
 *
 * Inspired by https://github.com/betta-tech/ejemplo-harness-subagentes
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getTemplateContent } from '../agentic/template-loader'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { fileExists } from '../utils/file-helper'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

const SNIPPET_START = '<!-- prjct:crew:start - DO NOT REMOVE THIS MARKER -->'
const SNIPPET_END = '<!-- prjct:crew:end - DO NOT REMOVE THIS MARKER -->'

interface CrewFile {
  /** Path inside the templates/crew/ tree */
  templateKey: string
  /** Destination relative to the project root */
  destRelative: string
}

const AGENT_FILES: CrewFile[] = [
  { templateKey: 'crew/agents/leader.md', destRelative: '.claude/agents/leader.md' },
  { templateKey: 'crew/agents/implementer.md', destRelative: '.claude/agents/implementer.md' },
  { templateKey: 'crew/agents/reviewer.md', destRelative: '.claude/agents/reviewer.md' },
]

const CHECKPOINTS_FILE: CrewFile = {
  templateKey: 'crew/CHECKPOINTS.md',
  destRelative: '.prjct/CHECKPOINTS.md',
}

const CLAUDE_SNIPPET_TEMPLATE = 'crew/CLAUDE-leader-mode.md'
const CLAUDE_FILE = 'CLAUDE.md'

interface PieceStatus {
  path: string
  installed: boolean
}

interface CrewStatus {
  agents: PieceStatus[]
  checkpoints: PieceStatus
  claudeSnippet: PieceStatus
  complete: boolean
}

async function readSnippet(): Promise<string> {
  const content = getTemplateContent(CLAUDE_SNIPPET_TEMPLATE)
  if (!content) {
    throw new Error(`Missing crew template: ${CLAUDE_SNIPPET_TEMPLATE}`)
  }
  return content.trim()
}

async function readTemplate(key: string): Promise<string> {
  const content = getTemplateContent(key)
  if (!content) {
    throw new Error(`Missing crew template: ${key}`)
  }
  return content
}

async function writeFileEnsureDir(absPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, content, 'utf-8')
}

function snippetPresent(claudeContent: string): boolean {
  return claudeContent.includes(SNIPPET_START) && claudeContent.includes(SNIPPET_END)
}

function appendSnippet(claudeContent: string, snippet: string): string {
  // Idempotent: if markers exist, replace the block; otherwise append.
  if (snippetPresent(claudeContent)) {
    const startIdx = claudeContent.indexOf(SNIPPET_START)
    const endIdx = claudeContent.indexOf(SNIPPET_END) + SNIPPET_END.length
    return `${claudeContent.slice(0, startIdx)}${snippet}${claudeContent.slice(endIdx)}`
  }
  const sep = claudeContent.length > 0 && !claudeContent.endsWith('\n') ? '\n\n' : '\n'
  return `${claudeContent}${sep}${snippet}\n`
}

function stripSnippet(claudeContent: string): string {
  if (!snippetPresent(claudeContent)) return claudeContent
  const startIdx = claudeContent.indexOf(SNIPPET_START)
  const endIdx = claudeContent.indexOf(SNIPPET_END) + SNIPPET_END.length
  let result = `${claudeContent.slice(0, startIdx)}${claudeContent.slice(endIdx)}`
  // Trim leading whitespace gap left by the removal.
  result = result.replace(/\n{3,}/g, '\n\n').trimEnd()
  return result.length > 0 ? `${result}\n` : ''
}

async function readClaudeMd(projectPath: string): Promise<string | null> {
  const claudePath = path.join(projectPath, CLAUDE_FILE)
  try {
    return await fs.readFile(claudePath, 'utf-8')
  } catch {
    return null
  }
}

async function getStatus(projectPath: string): Promise<CrewStatus> {
  const agents = await Promise.all(
    AGENT_FILES.map(async (f) => ({
      path: f.destRelative,
      installed: await fileExists(path.join(projectPath, f.destRelative)),
    }))
  )

  const checkpoints: PieceStatus = {
    path: CHECKPOINTS_FILE.destRelative,
    installed: await fileExists(path.join(projectPath, CHECKPOINTS_FILE.destRelative)),
  }

  const claudeContent = await readClaudeMd(projectPath)
  const claudeSnippet: PieceStatus = {
    path: CLAUDE_FILE,
    installed: claudeContent !== null && snippetPresent(claudeContent),
  }

  const complete =
    agents.every((a) => a.installed) && checkpoints.installed && claudeSnippet.installed

  return { agents, checkpoints, claudeSnippet, complete }
}

export class CrewCommands extends PrjctCommandsBase {
  /**
   * `prjct crew install` — copy the trio + CHECKPOINTS into the project,
   * append the leader-mode snippet to CLAUDE.md (idempotent).
   */
  async install(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const written: string[] = []
      const skipped: string[] = []

      // 1. Agents
      for (const f of AGENT_FILES) {
        const dest = path.join(projectPath, f.destRelative)
        const content = await readTemplate(f.templateKey)
        const exists = await fileExists(dest)
        await writeFileEnsureDir(dest, content)
        if (exists) skipped.push(`${f.destRelative} (overwritten)`)
        else written.push(f.destRelative)
      }

      // 2. CHECKPOINTS — never overwrite if user has customised it
      const checkpointsDest = path.join(projectPath, CHECKPOINTS_FILE.destRelative)
      if (await fileExists(checkpointsDest)) {
        skipped.push(`${CHECKPOINTS_FILE.destRelative} (kept existing)`)
      } else {
        const content = await readTemplate(CHECKPOINTS_FILE.templateKey)
        await writeFileEnsureDir(checkpointsDest, content)
        written.push(CHECKPOINTS_FILE.destRelative)
      }

      // 3. CLAUDE.md snippet — append/replace marker block, idempotent
      const snippet = await readSnippet()
      const claudePath = path.join(projectPath, CLAUDE_FILE)
      const existingClaude = (await readClaudeMd(projectPath)) ?? ''
      const wasPresent = snippetPresent(existingClaude)
      const nextClaude = appendSnippet(existingClaude, snippet)
      if (nextClaude !== existingClaude) {
        await fs.writeFile(claudePath, nextClaude, 'utf-8')
        written.push(`${CLAUDE_FILE} (${wasPresent ? 'snippet refreshed' : 'snippet appended'})`)
      } else {
        skipped.push(`${CLAUDE_FILE} (snippet already current)`)
      }

      const summary = `crew installed (${written.length} written, ${skipped.length} kept)`
      const hookHint = [
        'Suggested next step — wire verification hooks into .claude/settings.json:',
        '  PostToolUse(Edit|Write) → run your test command',
        '  Stop → run `prjct check` (when available) or your project test command',
        'Use the /update-config skill or edit settings.json manually.',
      ].join('\n')

      if (options.md) {
        const lines = ['# prjct crew installed', '', `Wrote to \`${projectPath}\`.`, '', '## Files']
        for (const f of written) lines.push(`- written: \`${f}\``)
        for (const f of skipped) lines.push(`- kept: \`${f}\``)
        lines.push('', '## Next step', '', hookHint)
        console.log(lines.join('\n'))
      } else {
        out.done(summary)
        for (const f of written) out.info(`written: ${f}`)
        for (const f of skipped) out.info(`kept:    ${f}`)
        console.log('')
        console.log(hookHint)
      }

      return { success: true, written, skipped }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * `prjct crew uninstall` — remove the trio + CHECKPOINTS,
   * strip the leader-mode snippet from CLAUDE.md.
   */
  async uninstall(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const removed: string[] = []
      const missing: string[] = []

      for (const f of [...AGENT_FILES, CHECKPOINTS_FILE]) {
        const dest = path.join(projectPath, f.destRelative)
        if (await fileExists(dest)) {
          await fs.rm(dest)
          removed.push(f.destRelative)
        } else {
          missing.push(f.destRelative)
        }
      }

      // Clean up empty .claude/agents (only if it ended up empty after removal)
      const agentsDir = path.join(projectPath, '.claude/agents')
      try {
        const entries = await fs.readdir(agentsDir)
        if (entries.length === 0) await fs.rmdir(agentsDir)
      } catch {
        // Either doesn't exist or not empty — leave it.
      }

      // Strip CLAUDE.md snippet if present
      const claudePath = path.join(projectPath, CLAUDE_FILE)
      const existingClaude = await readClaudeMd(projectPath)
      if (existingClaude !== null && snippetPresent(existingClaude)) {
        const next = stripSnippet(existingClaude)
        await fs.writeFile(claudePath, next, 'utf-8')
        removed.push(`${CLAUDE_FILE} (snippet stripped)`)
      }

      const summary = `crew uninstalled (${removed.length} removed)`
      if (options.md) {
        const lines = ['# prjct crew uninstalled', '']
        for (const f of removed) lines.push(`- removed: \`${f}\``)
        for (const f of missing) lines.push(`- not present: \`${f}\``)
        console.log(lines.join('\n'))
      } else {
        out.done(summary)
        for (const f of removed) out.info(`removed: ${f}`)
      }

      return { success: true, removed, missing }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * `prjct crew status` — report which pieces of the bundle are installed.
   */
  async status(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const status = await getStatus(projectPath)
      const tag = (s: PieceStatus) => (s.installed ? 'installed' : 'missing')

      if (options.md) {
        const lines = [
          '# prjct crew status',
          '',
          `Project: \`${projectPath}\``,
          `Complete: **${status.complete ? 'yes' : 'no'}**`,
          '',
          '## Pieces',
        ]
        for (const a of status.agents) lines.push(`- ${tag(a)}: \`${a.path}\``)
        lines.push(`- ${tag(status.checkpoints)}: \`${status.checkpoints.path}\``)
        lines.push(`- ${tag(status.claudeSnippet)}: \`${status.claudeSnippet.path}\` (snippet)`)
        console.log(lines.join('\n'))
      } else {
        const label = status.complete ? 'complete' : 'partial'
        out.info(`crew: ${label}`)
        for (const a of status.agents) out.info(`  ${tag(a)}: ${a.path}`)
        out.info(`  ${tag(status.checkpoints)}: ${status.checkpoints.path}`)
        out.info(`  ${tag(status.claudeSnippet)}: ${status.claudeSnippet.path} (snippet)`)
      }

      return { success: true, complete: status.complete, status }
    } catch (error) {
      const msg = getErrorMessage(error)
      out.fail(msg)
      return { success: false, error: msg }
    }
  }
}
