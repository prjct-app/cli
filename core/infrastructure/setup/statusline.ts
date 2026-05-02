/**
 * Modular statusline installer (Claude Code only).
 *
 * Copies the statusline shell script + lib/ + components/ + themes/
 * + default config from the package's `assets/statusline/` to
 * `~/.prjct-cli/statusline/`, then symlinks `~/.claude/prjct-statusline.sh`
 * at the canonical entry. CLI_VERSION is rewritten in-place when the
 * package upgrades so the host always sees the right version.
 *
 * Failure-mode contract: silently fall back to a simple inline script
 * if assets are missing. Best-effort throughout — statusline is a UX
 * polish, never block setup.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage, isNotFoundError } from '../../types/fs'
import { fileExists, readJson, writeJson } from '../../utils/file-helper'
import log from '../../utils/logger'
import { PACKAGE_ROOT, VERSION } from '../../utils/version'

async function ensureStatusLineSettings(
  settingsPath: string,
  statusLinePath: string
): Promise<void> {
  let settings: Record<string, unknown> = {}
  if (await fileExists(settingsPath)) {
    try {
      settings = (await readJson<Record<string, unknown>>(settingsPath)) ?? {}
    } catch (error) {
      // Invalid JSON, start fresh - but propagate unexpected errors
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
  }
  settings.statusLine = { type: 'command', command: statusLinePath }
  await writeJson(settingsPath, settings)
}

async function installStatusLineModules(sourceDir: string, destDir: string): Promise<void> {
  if (!(await fileExists(sourceDir))) {
    return
  }

  const files = await fs.readdir(sourceDir)
  for (const file of files) {
    if (file.endsWith('.sh')) {
      const src = path.join(sourceDir, file)
      const dest = path.join(destDir, file)
      await fs.copyFile(src, dest)
      await fs.chmod(dest, 0o755)
    }
  }
}

async function ensureStatusLineSymlink(linkPath: string, targetPath: string): Promise<void> {
  try {
    if (await fileExists(linkPath)) {
      const stats = await fs.lstat(linkPath)
      if (stats.isSymbolicLink()) {
        const existingTarget = await fs.readlink(linkPath)
        if (existingTarget === targetPath) {
          return // Already correct
        }
      }
      await fs.unlink(linkPath)
    }
    await fs.symlink(targetPath, linkPath)
  } catch (_error) {
    // If symlink fails (e.g., Windows, permission issues), try copy instead
    try {
      if (await fileExists(targetPath)) {
        await fs.copyFile(targetPath, linkPath)
        await fs.chmod(linkPath, 0o755)
      }
    } catch (copyError) {
      if (!isNotFoundError(copyError)) {
        log.warn(`Symlink fallback warning: ${(copyError as Error).message}`)
      }
    }
  }
}

/**
 * Install status line script with version check.
 * Copies modular statusline from assets/ to ~/.prjct-cli/statusline/.
 * Includes: statusline.sh, lib/, components/, themes/, config.json.
 * Creates symlink at ~/.claude/prjct-statusline.sh.
 * Updates CLI_VERSION in the script.
 */
export async function installStatusLine(): Promise<void> {
  try {
    const claudeDir = path.join(os.homedir(), '.claude')
    const settingsPath = path.join(claudeDir, 'settings.json')
    const claudeStatusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

    const prjctStatusLineDir = path.join(os.homedir(), '.prjct-cli', 'statusline')
    const prjctStatusLinePath = path.join(prjctStatusLineDir, 'statusline.sh')
    const prjctThemesDir = path.join(prjctStatusLineDir, 'themes')
    const prjctLibDir = path.join(prjctStatusLineDir, 'lib')
    const prjctComponentsDir = path.join(prjctStatusLineDir, 'components')
    const prjctConfigPath = path.join(prjctStatusLineDir, 'config.json')

    const assetsDir = path.join(PACKAGE_ROOT, 'assets', 'statusline')
    const sourceScript = path.join(assetsDir, 'statusline.sh')
    const sourceThemeDir = path.join(assetsDir, 'themes')
    const sourceLibDir = path.join(assetsDir, 'lib')
    const sourceComponentsDir = path.join(assetsDir, 'components')
    const sourceConfigPath = path.join(assetsDir, 'default-config.json')

    if (!(await fileExists(claudeDir))) {
      await fs.mkdir(claudeDir, { recursive: true })
    }
    if (!(await fileExists(prjctStatusLineDir))) {
      await fs.mkdir(prjctStatusLineDir, { recursive: true })
    }
    if (!(await fileExists(prjctThemesDir))) {
      await fs.mkdir(prjctThemesDir, { recursive: true })
    }
    if (!(await fileExists(prjctLibDir))) {
      await fs.mkdir(prjctLibDir, { recursive: true })
    }
    if (!(await fileExists(prjctComponentsDir))) {
      await fs.mkdir(prjctComponentsDir, { recursive: true })
    }

    if (await fileExists(prjctStatusLinePath)) {
      const existingContent = await fs.readFile(prjctStatusLinePath, 'utf8')

      if (existingContent.includes('CLI_VERSION=')) {
        const versionMatch = existingContent.match(/CLI_VERSION="([^"]*)"/)

        if (versionMatch && versionMatch[1] !== VERSION) {
          const updatedContent = existingContent.replace(
            /CLI_VERSION="[^"]*"/,
            `CLI_VERSION="${VERSION}"`
          )
          await fs.writeFile(prjctStatusLinePath, updatedContent, { mode: 0o755 })
        }

        await installStatusLineModules(sourceLibDir, prjctLibDir)
        await installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

        await ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
        await ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
        return
      }
      // else: Script exists WITHOUT CLI_VERSION - fall through to replace with new version
    }

    if (await fileExists(sourceScript)) {
      let scriptContent = await fs.readFile(sourceScript, 'utf8')
      scriptContent = scriptContent.replace(/CLI_VERSION="[^"]*"/, `CLI_VERSION="${VERSION}"`)
      await fs.writeFile(prjctStatusLinePath, scriptContent, { mode: 0o755 })

      await installStatusLineModules(sourceLibDir, prjctLibDir)
      await installStatusLineModules(sourceComponentsDir, prjctComponentsDir)

      if (await fileExists(sourceThemeDir)) {
        const themes = await fs.readdir(sourceThemeDir)
        for (const theme of themes) {
          const src = path.join(sourceThemeDir, theme)
          const dest = path.join(prjctThemesDir, theme)
          // Always update themes to get new icons/colors
          await fs.copyFile(src, dest)
        }
      }

      // Copy default config (only if not exists - preserve user customizations)
      if (!(await fileExists(prjctConfigPath)) && (await fileExists(sourceConfigPath))) {
        await fs.copyFile(sourceConfigPath, prjctConfigPath)
      }
    } else {
      // Fallback: create simple script inline
      const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
CLI_VERSION="${VERSION}"
input=$(cat)
CWD=$(echo "$input" | jq -r '.workspace.current_dir // "~"' 2>/dev/null)
CONFIG="$CWD/.prjct/prjct.config.json"
if [ -f "$CONFIG" ]; then
  PROJECT_ID=$(jq -r '.projectId // ""' "$CONFIG" 2>/dev/null)
  if [ -n "$PROJECT_ID" ]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"
    if [ -f "$PROJECT_JSON" ]; then
      PROJECT_VERSION=$(jq -r '.cliVersion // ""' "$PROJECT_JSON" 2>/dev/null)
      if [ -z "$PROJECT_VERSION" ] || [ "$PROJECT_VERSION" != "$CLI_VERSION" ]; then
        echo "prjct v$CLI_VERSION - run p. sync"
        exit 0
      fi
    else
      echo "prjct v$CLI_VERSION - run p. sync"
      exit 0
    fi
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [ -f "$STATE" ]; then
      TASK=$(jq -r '.currentTask.description // ""' "$STATE" 2>/dev/null)
      if [ -n "$TASK" ]; then
        echo "$TASK"
        exit 0
      fi
    fi
  fi
fi
echo "prjct"
`
      await fs.writeFile(prjctStatusLinePath, scriptContent, { mode: 0o755 })
    }

    await ensureStatusLineSymlink(claudeStatusLinePath, prjctStatusLinePath)
    await ensureStatusLineSettings(settingsPath, claudeStatusLinePath)
  } catch (error) {
    if (!isNotFoundError(error)) {
      log.warn(`Status line warning: ${getErrorMessage(error)}`)
    }
  }
}
