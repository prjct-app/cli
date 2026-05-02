/**
 * Install the prjct Claude Code status line: writes a bash script
 * into ~/.claude and points Claude's settings.json at it.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { getErrorMessage } from '../../types/fs'
import { fileExists, readJson, writeJson } from '../../utils/file-helper'
import { VERSION } from '../../utils/version'

export async function installStatusLine(): Promise<{ success: boolean; error?: string }> {
  try {
    const claudeDir = pathManager.getClaudeDir()
    const settingsPath = pathManager.getClaudeSettingsPath()
    const statusLinePath = path.join(claudeDir, 'prjct-statusline.sh')

    const scriptContent = `#!/bin/bash
# prjct Status Line for Claude Code
# Shows version update notifications and current task

# Current CLI version (embedded at install time)
CLI_VERSION="${VERSION}"

# Read JSON context from stdin (provided by Claude Code)
read -r json

# Extract cwd from JSON
CWD=$(echo "$json" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

# Check if this is a prjct project
CONFIG="$CWD/.prjct/prjct.config.json"
if [[ -f "$CONFIG" ]]; then
  # Extract projectId
  PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"projectId"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

  if [[ -n "$PROJECT_ID" ]]; then
    PROJECT_JSON="$HOME/.prjct-cli/projects/$PROJECT_ID/project.json"

    # Check version mismatch
    if [[ -f "$PROJECT_JSON" ]]; then
      PROJECT_VERSION=$(grep -o '"cliVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_JSON" | sed 's/.*"cliVersion"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      # If no cliVersion or different version, show update notice
      if [[ -z "$PROJECT_VERSION" ]] || [[ "$PROJECT_VERSION" != "$CLI_VERSION" ]]; then
        echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
        exit 0
      fi
    else
      # No project.json means project needs sync
      echo "⚠️ prjct v$CLI_VERSION available! Run /p:sync"
      exit 0
    fi

    # Show current task if exists
    STATE="$HOME/.prjct-cli/projects/$PROJECT_ID/storage/state.json"
    if [[ -f "$STATE" ]]; then
      TASK=$(grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')
      STATUS=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -1 | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/')

      if [[ -n "$TASK" ]] && [[ "$STATUS" == "active" ]]; then
        # Truncate task to 40 chars
        TASK_SHORT="\${TASK:0:40}"
        [[ \${#TASK} -gt 40 ]] && TASK_SHORT="$TASK_SHORT..."
        echo "🎯 $TASK_SHORT"
        exit 0
      fi
    fi
  fi
fi

# Default: show prjct branding
echo "⚡ prjct"
`
    await fs.writeFile(statusLinePath, scriptContent, { mode: 0o755 })

    let settings: Record<string, unknown> = {}
    if (await fileExists(settingsPath)) {
      try {
        settings = (await readJson<Record<string, unknown>>(settingsPath)) ?? {}
      } catch (_error) {
        // Invalid JSON, start fresh
      }
    }

    settings.statusLine = {
      type: 'command',
      command: statusLinePath,
    }

    await writeJson(settingsPath, settings)

    return { success: true }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}
