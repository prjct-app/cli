import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getTemplateContent } from '../agentic/template-loader'
import { CONTEXT7_VERIFY_TTL_MS } from '../constants/timings'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { Context7Status } from '../types/services.js'
import { execFileAsync } from '../utils/exec'
import { writeJson } from '../utils/file-helper'

interface Context7TemplateConfig {
  mcpServers?: {
    context7?: {
      command?: string
      args?: string[]
      description?: string
    }
  }
}

const CONTEXT7_DEFAULT = {
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp@latest'],
}
let cachedVerify: { at: number; status: Context7Status } | null = null

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
  await execFileAsync(cfg.command || 'npx', args, { timeout: 15000 })
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

    mcpServers.context7 = getContext7Config()
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
    if (cachedVerify && Date.now() - cachedVerify.at < CONTEXT7_VERIFY_TTL_MS) {
      return cachedVerify.status
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
      cachedVerify = { at: Date.now(), status }
      return status
    } catch (error) {
      const status = {
        installed: true,
        verified: false,
        configPath,
        message: `Context7 smoke check failed: ${getErrorMessage(error)}`,
      }
      cachedVerify = { at: Date.now(), status }
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
