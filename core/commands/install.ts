/**
 * prjct install / uninstall — wire (and unwire) Claude Code hooks.
 *
 * Writes `~/.claude/settings.json` so every session in this user account
 * gets prjct's passive context injection. User keys and hooks from other
 * tools stay untouched — only entries tagged `_prjctManaged: true` are
 * touched.
 */

import { detectAgentRuntimes } from '../infrastructure/agent-runtime-registry'
import configManager from '../infrastructure/config-manager'
import { writeProjectAgentSurfaces } from '../services/project-agent-surfaces'
import {
  status as hookStatus,
  install as installHooks,
  PRJCT_HOOKS,
  uninstall as uninstallHooks,
} from '../services/settings-installer'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { ensureCodexMcpServer } from '../utils/codex-mcp'
import { ensureKimiMcpServer } from '../utils/kimi-mcp'
import { failFromError, failHard } from '../utils/md-aware'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

export class InstallCommands extends PrjctCommandsBase {
  /**
   * p. install — install the prjct hook pack into `~/.claude/settings.json`.
   */
  async install(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const result = await installHooks()
      const config = await configManager.readConfig(projectPath).catch(() => null)
      const projectSurfaces = config?.projectId
        ? await writeProjectAgentSurfaces(projectPath)
        : null
      const runtimes = await detectAgentRuntimes(projectPath)
      const detected = runtimes.filter((runtime) => runtime.detected)
      const codexDetected = detected.some((runtime) => runtime.runtime.id === 'codex')
      const codexConfig = codexDetected ? await ensureCodexMcpServer() : null
      const kimiDetected = detected.some((runtime) => runtime.runtime.id === 'kimi-cli')
      const kimiConfig = kimiDetected ? await ensureKimiMcpServer() : null
      const total = PRJCT_HOOKS.length
      const prunedNote = result.hooksPruned > 0 ? `, ${result.hooksPruned} retired removed` : ''
      const msg = `installed Claude hooks adapter: ${result.hooksWritten} new, ${result.alreadyPresent} already present${prunedNote} (total ${total} hooks)`
      if (options.md) {
        console.log(
          [
            `# prjct install`,
            ``,
            `## Universal project surface`,
            projectSurfaces
              ? `- AGENTS.md: ${projectSurfaces.agentsMd.action}`
              : `- skipped: not inside an initialized prjct project`,
            ...(projectSurfaces?.claudeMd
              ? [`- CLAUDE.md adapter: ${projectSurfaces.claudeMd.action}`]
              : []),
            ...(projectSurfaces?.ideRules.length
              ? projectSurfaces.ideRules.map((rule) => `- project rule adapter: \`${rule}\``)
              : []),
            ...(codexConfig
              ? [
                  `- Codex config: ${
                    codexConfig.skipped === 'user-managed'
                      ? 'user-managed MCP preserved'
                      : codexConfig.changed
                        ? 'updated'
                        : 'already ready'
                  }`,
                  `- Codex status line: ${
                    codexConfig.statusLineChanged ? 'installed' : 'already configured'
                  }`,
                ]
              : []),
            ...(kimiConfig
              ? [`- Kimi config: ${kimiConfig.changed ? 'updated' : 'already ready'}`]
              : []),
            ``,
            `## Claude hooks adapter`,
            `Wrote to \`${result.settingsPath}\`.`,
            ``,
            `- new: ${result.hooksWritten}`,
            `- already present: ${result.alreadyPresent}`,
            `- retired removed: ${result.hooksPruned}`,
            `- total expected: ${total}`,
            ``,
            `## Runtime detection`,
            ...detected.map(
              (runtime) => `- ${runtime.runtime.displayName}: ${runtime.supportLevel}`
            ),
            ``,
            `> Claude hooks are an adapter, not the universal layer. AGENTS.md + MCP/CLI --md are the portable baseline.`,
            `> Only \`_prjctManaged: true\` hook entries were touched. Your other hooks are untouched.`,
          ].join('\n')
        )
      } else {
        out.done(msg)
        out.info(`settings: ${result.settingsPath}`)
        if (projectSurfaces) {
          out.info(`AGENTS.md: ${projectSurfaces.agentsMd.action}`)
          for (const rule of projectSurfaces.ideRules) out.info(`adapter: ${rule}`)
        } else {
          out.info('project surface: skipped (not inside an initialized prjct project)')
        }
        if (codexConfig) {
          const action =
            codexConfig.skipped === 'user-managed'
              ? 'user-managed MCP preserved'
              : codexConfig.changed
                ? 'updated'
                : 'already ready'
          out.info(`Codex config: ${action}`)
          out.info(
            `Codex status line: ${codexConfig.statusLineChanged ? 'installed' : 'already configured'}`
          )
        }
        if (kimiConfig) {
          out.info(`Kimi config: ${kimiConfig.changed ? 'updated' : 'already ready'}`)
        }
      }
      return {
        success: true,
        hooksWritten: result.hooksWritten,
        projectSurface: projectSurfaces?.agentsMd.action ?? 'skipped',
        detectedRuntimes: detected.length,
        codexConfig: codexConfig
          ? {
              path: codexConfig.path,
              changed: codexConfig.changed,
              skipped: codexConfig.skipped,
              statusLineChanged: codexConfig.statusLineChanged ?? false,
            }
          : null,
        kimiConfig: kimiConfig
          ? {
              path: kimiConfig.path,
              changed: kimiConfig.changed,
            }
          : null,
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * p. uninstall — strip every prjct-managed hook out of settings.json.
   * Leaves non-prjct hooks under the same events intact.
   */
  async uninstall(
    _arg: string | null = null,
    _projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const result = await uninstallHooks()
      const msg = `removed ${result.hooksRemoved} prjct hook(s)`
      if (options.md) {
        console.log(
          `# prjct hooks removed\n\n- removed: ${result.hooksRemoved}\n- settings: \`${result.settingsPath}\`\n`
        )
      } else {
        out.done(msg)
      }
      return { success: true, hooksRemoved: result.hooksRemoved }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * Introspection used by `prjct doctor`.
   */
  async status(
    _arg: string | null = null,
    _projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const s = await hookStatus()
      return { success: true, installed: s.installed, expected: s.expected }
    } catch (error) {
      return failFromError(error)
    }
  }
}
