#!/usr/bin/env node
/**
 * Linear CLI - MCP command gateway
 *
 * Usage: bun core/cli/linear.ts <command> [flags]
 */

import { getErrorMessage } from '../types/fs'
import {
  checkOAuthTokens,
  hasMcpServerAny,
  MCP_REMOTE_AUTH_COMMANDS,
  MCP_SERVER_PRESETS,
  upsertMcpServerAll,
} from '../utils/mcp-config'

const args = process.argv.slice(2)

const jsonIdx = args.indexOf('--json')
const jsonMode = jsonIdx !== -1
if (jsonMode) args.splice(jsonIdx, 1)

const mdIdx = args.indexOf('--md')
if (mdIdx !== -1) args.splice(mdIdx, 1)

const [command, ...commandArgs] = args

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
  const results = await upsertMcpServerAll('linear', MCP_SERVER_PRESETS.linear)
  output({
    success: true,
    provider: 'linear',
    mode: 'mcp',
    installedIn: results.map((r) => ({ provider: r.provider, path: r.path, updated: r.changed })),
    nextSteps: [
      `STEP 1 (done): MCP config written to ${results.map((r) => r.provider).join(', ')}.`,
      `STEP 2: Open a NEW terminal and run: ${MCP_REMOTE_AUTH_COMMANDS.linear}`,
      'STEP 2: A browser will open for OAuth — complete the authorization.',
      'STEP 3: Restart your AI client. Linear MCP tools will be ready.',
    ],
    authCommand: MCP_REMOTE_AUTH_COMMANDS.linear,
  })
}

async function status(): Promise<void> {
  const mcpStatus = await hasMcpServerAny('linear')
  const oauth = mcpStatus.configured ? await checkOAuthTokens('linear') : null

  output({
    provider: 'linear',
    mode: 'mcp',
    configured: mcpStatus.configured,
    oauthReady: oauth?.ready ?? false,
    providers: mcpStatus.providers,
    hint: !mcpStatus.configured
      ? 'Run `prjct linear setup` to configure Linear MCP.'
      : (oauth?.hint ?? ''),
  })
}

async function runMcpOperation(name: string, opArgs: string[]): Promise<void> {
  const { configured } = await hasMcpServerAny('linear')

  if (!configured) {
    error('Linear MCP is not configured. Run `prjct linear setup` first.')
  }

  output({
    success: true,
    provider: 'linear',
    mode: 'mcp',
    delegated: true,
    command: name,
    args: opArgs,
    hint: 'Run this operation using Linear MCP tools in your current AI client session.',
    nextSteps: [
      'Open your MCP-enabled AI client/session.',
      `Execute the Linear MCP operation for "${name}".`,
    ],
  })
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
          usage: 'prjct linear <command>',
          commands: {
            setup: 'Configure Linear MCP server',
            status: 'Check Linear MCP configuration',
            sync: 'Delegate issue sync via MCP tools',
            list: 'Delegate issue listing via MCP tools',
            get: 'Delegate issue retrieval via MCP tools',
            create: 'Delegate issue creation via MCP tools',
            update: 'Delegate issue update via MCP tools',
            start: 'Delegate status transition to in-progress via MCP tools',
            done: 'Delegate status transition to done via MCP tools',
            comment: 'Delegate comment creation via MCP tools',
          },
          note: 'Linear is MCP-only.',
        })
        break

      case 'sync':
      case 'list':
      case 'get':
      case 'create':
      case 'update':
      case 'start':
      case 'done':
      case 'comment':
      case 'teams':
      case 'projects':
        await runMcpOperation(command, commandArgs)
        break

      default:
        error(`Unknown command: ${command}. Use --help to see available commands.`)
    }
  } catch (err) {
    error(getErrorMessage(err))
  }
}

main()
