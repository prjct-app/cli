/**
 * PostToolUse hook (matcher: Edit|Write). Silent: records files touched
 * in the current session so downstream hooks (Stop, ship workflow) can
 * ask "what did we change?" without re-running `git diff`.
 *
 * Deliberately emits no additionalContext. The host doesn't need to be
 * told what Claude just did; Claude already knows. This is just
 * persistence for later hooks.
 */

import configManager from '../infrastructure/config-manager'
import { memoryService } from '../services/memory-service'
import { emit, readStdinSafe, safeRun } from './_shared'

interface EditToolInput {
  file_path?: string
}

interface WriteToolInput {
  file_path?: string
}

interface HookInput {
  tool_name?: string
  tool_input?: EditToolInput | WriteToolInput
}

export async function runPostEditHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    const input = await readStdinSafe<HookInput>()
    const file = input.tool_input?.file_path
    if (!file) {
      emit({})
      return
    }
    const config = await configManager.readConfig(projectPath)
    if (!config?.projectId) {
      emit({})
      return
    }
    // Event-sourced — downstream hooks/workflows can query via
    // `memoryService.getRecent()` filtering on `post_edit`. Fire and
    // forget; any failure is non-critical.
    try {
      await memoryService.log(projectPath, 'post_edit', {
        file,
        tool: input.tool_name ?? 'unknown',
      })
    } catch {
      // swallow — hook must never surface errors
    }
    emit({})
  })
}
