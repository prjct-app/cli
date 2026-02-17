#!/usr/bin/env node
/**
 * Jira CLI - MCP setup/status helper
 *
 * Usage: bun core/cli/jira.ts <command> [flags]
 *
 * Commands:
 *   setup    - Configure Jira MCP server in ~/.claude/mcp.json
 *   status   - Check Jira MCP configuration status
 */

import { getErrorMessage } from '../types/fs'
import {
  getClaudeMcpConfigPath,
  hasMcpServer,
  MCP_SERVER_PRESETS,
  upsertMcpServer,
} from '../utils/mcp-config'

const args = process.argv.slice(2)

// Keep compatibility with existing wrapper that injects --project.
const projectIdx = args.indexOf('--project')
if (projectIdx !== -1) {
  args.splice(projectIdx, 2)
}

const jsonIdx = args.indexOf('--json')
const jsonMode = jsonIdx !== -1
if (jsonMode) args.splice(jsonIdx, 1)

const [command] = args

function output(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (typeof data === 'string') {
    console.log(data)
    return
  }

  console.log(JSON.stringify(data, null, 2))
}

function error(message: string, code = 1): never {
  if (jsonMode) {
    console.error(JSON.stringify({ error: message }))
  } else {
    console.error(`Error: ${message}`)
  }
  process.exit(code)
}

async function setup(): Promise<void> {
  const result = await upsertMcpServer('jira', MCP_SERVER_PRESETS.jira)
  output({
    success: true,
    provider: 'jira',
    mode: 'mcp',
    path: result.path,
    updated: result.changed,
    nextSteps: [
      'Open your MCP-enabled AI client.',
      'Run any Jira operation to complete OAuth authorization when prompted.',
    ],
  })
}

async function status(): Promise<void> {
  const configPath = getClaudeMcpConfigPath()
  const configured = await hasMcpServer('jira', configPath)

  output({
    provider: 'jira',
    mode: 'mcp',
    configured,
    path: configPath,
    hint: configured
      ? 'Jira MCP is configured. OAuth happens inside your AI client.'
      : 'Run `prjct jira setup` to configure Jira MCP.',
  })
}

function legacyCommandError(name: string): never {
  error(
    `Command "${name}" was removed from CLI direct mode. Use Jira MCP tools from your AI client after running "prjct jira setup".`
  )
}

async function main(): Promise<void> {
  try {
    switch (command) {
      case 'setup':
        await setup()
        break

      case 'status':
        await status()
        break

      case 'help':
      case '--help':
      case '-h':
      case undefined:
        output({
          usage: 'prjct jira <command>',
          commands: {
            setup: 'Configure Jira MCP server',
            status: 'Check Jira MCP configuration',
          },
          note: 'Direct REST/API-token operations were removed. Jira is MCP-only.',
        })
        break

      case 'sync':
      case 'start':
      case 'done':
      case 'list':
      case 'get':
      case 'create':
      case 'update':
        legacyCommandError(command)
        break

      default:
        error(`Unknown command: ${command}. Use --help to see available commands.`)
    }
  } catch (err) {
    error(getErrorMessage(err))
  }
}

main()
