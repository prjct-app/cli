/**
 * Built-in tools for the owned agent (Pi-like minimal set).
 * All FS ops are root-scoped via resolveSafePath.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'
import { ensureParentDir, fileExists, PathDeniedError, resolveSafePath } from './paths'
import type { AgentTool, AgentToolResult } from './types'

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_READ = 256 * 1024
const DEFAULT_BASH_MS = 30_000
const DEFAULT_BASH_OUT = 64 * 1024

function ok(content: string): AgentToolResult {
  return { ok: true, content }
}
function fail(content: string): AgentToolResult {
  return { ok: false, content }
}

function asString(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`${name} must be a non-empty string`)
  return v
}

export const readTool: AgentTool = {
  name: 'read',
  description: 'Read a UTF-8 text file under the project root. Path is relative to project root.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from project root' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    try {
      const rel = asString(args.path, 'path')
      const abs = resolveSafePath(ctx.root, rel)
      if (!fileExists(abs)) return fail(`File not found: ${rel}`)
      const st = fs.statSync(abs)
      if (!st.isFile()) return fail(`Not a file: ${rel}`)
      const max = ctx.maxReadBytes ?? DEFAULT_MAX_READ
      if (st.size > max) return fail(`File too large (${st.size} > ${max} bytes): ${rel}`)
      const text = fs.readFileSync(abs, 'utf-8')
      return ok(text)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export const writeTool: AgentTool = {
  name: 'write',
  description:
    'Create or overwrite a UTF-8 text file under the project root. Creates parent dirs. Prefer edit for small changes.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from project root' },
      content: { type: 'string', description: 'Full file contents' },
    },
    required: ['path', 'content'],
  },
  async execute(args, ctx) {
    try {
      const rel = asString(args.path, 'path')
      const content = typeof args.content === 'string' ? args.content : String(args.content ?? '')
      const abs = resolveSafePath(ctx.root, rel)
      ensureParentDir(abs)
      fs.writeFileSync(abs, content, 'utf-8')
      return ok(`Wrote ${rel} (${content.length} chars)`)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

export const editTool: AgentTool = {
  name: 'edit',
  description:
    'Replace an exact substring in a file once. Fails if old_string is missing or not unique.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(args, ctx) {
    try {
      const rel = asString(args.path, 'path')
      const oldStr = asString(args.old_string, 'old_string')
      const newStr =
        typeof args.new_string === 'string' ? args.new_string : String(args.new_string ?? '')
      const abs = resolveSafePath(ctx.root, rel)
      if (!fileExists(abs)) return fail(`File not found: ${rel}`)
      const text = fs.readFileSync(abs, 'utf-8')
      const count = text.split(oldStr).length - 1
      if (count === 0) return fail(`old_string not found in ${rel}`)
      if (count > 1) return fail(`old_string not unique in ${rel} (${count} matches)`)
      fs.writeFileSync(abs, text.replace(oldStr, newStr), 'utf-8')
      return ok(`Edited ${rel}`)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  },
}

/** Deny obviously destructive / networky shell patterns (defense in depth). */
const BASH_DENY =
  /\b(?:rm\s+-rf\s+\/|mkfs|dd\s+if=|curl\s+|wget\s+|nc\s+|ncat\s+|ssh\s+|scp\s+|sudo\s+|chmod\s+777)\b/i

export const bashTool: AgentTool = {
  name: 'bash',
  description:
    'Run a short shell command in the project root (cwd fixed). Prefer read/edit/write for file changes. No network/sudo.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run' },
    },
    required: ['command'],
  },
  async execute(args, ctx) {
    try {
      const command = asString(args.command, 'command')
      if (BASH_DENY.test(command)) {
        return fail('Command blocked by safety policy')
      }
      const timeout = ctx.maxBashMs ?? DEFAULT_BASH_MS
      const maxOut = ctx.maxBashOutputBytes ?? DEFAULT_BASH_OUT
      const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
        cwd: ctx.root,
        timeout,
        maxBuffer: maxOut,
        env: {
          ...process.env,
          // Avoid leaking host agent config into child accidentally beyond PATH
          CI: process.env.CI,
        },
      })
      const out = [stdout, stderr].filter(Boolean).join('\n').slice(0, maxOut)
      return ok(out || '(no output)')
    } catch (e) {
      const err = e as {
        killed?: boolean
        code?: number
        stdout?: string
        stderr?: string
        message?: string
      }
      if (err.killed) return fail(`Command timed out`)
      const bits = [err.stderr, err.stdout, err.message]
        .filter(Boolean)
        .join('\n')
        .slice(0, DEFAULT_BASH_OUT)
      return fail(bits || 'Command failed')
    }
  },
}

export function defaultTools(): AgentTool[] {
  return [readTool, writeTool, editTool, bashTool]
}

export function getToolMap(tools: AgentTool[]): Map<string, AgentTool> {
  return new Map(tools.map((t) => [t.name, t]))
}

export { PathDeniedError }
