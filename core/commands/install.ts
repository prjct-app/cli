/**
 * prjct install / uninstall — wire (and unwire) Claude Code hooks.
 *
 * Writes `~/.claude/settings.json` so every session in this user account
 * gets prjct's passive context injection. User keys and hooks from other
 * tools stay untouched — only entries tagged `_prjctManaged: true` are
 * touched.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import {
  status as hookStatus,
  install as installHooks,
  PRJCT_HOOKS,
  uninstall as uninstallHooks,
} from '../services/settings-installer'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failFromError, failHard } from '../utils/md-aware'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

function packageRoot(): string {
  try {
    return path.dirname(require.resolve('prjct-cli/package.json'))
  } catch {
    return path.resolve(__dirname, '..', '..')
  }
}

function ensureNativeDependencies(): boolean {
  const script = path.join(packageRoot(), 'scripts', 'ensure-native-deps.js')
  try {
    execFileSync(process.execPath, [script], {
      cwd: packageRoot(),
      stdio: 'inherit',
      timeout: 120000,
    })
    return true
  } catch {
    return false
  }
}

export class InstallCommands extends PrjctCommandsBase {
  /**
   * /p:install — install the prjct hook pack into `~/.claude/settings.json`.
   */
  async install(
    _arg: string | null = null,
    _projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const nativeReady = ensureNativeDependencies()
      const result = await installHooks()
      const total = PRJCT_HOOKS.length
      const msg = `installed ${result.hooksWritten} new, ${result.alreadyPresent} already present (total ${total} hooks)`
      if (options.md) {
        console.log(
          [
            `# prjct hooks installed`,
            ``,
            `Wrote to \`${result.settingsPath}\`.`,
            ``,
            `- new: ${result.hooksWritten}`,
            `- already present: ${result.alreadyPresent}`,
            `- total expected: ${total}`,
            `- native dependencies: ${nativeReady ? 'ready' : 'repair deferred'}`,
            ``,
            `> Only \`_prjctManaged: true\` entries were touched. Your other hooks are untouched.`,
          ].join('\n')
        )
      } else {
        out.done(msg)
        out.info(`settings: ${result.settingsPath}`)
        if (!nativeReady)
          out.warn('SQLite native dependency repair deferred; daemon startup will retry.')
      }
      return { success: true, hooksWritten: result.hooksWritten }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }

  /**
   * /p:uninstall — strip every prjct-managed hook out of settings.json.
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
