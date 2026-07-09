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
import { probeHarnessCoverage, renderHarnessCoverageMd } from '../services/harness-coverage'
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
import { installCodexHooks, uninstallCodexHooks } from '../utils/codex-hooks'
import { ensureCodexMcpServer } from '../utils/codex-mcp'
import { installCursorHooks, uninstallCursorHooks } from '../utils/cursor-hooks'
import { installGeminiSettings, uninstallGeminiSettings } from '../utils/gemini-settings'
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
      // Always install Codex hooks when Codex is present; also install when
      // ~/.codex exists so MCP-only users get hooks without re-detect races.
      const codexHooks = codexDetected ? await installCodexHooks() : null
      const geminiDetected = detected.some((runtime) => runtime.runtime.id === 'gemini')
      const geminiConfig = geminiDetected ? await installGeminiSettings() : null
      const cursorDetected = detected.some((runtime) => runtime.runtime.id === 'cursor')
      const cursorHooks = cursorDetected ? await installCursorHooks() : null
      const kimiDetected = detected.some((runtime) => runtime.runtime.id === 'kimi-cli')
      const kimiConfig = kimiDetected ? await ensureKimiMcpServer() : null
      const coverage = await probeHarnessCoverage(projectPath)
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
                  `- Codex MCP: ${
                    codexConfig.skipped === 'user-managed'
                      ? 'user-managed preserved'
                      : codexConfig.changed
                        ? 'updated'
                        : 'already ready'
                  }`,
                  `- Codex status line: ${
                    codexConfig.statusLineChanged ? 'installed' : 'already configured'
                  }`,
                ]
              : []),
            ...(codexHooks
              ? [
                  `- Codex hooks: ${codexHooks.hooksWritten} new, ${codexHooks.alreadyPresent} present, ${codexHooks.hooksPruned} pruned → \`${codexHooks.hooksPath}\``,
                  `- Codex features.hooks: ${codexHooks.featuresChanged ? 'enabled' : 'already on'}`,
                ]
              : []),
            ...(geminiConfig
              ? [
                  `- Gemini MCP: ${geminiConfig.mcpChanged ? 'updated' : 'already ready'}`,
                  `- Gemini hooks: ${geminiConfig.hooksWritten} new, ${geminiConfig.alreadyPresent} present, ${geminiConfig.hooksPruned} pruned → \`${geminiConfig.settingsPath}\``,
                ]
              : []),
            ...(cursorHooks
              ? [
                  `- Cursor hooks: ${cursorHooks.hooksWritten} new, ${cursorHooks.alreadyPresent} present, ${cursorHooks.hooksPruned} pruned → \`${cursorHooks.hooksPath}\``,
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
            renderHarnessCoverageMd(coverage),
            `> One install · one SQLite brain · every agent surface. That is the moat — not more skills.`,
            `> Grok inherits Claude. Codex/Gemini/Cursor get native adapters. Trust Codex hooks once via \`/hooks\`.`,
            `> Only \`_prjctManaged: true\` entries were touched.`,
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
          out.info(`Codex MCP: ${action}`)
          out.info(
            `Codex status line: ${codexConfig.statusLineChanged ? 'installed' : 'already configured'}`
          )
        }
        if (codexHooks) {
          out.info(
            `Codex hooks: ${codexHooks.hooksWritten} new, ${codexHooks.alreadyPresent} present → ${codexHooks.hooksPath}`
          )
          out.info(`Codex features.hooks: ${codexHooks.featuresChanged ? 'enabled' : 'already on'}`)
        }
        if (geminiConfig) {
          out.info(`Gemini MCP: ${geminiConfig.mcpChanged ? 'updated' : 'already ready'}`)
          out.info(
            `Gemini hooks: ${geminiConfig.hooksWritten} new, ${geminiConfig.alreadyPresent} present → ${geminiConfig.settingsPath}`
          )
        }
        if (cursorHooks) {
          out.info(
            `Cursor hooks: ${cursorHooks.hooksWritten} new, ${cursorHooks.alreadyPresent} present → ${cursorHooks.hooksPath}`
          )
        }
        if (kimiConfig) {
          out.info(`Kimi config: ${kimiConfig.changed ? 'updated' : 'already ready'}`)
        }
        out.info(
          `Organic board: ${coverage.liveCount}/${coverage.detectedCount} live (${coverage.organicPct}%)`
        )
      }
      return {
        success: true,
        hooksWritten: result.hooksWritten,
        projectSurface: projectSurfaces?.agentsMd.action ?? 'skipped',
        detectedRuntimes: detected.length,
        organicPct: coverage.organicPct,
        liveRuntimes: coverage.liveCount,
        codexConfig: codexConfig
          ? {
              path: codexConfig.path,
              changed: codexConfig.changed,
              skipped: codexConfig.skipped,
              statusLineChanged: codexConfig.statusLineChanged ?? false,
            }
          : null,
        codexHooks: codexHooks
          ? {
              path: codexHooks.hooksPath,
              hooksWritten: codexHooks.hooksWritten,
              alreadyPresent: codexHooks.alreadyPresent,
              featuresChanged: codexHooks.featuresChanged,
            }
          : null,
        geminiConfig: geminiConfig
          ? {
              path: geminiConfig.settingsPath,
              mcpChanged: geminiConfig.mcpChanged,
              hooksWritten: geminiConfig.hooksWritten,
              alreadyPresent: geminiConfig.alreadyPresent,
            }
          : null,
        cursorHooks: cursorHooks
          ? {
              path: cursorHooks.hooksPath,
              hooksWritten: cursorHooks.hooksWritten,
              alreadyPresent: cursorHooks.alreadyPresent,
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
      // Best-effort Codex cleanup — missing hooks.json is fine.
      const codex = await uninstallCodexHooks().catch(() => ({
        hooksPath: '',
        hooksRemoved: 0,
      }))
      const gemini = await uninstallGeminiSettings().catch(() => ({
        settingsPath: '',
        hooksRemoved: 0,
        mcpRemoved: false,
      }))
      const cursor = await uninstallCursorHooks().catch(() => ({
        hooksPath: '',
        hooksRemoved: 0,
      }))
      const msg = `removed ${result.hooksRemoved} Claude prjct hook(s)${
        codex.hooksRemoved > 0 ? `, ${codex.hooksRemoved} Codex hook(s)` : ''
      }${gemini.hooksRemoved > 0 || gemini.mcpRemoved ? `, Gemini cleaned` : ''}${
        cursor.hooksRemoved > 0 ? `, ${cursor.hooksRemoved} Cursor hook(s)` : ''
      }`
      if (options.md) {
        console.log(
          [
            `# prjct hooks removed`,
            ``,
            `- Claude: ${result.hooksRemoved} (\`${result.settingsPath}\`)`,
            ...(codex.hooksRemoved > 0
              ? [`- Codex: ${codex.hooksRemoved} (\`${codex.hooksPath}\`)`]
              : []),
            ...(gemini.hooksRemoved > 0 || gemini.mcpRemoved
              ? [
                  `- Gemini: ${gemini.hooksRemoved} hook(s)${gemini.mcpRemoved ? ', MCP removed' : ''} (\`${gemini.settingsPath}\`)`,
                ]
              : []),
            ...(cursor.hooksRemoved > 0
              ? [`- Cursor: ${cursor.hooksRemoved} (\`${cursor.hooksPath}\`)`]
              : []),
            ``,
          ].join('\n')
        )
      } else {
        out.done(msg)
      }
      return {
        success: true,
        hooksRemoved: result.hooksRemoved,
        codexHooksRemoved: codex.hooksRemoved,
        geminiHooksRemoved: gemini.hooksRemoved,
        geminiMcpRemoved: gemini.mcpRemoved,
        cursorHooksRemoved: cursor.hooksRemoved,
      }
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
