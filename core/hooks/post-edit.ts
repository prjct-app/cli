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
import { type HookIo, runHook } from './_runner'

interface EditOrWriteToolInput {
  file_path?: string
}

interface HookInput {
  tool_name?: string
  tool_input?: EditOrWriteToolInput
}

export function runPostEditHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PostToolUse',
      projectPath,
      afterEmit: async (input, p) => {
        const file = input.tool_input?.file_path
        if (!file) return
        const config = await configManager.readConfig(p)
        if (!config?.projectId) return
        // Event-sourced — downstream hooks/workflows can query via
        // `memoryService.getRecent()` filtering on `post_edit`. Fire and
        // forget; any failure is non-critical.
        try {
          await memoryService.log(p, 'post_edit', {
            file,
            tool: input.tool_name ?? 'unknown',
          })
        } catch {
          /* swallow — hook must never surface errors */
        }
      },
    },
    io
  )
}
