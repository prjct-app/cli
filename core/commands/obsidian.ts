/**
 * Obsidian Commands — Vault integration for Kanban board, KB, and sync
 *
 * Subcommands:
 * - setup: Configure vault path and create project folder
 * - export: Export prjct data to Obsidian vault
 * - status: Show Obsidian integration status
 */

import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { obsidianExporter } from '../services/obsidian-exporter'
import type { CommandResult } from '../types/commands'
import type { ObsidianConfig } from '../types/integrations'
import { fileExists, readJson, writeJson } from '../utils/file-helper'
import { mdCallout, mdDone, mdNextSteps, mdOutput, mdStats } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

export class ObsidianCommands extends PrjctCommandsBase {
  /**
   * Main entry point — routes to subcommands
   */
  async obsidian(
    subcommand: string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    // Parse subcommand and flags from the raw string
    const parts = (subcommand || 'status').split(' ').filter(Boolean)
    const sub = parts[0]

    // Extract flags
    const md = parts.includes('--md')
    let vaultPath: string | undefined
    const vpIdx = parts.indexOf('--vault-path')
    if (vpIdx !== -1 && parts[vpIdx + 1]) {
      vaultPath = parts[vpIdx + 1]
    }
    const autoExport = !parts.includes('--no-auto-export')

    const options = { md, vaultPath, autoExport }

    switch (sub) {
      case 'setup':
        return this.setup(projectPath, options)
      case 'export':
        return this.export(projectPath, options)
      case 'status':
        return this.status(projectPath, options)
      default:
        return {
          success: false,
          message: options.md
            ? mdOutput(mdCallout('error', `Unknown subcommand: ${sub}. Use: setup, export, status`))
            : `Unknown subcommand: ${sub}`,
        }
    }
  }

  /**
   * Setup: configure vault path and create project folder
   */
  private async setup(
    projectPath: string,
    options: { md?: boolean; vaultPath?: string; autoExport?: boolean }
  ): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult

    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      return { success: false, message: 'No project ID found' }
    }

    const vaultPath = options.vaultPath
    if (!vaultPath) {
      const msg = 'Vault path required. Usage: prjct obsidian setup --vault-path /path/to/vault'
      if (!options.md) out.fail(msg)
      return {
        success: false,
        message: options.md ? mdOutput(mdCallout('error', msg)) : '',
      }
    }

    // Validate vault path exists
    if (!(await fileExists(vaultPath))) {
      const msg = `Vault path does not exist: ${vaultPath}`
      if (!options.md) out.fail(msg)
      return { success: false, message: options.md ? mdOutput(mdCallout('error', msg)) : '' }
    }

    const projectName = path.basename(projectPath)
    const config: ObsidianConfig = {
      vaultPath,
      projectFolder: projectName,
      autoExport: options.autoExport ?? true,
    }

    // Save config to global project config
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const configPath = path.join(globalPath, 'project.json')
    const globalConfig = (await readJson<Record<string, unknown>>(configPath)) || {}
    const integrations = (globalConfig.integrations || {}) as Record<string, unknown>
    integrations.obsidian = config
    globalConfig.integrations = integrations
    await writeJson(configPath, globalConfig)

    // Create vault structure
    const vaultProjectPath = obsidianExporter.getProjectPath(config, projectName)
    await obsidianExporter.ensureStructure(vaultProjectPath)
    await obsidianExporter.writeLink(vaultProjectPath, projectId, projectPath)

    if (!options.md) {
      out.done('Obsidian vault linked')
      out.info(`Vault: ${vaultPath}`)
      out.info(`Project folder: projects/${projectName}/`)
      out.info('Run `prjct obsidian export` to populate the vault')
    }

    return {
      success: true,
      message: options.md
        ? mdOutput(
            mdDone('Obsidian Linked'),
            mdStats({
              Vault: vaultPath,
              'Project folder': `projects/${projectName}/`,
              'Auto-export': config.autoExport ? 'enabled' : 'disabled',
            }),
            mdNextSteps([
              { label: 'Export project data to vault', command: 'prjct obsidian export' },
              { label: 'Check integration status', command: 'prjct obsidian status' },
            ])
          )
        : '',
    }
  }

  /**
   * Export: export prjct data to Obsidian vault
   */
  private async export(projectPath: string, options: { md?: boolean }): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult

    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      return { success: false, message: 'No project ID found' }
    }

    const config = await this.getObsidianConfig(projectId)
    if (!config) {
      const msg = 'Obsidian not configured. Run: prjct obsidian setup --vault-path /path/to/vault'
      if (!options.md) out.fail(msg)
      return { success: false, message: options.md ? mdOutput(mdCallout('error', msg)) : '' }
    }

    const projectName = path.basename(projectPath)
    if (!options.md) out.info('Exporting to Obsidian vault...')

    const result = await obsidianExporter.exportAll(projectId, projectName, config)

    if (!options.md) {
      if (result.success) {
        out.done('Export complete')
        out.info(`Board: ${result.exported.board} tasks`)
        out.info(`Queue: ${result.exported.queue} items`)
        out.info(`Shipped: ${result.exported.shipped} items`)
        out.info(`Roadmap: ${result.exported.roadmap} features`)
        out.info(`Daily: ${result.exported.daily ? 'generated' : 'skipped'}`)
      } else {
        out.warn('Export completed with errors')
        for (const err of result.errors) out.fail(err)
      }
    }

    return {
      success: result.success,
      message: options.md
        ? mdOutput(
            mdDone(
              'Obsidian Export',
              result.success ? 'All sections exported' : 'Completed with errors'
            ),
            mdStats({
              Board: `${result.exported.board} tasks`,
              Queue: `${result.exported.queue} items`,
              Shipped: `${result.exported.shipped} items`,
              Roadmap: `${result.exported.roadmap} features`,
              Daily: result.exported.daily ? 'generated' : 'skipped',
            }),
            result.errors.length > 0
              ? `### Errors\n${result.errors.map((e) => `- ${e}`).join('\n')}`
              : null,
            mdNextSteps([
              { label: 'Open vault in Obsidian', command: `open ${config.vaultPath}` },
              { label: 'Re-export', command: 'prjct obsidian export' },
            ])
          )
        : '',
    }
  }

  /**
   * Status: show Obsidian integration status
   */
  private async status(projectPath: string, options: { md?: boolean }): Promise<CommandResult> {
    const initResult = await this.ensureProjectInit(projectPath)
    if (!initResult.success) return initResult

    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      return { success: false, message: 'No project ID found' }
    }

    const config = await this.getObsidianConfig(projectId)
    if (!config) {
      const msg =
        'Obsidian integration is not enabled. All data is stored in the local database by default.'
      if (!options.md) {
        out.info(msg)
      }
      return {
        success: true,
        message: options.md
          ? mdOutput(
              mdCallout(
                'info',
                'Obsidian integration is not enabled. All data is stored in the local database by default.'
              ),
              mdNextSteps([
                {
                  label: 'Enable Obsidian (optional)',
                  command: 'prjct obsidian setup --vault-path /path/to/vault',
                },
              ])
            )
          : '',
      }
    }

    const projectName = path.basename(projectPath)
    const vaultProjectPath = obsidianExporter.getProjectPath(config, projectName)
    const linkExists = await fileExists(path.join(vaultProjectPath, '.prjct-link.yml'))

    if (!options.md) {
      out.done('Obsidian configured')
      out.info(`Vault: ${config.vaultPath}`)
      out.info(`Project folder: projects/${config.projectFolder || projectName}/`)
      out.info(`Auto-export: ${config.autoExport ? 'enabled' : 'disabled'}`)
      out.info(`Link file: ${linkExists ? 'present' : 'missing'}`)
    }

    return {
      success: true,
      message: options.md
        ? mdOutput(
            mdDone('Obsidian Status'),
            mdStats({
              Vault: config.vaultPath,
              'Project folder': `projects/${config.projectFolder || projectName}/`,
              'Auto-export': config.autoExport ? 'enabled' : 'disabled',
              'Link file': linkExists ? 'present' : 'missing',
            }),
            mdNextSteps([{ label: 'Export data to vault', command: 'prjct obsidian export' }])
          )
        : '',
    }
  }

  /**
   * Get Obsidian config from global project config
   */
  private async getObsidianConfig(projectId: string): Promise<ObsidianConfig | null> {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const configPath = path.join(globalPath, 'project.json')
    const globalConfig = await readJson<Record<string, unknown>>(configPath)
    if (!globalConfig) return null
    const integrations = globalConfig.integrations as Record<string, unknown> | undefined
    if (!integrations?.obsidian) return null
    return integrations.obsidian as ObsidianConfig
  }
}
