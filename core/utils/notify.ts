/**
 * Desktop notifications + notify-mode resolution.
 *
 * The mode resolver lives here (not in the `notify` command) so the cold-path
 * hooks can import it without pulling a command module's deps — keeping hook
 * startup cheap. `notifyDesktop` is strictly best-effort: a missing notifier,
 * a sandbox denial, or an unsupported platform must NEVER surface — a
 * notification is a nicety, never a reason to disturb a hook or a command.
 */

import type { LocalConfig } from '../types/config'
import { execFileAsync } from './exec'

export type NotifyMode = 'on' | 'off'
export const NOTIFY_MODES: readonly NotifyMode[] = ['on', 'off']

/** Default-ON: config wins, then `PRJCT_NOTIFY_MODE`, else `on`. */
export function effectiveNotifyMode(config: LocalConfig | null): NotifyMode {
  const fromConfig = config?.notify?.mode
  if (fromConfig === 'on' || fromConfig === 'off') return fromConfig
  const fromEnv = process.env.PRJCT_NOTIFY_MODE?.toLowerCase()
  if (fromEnv === 'on' || fromEnv === 'off') return fromEnv
  return 'on'
}

/** Strip what would break the osascript string literal + clamp length. */
function sanitize(s: string): string {
  return s
    .replace(/["\\]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 180)
}

/**
 * Fire a best-effort OS desktop notification. macOS → `osascript`, Linux →
 * `notify-send`, anything else → no-op. Never throws.
 */
export async function notifyDesktop(title: string, message: string): Promise<void> {
  try {
    const t = sanitize(title) || 'prjct'
    const m = sanitize(message)
    if (process.platform === 'darwin') {
      await execFileAsync('osascript', ['-e', `display notification "${m}" with title "${t}"`])
    } else if (process.platform === 'linux') {
      await execFileAsync('notify-send', [t, m])
    }
    // Other platforms: no-op — best-effort by design.
  } catch {
    // Missing notifier / sandbox denial / anything — swallow. Never disturb.
  }
}
