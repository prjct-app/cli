/**
 * Live Claude Code one-shot client for efficiency benches.
 *
 * Uses the user's logged-in `claude` CLI (`claude -p --output-format json`)
 * so Max/OAuth works without a separate ANTHROPIC_API_KEY. Calls run in an
 * isolated temp cwd with empty MCP to reduce ambient tool noise.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface LiveClaudeUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  /** Billable-ish proxy: input + cache_creation + output (excludes cheap cache reads). */
  billableTokens: number
}

export interface LiveClaudeResult {
  ok: boolean
  text: string
  costUsd: number
  turns: number
  durationMs: number
  model: string
  usage: LiveClaudeUsage
  raw: unknown
  error?: string
}

export interface LiveClaudeCallOptions {
  prompt: string
  systemPrompt: string
  model?: string
  timeoutMs?: number
  /** Working directory; defaults to an isolated temp project. */
  cwd?: string
  /** Optional JSON Schema for structured output (--json-schema). */
  jsonSchema?: Record<string, unknown>
}

function emptyUsage(): LiveClaudeUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    billableTokens: 0,
  }
}

function parseUsage(raw: unknown): LiveClaudeUsage {
  if (!raw || typeof raw !== 'object') return emptyUsage()
  const u = raw as Record<string, unknown>
  const input = num(u.input_tokens)
  const output = num(u.output_tokens)
  const cacheRead = num(u.cache_read_input_tokens)
  const cacheCreate = num(u.cache_creation_input_tokens)
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreate,
    billableTokens: input + cacheCreate + output,
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Ensure `claude` is available and logged in. */
export async function assertClaudeLiveReady(): Promise<{ email?: string; model?: string }> {
  try {
    const { stdout } = await execFileAsync('claude', ['auth', 'status'], {
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
      env: process.env,
    })
    const j = JSON.parse(stdout) as { loggedIn?: boolean; email?: string }
    if (!j.loggedIn) {
      throw new Error('claude is not logged in — run `claude` /login first')
    }
    return { email: j.email }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Live LLM unavailable: ${msg}`)
  }
}

/**
 * One-shot completion via Claude Code print mode.
 * Isolates MCP (empty) and disables slash commands for cleaner routing tasks.
 */
export async function callClaudeLive(opts: LiveClaudeCallOptions): Promise<LiveClaudeResult> {
  const model = opts.model ?? process.env.PRJCT_LIVE_MODEL ?? 'haiku'
  const timeoutMs = opts.timeoutMs ?? 120_000

  let cwd = opts.cwd
  let tmp: string | null = null
  if (!cwd) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-live-'))
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"prjct-live-bench","private":true}\n')
    fs.writeFileSync(path.join(tmp, 'mcp.json'), JSON.stringify({ mcpServers: {} }))
    cwd = tmp
  }
  const mcpPath = path.join(cwd, 'mcp.json')
  if (!fs.existsSync(mcpPath)) {
    fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }))
  }

  const args = [
    '-p',
    opts.prompt,
    '--model',
    model,
    '--output-format',
    'json',
    '--system-prompt',
    opts.systemPrompt,
    '--allowedTools',
    '',
    '--disable-slash-commands',
    '--mcp-config',
    mcpPath,
    '--strict-mcp-config',
    '--setting-sources',
    '',
  ]
  if (opts.jsonSchema) {
    args.push('--json-schema', JSON.stringify(opts.jsonSchema))
  }

  try {
    const { stdout, stderr } = await execFileAsync('claude', args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        // Reduce ambient agent noise when the host supports it.
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
    })
    const line = stdout.trim()
    if (!line) {
      return {
        ok: false,
        text: '',
        costUsd: 0,
        turns: 0,
        durationMs: 0,
        model,
        usage: emptyUsage(),
        raw: null,
        error: stderr || 'empty claude stdout',
      }
    }
    const raw = JSON.parse(line) as Record<string, unknown>
    const usage = parseUsage(raw.usage)
    // Structured output may land in result as object or string.
    let text = ''
    if (typeof raw.result === 'string') text = raw.result
    else if (raw.result != null) text = JSON.stringify(raw.result)
    else if (raw.structured_output != null) text = JSON.stringify(raw.structured_output)
    const isError = raw.is_error === true
    return {
      ok: !isError,
      text,
      costUsd: num(raw.total_cost_usd),
      turns: num(raw.num_turns) || 1,
      durationMs: num(raw.duration_ms),
      model:
        raw.modelUsage && typeof raw.modelUsage === 'object'
          ? (Object.keys(raw.modelUsage as object)[0] ?? model)
          : model,
      usage,
      raw,
      error: isError ? text || 'claude is_error' : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      text: '',
      costUsd: 0,
      turns: 0,
      durationMs: 0,
      model,
      usage: emptyUsage(),
      raw: null,
      error: msg,
    }
  } finally {
    if (tmp) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

/** Extract a verb token from freeform model text. */
export function extractVerb(text: string): string | null {
  const verbs = ['search', 'remember', 'ship', 'next', 'land', 'guard', 'sync', 'work'] as const
  // Prefer JSON field
  const jsonMatch = text.match(/"verb"\s*:\s*"([a-z]+)"/i)
  if (jsonMatch) {
    const v = jsonMatch[1].toLowerCase()
    if ((verbs as readonly string[]).includes(v)) return v
  }
  // Bare word on first line
  const first = text
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, '')
  if (first && (verbs as readonly string[]).includes(first)) return first
  // Any mention — last resort, prefer non-work if present
  const lower = text.toLowerCase()
  for (const v of verbs) {
    if (v === 'work') continue
    if (new RegExp(`\\b${v}\\b`).test(lower)) return v
  }
  if (/\bwork\b/.test(lower)) return 'work'
  return null
}
