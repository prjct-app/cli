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
      'STEP 1 (done): MCP config written to mcp.json.',
      'STEP 2: Open a NEW terminal and run: npx -y mcp-remote https://mcp.atlassian.com/v1/mcp',
      'STEP 2: A browser will open for OAuth — complete the authorization.',
      'STEP 3: Close and reopen Claude Code. Jira MCP tools will be ready.',
    ],
    authCommand: 'npx -y mcp-remote https://mcp.atlassian.com/v1/mcp',
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

async function runMcpOperation(
  name: string,
  opArgs: string[],
  extra?: { hint?: string; jql?: string; scope?: string }
): Promise<void> {
  const configPath = getClaudeMcpConfigPath()
  const configured = await hasMcpServer('jira', configPath)

  if (!configured) {
    error('Jira MCP is not configured. Run `prjct jira setup` first.')
  }

  const result: Record<string, unknown> = {
    success: true,
    provider: 'jira',
    mode: 'mcp',
    delegated: true,
    command: name,
    args: opArgs,
    hint:
      extra?.hint ?? 'Run this operation using Jira MCP tools in your current AI client session.',
    nextSteps: [
      'Open your MCP-enabled AI client/session.',
      `Execute the Jira MCP operation for "${name}".`,
    ],
  }

  if (extra?.jql) result.jql = extra.jql
  if (extra?.scope) result.scope = extra.scope

  output(result)
}

async function sprintOperation(opArgs: string[]): Promise<void> {
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
    command: 'sprint',
    scope: 'active_sprint',
    args: opArgs,
    jql: 'sprint = currentSprint() AND assignee = currentUser() ORDER BY priority DESC',
    hint: 'Fetch your issues in the active sprint via Jira MCP tools.',
    nextSteps: [
      'Use the Jira MCP search tool with the JQL above to list your active sprint issues.',
      'Issues returned include sprint metadata (sprint name, start/end dates).',
    ],
  })
}

async function backlogOperation(opArgs: string[]): Promise<void> {
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
    command: 'backlog',
    scope: 'backlog',
    args: opArgs,
    jql: 'sprint is EMPTY AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC',
    hint: 'Fetch your backlog issues (not in any sprint) via Jira MCP tools.',
    nextSteps: [
      'Use the Jira MCP search tool with the JQL above to list your backlog issues.',
      'Backlog issues have no sprint assigned — differentiate from sprint issues by the sprint field being empty.',
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
            sprint: 'List your issues in the active sprint (MCP)',
            backlog: 'List your backlog issues not in any sprint (MCP)',
            sync: 'Delegate issue sync via MCP tools',
            list: 'Delegate issue listing via MCP tools',
            get: 'Delegate issue retrieval via MCP tools',
            create: 'Delegate issue creation via MCP tools',
            update: 'Delegate issue update via MCP tools',
            start: 'Delegate status transition to in-progress via MCP tools',
            done: 'Delegate status transition to done via MCP tools',
            transition: 'Delegate workflow transition via MCP tools',
          },
          note: 'Jira is MCP-only. sprint/backlog provide JQL for your AI client MCP session.',
        })
        break

      case 'sprint':
        await sprintOperation(commandArgs)
        break

      case 'backlog':
        await backlogOperation(commandArgs)
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
