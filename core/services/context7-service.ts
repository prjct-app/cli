import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent } from '../agentic/template-loader'
import { CONTEXT7_VERIFY_TTL_MS } from '../constants/timings'
import { resolveCliHome } from '../infrastructure/cli-home'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { Context7Status } from '../types/services.js'
import { execFileAsync } from '../utils/exec'
import { writeJson } from '../utils/file-helper'
import { MCP_SERVER_PRESETS } from '../utils/mcp-config'

// Persistent verify cache lives at <cli-home>/state/context7-verify.json so
// the 5-min TTL survives across CLI invocations. Without this, every fresh
// `prjct sync` reruns `npx @upstash/context7-mcp --help` (~1.1s warm).
// Exported so session-cleanup's rotation targets the SAME file instead of
// rebuilding the path (they had already drifted on env handling).
export function getVerifyCachePath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.join(os.tmpdir(), 'prjct-context7-test', 'verify-cache.json')
  }
  return path.join(resolveCliHome(), 'state', 'context7-verify.json')
}

async function readPersistedVerify(): Promise<{ at: number; status: Context7Status } | null> {
  try {
    const raw = await fs.readFile(getVerifyCachePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { at: number; status: Context7Status }
    if (typeof parsed?.at === 'number' && parsed.status) return parsed
  } catch {
    // missing / corrupt — fall through to fresh verify
  }
  return null
}

async function writePersistedVerify(at: number, status: Context7Status): Promise<void> {
  const file = getVerifyCachePath()
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({ at, status }), 'utf-8')
  } catch {
    // best-effort; cache miss is acceptable
  }
}

interface Context7TemplateConfig {
  mcpServers?: {
    context7?: {
      command?: string
      args?: string[]
      description?: string
    }
  }
}

const CONTEXT7_DEFAULT = MCP_SERVER_PRESETS.context7
let cachedVerify: { at: number; status: Context7Status } | null = null

const CONTEXT7_SMOKE_SYSTEM_PATH_DIRS = [
  path.dirname(process.execPath),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/opt/local/bin',
  '/usr/bin',
  '/bin',
]

const CONTEXT7_SMOKE_HOME_RELATIVE_PATH_DIRS = [
  ['.bun', 'bin'],
  ['.local', 'bin'],
  ['.volta', 'bin'],
  ['.asdf', 'shims'],
  ['.local', 'share', 'mise', 'shims'],
  ['.rtx', 'shims'],
  ['.npm-global', 'bin'],
]

function parseTemplateConfig(): Context7TemplateConfig {
  const raw = getTemplateContent('mcp-config.json')
  if (!raw) return { mcpServers: { context7: CONTEXT7_DEFAULT } }
  try {
    return JSON.parse(raw) as Context7TemplateConfig
  } catch {
    return { mcpServers: { context7: CONTEXT7_DEFAULT } }
  }
}

function getContext7Config() {
  const template = parseTemplateConfig()
  return template.mcpServers?.context7 || CONTEXT7_DEFAULT
}

async function listChildDirs(parent: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(parent, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

async function discoverNodeManagerBinDirs(homeDir: string): Promise<string[]> {
  const dirs: string[] = []
  const nvmRoot = process.env.NVM_DIR || path.join(homeDir, '.nvm')
  const nvmVersions = path.join(nvmRoot, 'versions', 'node')
  for (const version of await listChildDirs(nvmVersions)) {
    dirs.push(path.join(nvmVersions, version, 'bin'))
  }

  const fnmRoot = process.env.FNM_DIR || path.join(homeDir, '.local', 'share', 'fnm')
  const fnmVersions = path.join(fnmRoot, 'node-versions')
  for (const version of await listChildDirs(fnmVersions)) {
    dirs.push(path.join(fnmVersions, version, 'installation', 'bin'))
  }

  return dirs
}

export async function buildContext7SmokePath(
  basePath: string = process.env.PATH || '',
  homeDir: string = os.homedir()
): Promise<string> {
  const seen = new Set<string>()
  const dirs: string[] = []
  const homeDirs = CONTEXT7_SMOKE_HOME_RELATIVE_PATH_DIRS.map((segments) =>
    path.join(homeDir, ...segments)
  )
  const extraDirs = [
    ...CONTEXT7_SMOKE_SYSTEM_PATH_DIRS,
    ...homeDirs,
    ...(process.env.NVM_BIN ? [process.env.NVM_BIN] : []),
    ...(process.env.VOLTA_HOME ? [path.join(process.env.VOLTA_HOME, 'bin')] : []),
    ...(process.env.ASDF_DIR ? [path.join(process.env.ASDF_DIR, 'shims')] : []),
    ...(process.env.MISE_DATA_DIR ? [path.join(process.env.MISE_DATA_DIR, 'shims')] : []),
    ...(await discoverNodeManagerBinDirs(homeDir)),
  ]

  for (const raw of [...basePath.split(path.delimiter), ...extraDirs]) {
    const dir = raw.trim()
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    dirs.push(dir)
  }
  return dirs.join(path.delimiter)
}

async function resolveExecutable(command: string, searchPath: string): Promise<string> {
  if (path.isAbsolute(command) || command.includes(path.sep)) return command

  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : ['']

  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext)
      try {
        await fs.access(candidate, fsConstants.X_OK)
        return candidate
      } catch {
        // keep searching
      }
    }
  }

  return command
}

function getConfigPath(): string {
  if (process.env.PRJCT_CONTEXT7_CONFIG) return process.env.PRJCT_CONTEXT7_CONFIG
  if (process.env.NODE_ENV === 'test') {
    return path.join(os.tmpdir(), 'prjct-context7-test', 'mcp.json')
  }
  return path.join(os.homedir(), '.claude', 'mcp.json')
}

async function readConfig(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  } catch (error) {
    if (isNotFoundError(error)) return {}
    throw error
  }
}

async function runSmokeCheck(): Promise<void> {
  if (process.env.PRJCT_SKIP_CONTEXT7_SMOKE === '1' || process.env.NODE_ENV === 'test') return

  const cfg = getContext7Config()
  const args = [...(cfg.args || []), '--help']
  const smokePath = await buildContext7SmokePath()
  const command = await resolveExecutable(cfg.command || 'npx', smokePath)
  await execFileAsync(command, args, {
    timeout: 15000,
    env: { ...process.env, PATH: smokePath },
  })
}

class Context7Service {
  async install(): Promise<Context7Status> {
    const configPath = getConfigPath()
    const claudeDir = path.dirname(configPath)
    await fs.mkdir(claudeDir, { recursive: true })

    const config = await readConfig(configPath)
    const mcpServers = ((config.mcpServers as Record<string, unknown>) || {}) as Record<
      string,
      unknown
    >

    const desired = getContext7Config()
    const current = mcpServers.context7
    // Skip the write — and the verify-cache invalidation — when the existing
    // entry already matches. Avoids invalidating the persisted verify cache
    // on every `prjct sync`, which costs ~1.1s for the next smoke check.
    if (current && JSON.stringify(current) === JSON.stringify(desired)) {
      return {
        installed: true,
        verified: false,
        configPath,
        message: 'Context7 MCP already configured',
      }
    }

    mcpServers.context7 = desired
    config.mcpServers = mcpServers
    await writeJson(configPath, config)
    cachedVerify = null

    return {
      installed: true,
      verified: false,
      configPath,
      message: 'Context7 MCP configured',
    }
  }

  async verify(): Promise<Context7Status> {
    const now = Date.now()
    if (cachedVerify && now - cachedVerify.at < CONTEXT7_VERIFY_TTL_MS) {
      return cachedVerify.status
    }

    // Persistent cache — skip the ~1.1s `npx ... --help` smoke check when
    // a recent successful verify exists for the same configPath.
    const persisted = await readPersistedVerify()
    if (
      persisted?.status.verified &&
      now - persisted.at < CONTEXT7_VERIFY_TTL_MS &&
      persisted.status.configPath === getConfigPath()
    ) {
      cachedVerify = persisted
      return persisted.status
    }

    const configPath = getConfigPath()
    const config = await readConfig(configPath)
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {}
    const context7 = mcpServers.context7 as { command?: string; args?: string[] } | undefined

    if (!context7?.command || !Array.isArray(context7.args) || context7.args.length === 0) {
      return {
        installed: false,
        verified: false,
        configPath,
        message: 'Context7 MCP not configured in ~/.claude/mcp.json',
      }
    }

    try {
      await runSmokeCheck()
      const status = {
        installed: true,
        verified: true,
        configPath,
      }
      cachedVerify = { at: now, status }
      // Persist successful verify so subsequent CLI invocations skip the smoke check.
      await writePersistedVerify(now, status)
      return status
    } catch (error) {
      const status = {
        installed: true,
        verified: false,
        configPath,
        message: `Context7 smoke check failed: ${getErrorMessage(error)}`,
      }
      cachedVerify = { at: now, status }
      // Don't persist failures — next invocation should retry.
      return status
    }
  }

  async ensureReady(): Promise<Context7Status> {
    await this.install()
    const status = await this.verify()
    if (!status.verified) {
      const msg =
        status.message ||
        'Context7 MCP is required but not ready. Run `prjct start` to repair configuration.'
      throw new Error(msg)
    }
    return status
  }
}

const context7Service = new Context7Service()
export default context7Service
