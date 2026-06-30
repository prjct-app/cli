/**
 * `prjct vault` — opt-in Obsidian/markdown vault generation (same shape as
 * `prjct sdd`/`tdd`/`lean`: one registered verb, subcommand-parsed, one file).
 *
 *   prjct vault                 → show mode + location
 *   prjct vault on|export       → enable generation (writes config.vault) + regenerate now
 *   prjct vault off             → disable generation (existing files left untouched)
 *
 * Default is OFF. prjct is the LLM data plane: agents read project knowledge
 * through tools/CLI (`prjct search`, `prjct context memory`, `prjct_*` MCP),
 * not by Read/Glob over a generated markdown tree. The vault is a write-only
 * projection cloud never consumes; `export` restores it for Obsidian users.
 */

import configManager from '../infrastructure/config-manager'
import { effectiveVaultMode, VAULT_MODES } from '../services/vault-preferences'
import { resolveVaultRoot } from '../services/wiki-migration'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { failHard, failWith } from '../utils/md-aware'
import { mdOutput } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

export class VaultCommands extends PrjctCommandsBase {
  async vault(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const sub = (parts[0] ?? '').toLowerCase()

    if (!sub || sub === 'status' || sub === 'show') return this.showStatus(projectPath, options)
    if (sub === 'on' || sub === 'export') return this.setMode('export', projectPath, options)
    if (sub === 'off') return this.setMode('off', projectPath, options)
    return failWith(`Unknown vault subcommand "${sub}". Use: on|off|status.`, options)
  }

  private async showStatus(projectPath: string, options: MdOption): Promise<CommandResult> {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId)
      return failHard('No prjct project here — run `prjct init` first.', options)

    const mode = effectiveVaultMode(config)
    const location = await resolveVaultRoot(projectPath).catch(() => '(unresolved)')
    const lines = [
      `Mode: ${mode}${mode === 'off' ? ' (no markdown generated — agents read via tools)' : ' (Obsidian vault regenerated)'}`,
      `Location: ${location}`,
      'Set: prjct vault on|off',
    ]
    if (options.md) {
      console.log(mdOutput('## Vault', `> **Mode**: \`${mode}\``, lines.slice(1).join('\n')))
    } else {
      out.info(`Vault — ${lines.join('\n  ')}`)
    }
    return { success: true, mode }
  }

  private async setMode(
    mode: 'off' | 'export',
    projectPath: string,
    options: MdOption
  ): Promise<CommandResult> {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId)
      return failHard('No prjct project here — run `prjct init` first.', options)

    config.vault = { mode }
    await configManager.writeConfig(projectPath, config)

    let msg: string
    if (mode === 'off') {
      msg =
        'Vault mode off — prjct no longer generates the markdown vault. Existing files are untouched; agents read knowledge through prjct tools.'
    } else {
      // Enabling: generate the vault right away so it exists immediately.
      const { generateWiki } = await import('../services/wiki-generator')
      const result = await generateWiki(projectPath, config.projectId).catch(() => null)
      msg = result
        ? `Vault mode → export. Regenerated ${result.filesWritten} files at ${result.wikiRoot}.`
        : 'Vault mode → export. (Regeneration will run on the next hook/sync.)'
    }
    if (options.md) console.log(mdOutput('## Vault', `> ${msg}`))
    else out.done(msg)
    return { success: true, mode }
  }
}

/** Exported for unit tests. */
export const _internal = { effectiveVaultMode, VAULT_MODES }
