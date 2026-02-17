#!/usr/bin/env node

/**
 * Jira CLI - MCP command gateway
 *
 * Usage: bun core/cli/jira.ts <command> [flags]
 */

import { context7Service } from '../services/context7-service'
import { systemDb } from '../storage/system-database'
import { getErrorMessage } from '../types/fs'
import {
  checkOAuthTokens,
  cleanCorruptedTokens,
  getMcpRemoteVersion,
  hasMcpServerAny,
  MCP_REMOTE_AUTH_COMMANDS,
  MCP_SERVER_PRESETS,
  migrateOAuthTokens,
  scanTokenDirectories,
  upsertMcpServerAll,
  validateMcpConfig,
} from '../utils/mcp-config'
import { mdCallout, mdCodeBlock, mdList, mdOutput, mdSection, mdTable } from '../utils/md-formatter'

const args = process.argv.slice(2)

const jsonIdx = args.indexOf('--json')
const jsonMode = jsonIdx !== -1
if (jsonMode) args.splice(jsonIdx, 1)

const mdIdx = args.indexOf('--md')
const mdMode = mdIdx !== -1
if (mdMode) args.splice(mdIdx, 1)

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
  const version = getMcpRemoteVersion()
  const tokenDir = require('node:path').join(
    require('node:os').homedir(),
    '.mcp-auth',
    `mcp-remote-${version}`
  )

  // 1. Validate existing mcp.json entry — auto-fix if corrupted
  const configResult = await validateMcpConfig('jira')

  // 2. Clean corrupted tokens (if any exist but are invalid)
  const cleaned = await cleanCorruptedTokens(tokenDir)

  // 3. Write/update MCP config
  const results = await upsertMcpServerAll('jira', MCP_SERVER_PRESETS.jira)

  // 4. Try migration from legacy tokens
  const migration = await migrateOAuthTokens()

  // 5. Final health check
  const oauth = await checkOAuthTokens('jira')

  // 6. Update health status in system DB
  systemDb.setMcpHealth('jira', {
    status: oauth.ready ? 'healthy' : 'unhealthy',
    tokenVersion: version,
    configValid: true,
    oauthValid: oauth.ready,
    lastError: oauth.ready ? null : oauth.hint,
  })

  if (mdMode) {
    const sections: string[] = []

    sections.push('## Jira MCP Setup')

    // Config status
    if (configResult.autoFixed) {
      sections.push(mdCallout('warn', 'MCP config was outdated and has been auto-fixed.'))
    }

    if (cleaned) {
      sections.push(mdCallout('warn', 'Corrupted token files were cleaned up.'))
    }

    // Install results
    const providerRows = results.map((r) => [
      r.provider,
      r.path,
      r.changed ? 'updated' : 'unchanged',
    ])
    sections.push(mdSection('MCP Config', mdTable(['Provider', 'Path', 'Status'], providerRows)))

    if (migration.migrated) {
      sections.push(
        mdCallout(
          'success',
          `Tokens migrated from ${require('node:path').basename(migration.from!)}.`
        )
      )
    }

    // Next steps based on actual state
    if (oauth.ready) {
      sections.push(mdCallout('success', 'Jira MCP is ready. Restart your AI client to activate.'))
    } else {
      sections.push(mdCallout('info', 'OAuth required — complete the steps below.'))
      sections.push(
        mdSection(
          'Next Steps',
          mdList(
            [
              `Open a NEW terminal and run:\n${mdCodeBlock(MCP_REMOTE_AUTH_COMMANDS.jira, 'bash')}`,
              'Complete OAuth authorization in the browser.',
              'Run `prjct jira verify --md` to confirm tokens were saved.',
              'Restart your AI client. Jira MCP tools will be ready.',
            ],
            true
          )
        )
      )
    }

    console.log(mdOutput(...sections))
    return
  }

  output({
    success: true,
    provider: 'jira',
    mode: 'mcp',
    configAutoFixed: configResult.autoFixed,
    tokensCleaned: cleaned,
    tokensMigrated: migration.migrated,
    oauthReady: oauth.ready,
    installedIn: results.map((r) => ({ provider: r.provider, path: r.path, updated: r.changed })),
    nextSteps: oauth.ready
      ? ['Restart your AI client — Jira MCP is ready.']
      : [
          `STEP 1 (done): MCP config written to ${results.map((r) => r.provider).join(', ')}.`,
          `STEP 2: Open a NEW terminal and run: ${MCP_REMOTE_AUTH_COMMANDS.jira}`,
          'STEP 2: A browser will open for OAuth — complete the authorization.',
          'STEP 3: Run `prjct jira verify` to confirm tokens were saved.',
          'STEP 4: Restart your AI client. Jira MCP tools will be ready.',
        ],
    authCommand: MCP_REMOTE_AUTH_COMMANDS.jira,
  })
}

async function verify(): Promise<void> {
  const scan = await scanTokenDirectories()
  const configResult = await validateMcpConfig('jira')
  const mcpStatus = await hasMcpServerAny('jira')

  // Auto-migrate if valid tokens in wrong version dir
  const migration = await migrateOAuthTokens()

  // Auto-clean corrupted tokens in the current version dir
  const version = getMcpRemoteVersion()
  const currentDir = require('node:path').join(
    require('node:os').homedir(),
    '.mcp-auth',
    `mcp-remote-${version}`
  )
  let cleaned = false
  const currentScan = scan.dirs.find((d) => d.isCurrent)
  if (currentScan && !currentScan.valid && currentScan.files.length > 0 && !migration.migrated) {
    cleaned = await cleanCorruptedTokens(currentDir)
  }

  // Final health check
  const oauth = await checkOAuthTokens('jira')

  // Context7 health check
  let context7Status: { installed: boolean; verified: boolean; message?: string } = {
    installed: false,
    verified: false,
  }
  try {
    context7Status = await context7Service.verify()
  } catch (err) {
    context7Status = {
      installed: false,
      verified: false,
      message: `check failed: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  if (mdMode) {
    const sections: string[] = []
    sections.push('## Jira MCP Verification')

    // MCP config status
    if (!mcpStatus.configured) {
      sections.push(mdCallout('error', 'Jira MCP not configured. Run `prjct jira setup` first.'))
    } else if (configResult.autoFixed) {
      sections.push(mdCallout('warn', 'MCP config was outdated and has been auto-fixed.'))
    }

    // Token directory scan
    if (scan.dirs.length === 0) {
      sections.push(
        mdCallout(
          'error',
          'No token directories found in `~/.mcp-auth/`. OAuth has not been completed.'
        )
      )
    } else {
      const rows = scan.dirs.map((d) => [
        `mcp-remote-${d.version}`,
        d.isCurrent ? 'yes' : 'no',
        d.valid ? 'valid' : 'invalid',
        d.tokenFile ?? '—',
        d.reason ?? (d.valid ? 'OK' : '—'),
      ])
      sections.push(
        mdSection(
          'Token Directories',
          mdTable(['Directory', 'Current', 'Status', 'Token File', 'Details'], rows)
        )
      )
    }

    // Actions taken
    if (migration.migrated) {
      sections.push(
        mdCallout(
          'success',
          `Tokens auto-migrated from ${require('node:path').basename(migration.from!)}.`
        )
      )
    }
    if (cleaned) {
      sections.push(mdCallout('warn', 'Corrupted token files were cleaned up.'))
    }

    // Context7 status
    if (!context7Status.installed) {
      sections.push(mdCallout('warn', 'Context7 MCP not configured. Run `prjct sync` to install.'))
    } else if (!context7Status.verified) {
      sections.push(
        mdCallout(
          'warn',
          `Context7 MCP configured but not working: ${context7Status.message ?? 'smoke check failed'}. Run \`prjct sync\` to repair.`
        )
      )
    } else {
      sections.push(mdCallout('success', 'Context7 MCP is healthy.'))
    }

    // Verdict
    if (oauth.ready) {
      sections.push(
        mdCallout(
          'success',
          'READY — Jira OAuth tokens verified. Restart your AI client to activate.'
        )
      )
    } else {
      sections.push(mdCallout('error', `NOT READY — ${oauth.hint}`))
    }

    console.log(mdOutput(...sections))
    return
  }

  output({
    provider: 'jira',
    command: 'verify',
    expectedVersion: scan.expectedVersion,
    dirs: scan.dirs.map((d) => ({
      version: d.version,
      isCurrent: d.isCurrent,
      valid: d.valid,
      tokenFile: d.tokenFile,
      reason: d.reason,
      hasAccessToken: d.hasAccessToken,
      hasRefreshToken: d.hasRefreshToken,
    })),
    configValid: configResult.valid,
    configAutoFixed: configResult.autoFixed,
    migrated: migration.migrated,
    migratedFrom: migration.from,
    cleaned,
    ready: oauth.ready,
    hint: oauth.hint,
    context7: {
      installed: context7Status.installed,
      verified: context7Status.verified,
      message: context7Status.message,
    },
  })
}

async function status(): Promise<void> {
  const mcpStatus = await hasMcpServerAny('jira')
  const configValid = await validateMcpConfig('jira')
  const oauth = mcpStatus.configured ? await checkOAuthTokens('jira') : null

  if (mdMode) {
    const sections: string[] = []
    sections.push('## Jira MCP Status')

    // Status table
    const rows: string[][] = [
      ['MCP configured', mcpStatus.configured ? 'yes' : 'no'],
      ['Config valid', configValid.valid ? 'yes' : `no (${configValid.issues.join(', ')})`],
    ]

    if (oauth) {
      rows.push(['OAuth tokens', oauth.ready ? 'valid' : 'missing/invalid'])
      if (oauth.migrated) rows.push(['Tokens migrated', 'yes'])
      if (oauth.cleaned) rows.push(['Corrupted cleaned', 'yes'])
    }

    const providers = mcpStatus.providers.map((p) => [
      p.provider,
      p.configured ? 'yes' : 'no',
      p.path,
    ])
    sections.push(mdTable(['Check', 'Result'], rows))
    sections.push(mdSection('Providers', mdTable(['Provider', 'Configured', 'Path'], providers)))

    // Actionable next step
    if (!mcpStatus.configured) {
      sections.push(
        mdCallout('error', 'Jira MCP not configured. Run `prjct jira setup` to configure.')
      )
    } else if (!oauth?.ready) {
      sections.push(mdCallout('warn', oauth?.hint ?? 'OAuth tokens not found.'))
    } else {
      sections.push(
        mdCallout(
          'success',
          'Jira MCP is healthy. Restart your AI client if tools are not visible.'
        )
      )
    }

    if (configValid.autoFixed) {
      sections.push(mdCallout('info', 'MCP config was auto-fixed during this check.'))
    }

    console.log(mdOutput(...sections))
    return
  }

  output({
    provider: 'jira',
    mode: 'mcp',
    configured: mcpStatus.configured,
    configValid: configValid.valid,
    configAutoFixed: configValid.autoFixed,
    oauthReady: oauth?.ready ?? false,
    oauthValidated: oauth?.validated ?? false,
    oauthMigrated: oauth?.migrated ?? false,
    oauthCleaned: oauth?.cleaned ?? false,
    providers: mcpStatus.providers,
    hint: !mcpStatus.configured
      ? 'Run `prjct jira setup` to configure Jira MCP.'
      : (oauth?.hint ?? ''),
  })
}

async function runMcpOperation(
  name: string,
  opArgs: string[],
  extra?: { hint?: string; jql?: string; scope?: string }
): Promise<void> {
  const { configured } = await hasMcpServerAny('jira')

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
  const { configured } = await hasMcpServerAny('jira')

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
  const { configured } = await hasMcpServerAny('jira')

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

      case 'verify':
        await verify()
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
            verify: 'Verify OAuth tokens after completing authorization',
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
