#!/usr/bin/env node
/**
 * Jira CLI - MCP command gateway
 *
 * Usage: bun core/cli/jira.ts <command> [flags]
 */

import { getErrorMessage } from '../types/fs'
import {
  getClaudeMcpConfigPath,
  hasMcpServer,
  MCP_SERVER_PRESETS,
  upsertMcpServer,
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

async function runMcpOperation(name: string, opArgs: string[]): Promise<void> {
  const configPath = getClaudeMcpConfigPath()
  const configured = await hasMcpServer('jira', configPath)

  if (!configured) {
    error('Jira MCP is not configured. Run `prjct jira setup` first.')
  }

  output({
    success: true,
    provider: 'jira',
    mode: 'mcp',
    delegated: true,
    command: name,
    args: opArgs,
    hint: 'Run this operation using Jira MCP tools in your current AI client session.',
    nextSteps: [
      'Open your MCP-enabled AI client/session.',
      `Execute the Jira MCP operation for "${name}".`,
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
          usage: 'prjct jira <command>',
          commands: {
            setup: 'Configure Jira MCP server',
            status: 'Check Jira MCP configuration',
            sync: 'Delegate issue sync via MCP tools',
            list: 'Delegate issue listing via MCP tools',
            get: 'Delegate issue retrieval via MCP tools',
            create: 'Delegate issue creation via MCP tools',
            update: 'Delegate issue update via MCP tools',
            start: 'Delegate status transition to in-progress via MCP tools',
            done: 'Delegate status transition to done via MCP tools',
            transition: 'Delegate workflow transition via MCP tools',
          },
          note: 'Jira is MCP-only.',
        })
        break

      case 'sync':
      case 'start':
      case 'done':
      case 'list':
      case 'get':
      case 'create':
      case 'update':
      case 'transition':
      case 'comment':
      case 'projects':
      case 'boards':
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
