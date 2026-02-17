#!/usr/bin/env node

/**
 * Linear CLI - MCP command gateway
 *
 * Usage: bun core/cli/linear.ts <command> [flags]
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
  const configResult = await validateMcpConfig('linear')

  // 2. Clean corrupted tokens (if any exist but are invalid)
  const cleaned = await cleanCorruptedTokens(tokenDir)

  // 3. Write/update MCP config
  const results = await upsertMcpServerAll('linear', MCP_SERVER_PRESETS.linear)

  // 4. Try migration from legacy tokens
  const migration = await migrateOAuthTokens()

  // 5. Final health check
  const oauth = await checkOAuthTokens('linear')

  // 6. Update health status in system DB
  systemDb.setMcpHealth('linear', {
    status: oauth.ready ? 'healthy' : 'unhealthy',
    tokenVersion: version,
    configValid: true,
    oauthValid: oauth.ready,
    lastError: oauth.ready ? null : oauth.hint,
  })

  if (mdMode) {
    const sections: string[] = []

    sections.push('## Linear MCP Setup')

    if (configResult.autoFixed) {
      sections.push(mdCallout('warn', 'MCP config was outdated and has been auto-fixed.'))
    }

    if (cleaned) {
      sections.push(mdCallout('warn', 'Corrupted token files were cleaned up.'))
    }

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

    if (oauth.ready) {
      sections.push(
        mdCallout('success', 'Linear MCP is ready. Restart your AI client to activate.')
      )
    } else {
      sections.push(mdCallout('info', 'OAuth required — complete the steps below.'))
      sections.push(
        mdSection(
          'Next Steps',
          mdList(
            [
              `Open a NEW terminal and run:\n${mdCodeBlock(MCP_REMOTE_AUTH_COMMANDS.linear, 'bash')}`,
              'Complete OAuth authorization in the browser.',
              'Run `prjct linear verify --md` to confirm tokens were saved.',
              'Restart your AI client. Linear MCP tools will be ready.',
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
    provider: 'linear',
    mode: 'mcp',
    configAutoFixed: configResult.autoFixed,
    tokensCleaned: cleaned,
    tokensMigrated: migration.migrated,
    oauthReady: oauth.ready,
    installedIn: results.map((r) => ({ provider: r.provider, path: r.path, updated: r.changed })),
    nextSteps: oauth.ready
      ? ['Restart your AI client — Linear MCP is ready.']
      : [
          `STEP 1 (done): MCP config written to ${results.map((r) => r.provider).join(', ')}.`,
          `STEP 2: Open a NEW terminal and run: ${MCP_REMOTE_AUTH_COMMANDS.linear}`,
          'STEP 2: A browser will open for OAuth — complete the authorization.',
          'STEP 3: Run `prjct linear verify` to confirm tokens were saved.',
          'STEP 4: Restart your AI client. Linear MCP tools will be ready.',
        ],
    authCommand: MCP_REMOTE_AUTH_COMMANDS.linear,
  })
}

async function verify(): Promise<void> {
  const scan = await scanTokenDirectories()
  const configResult = await validateMcpConfig('linear')
  const mcpStatus = await hasMcpServerAny('linear')

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
  const oauth = await checkOAuthTokens('linear')

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
    sections.push('## Linear MCP Verification')

    // MCP config status
    if (!mcpStatus.configured) {
      sections.push(
        mdCallout('error', 'Linear MCP not configured. Run `prjct linear setup` first.')
      )
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
          'READY — Linear OAuth tokens verified. Restart your AI client to activate.'
        )
      )
    } else {
      sections.push(mdCallout('error', `NOT READY — ${oauth.hint}`))
    }

    console.log(mdOutput(...sections))
    return
  }

  output({
    provider: 'linear',
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
  const mcpStatus = await hasMcpServerAny('linear')
  const configValid = await validateMcpConfig('linear')
  const oauth = mcpStatus.configured ? await checkOAuthTokens('linear') : null

  if (mdMode) {
    const sections: string[] = []
    sections.push('## Linear MCP Status')

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

    if (!mcpStatus.configured) {
      sections.push(
        mdCallout('error', 'Linear MCP not configured. Run `prjct linear setup` to configure.')
      )
    } else if (!oauth?.ready) {
      sections.push(mdCallout('warn', oauth?.hint ?? 'OAuth tokens not found.'))
    } else {
      sections.push(
        mdCallout(
          'success',
          'Linear MCP is healthy. Restart your AI client if tools are not visible.'
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
    provider: 'linear',
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
          usage: 'prjct linear <command>',
          commands: {
            setup: 'Configure Linear MCP server',
            verify: 'Verify OAuth tokens after completing authorization',
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
