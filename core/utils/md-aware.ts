/**
 * Mode-aware output helpers.
 *
 * Pre-2.15, every command repeated the same six-line dance:
 *
 *   const msg = '...'
 *   if (options.md) console.log(`> ${msg}`)
 *   else out.warn(msg)
 *   return { success: false, error: msg }
 *
 * That pattern existed 26+ times across the command modules. Variants
 * (`out.fail`, `out.info`, `out.done`) repeated another ~15 times. This
 * module collapses every variant into one helper per severity, with a
 * `failWith` shortcut for the warn-and-return-error pair that drives
 * the bulk of the duplication.
 */

import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from './output'

type Severity = 'warn' | 'info' | 'fail' | 'done'

/**
 * Print `message` respecting the `--md` toggle. In md mode every
 * severity becomes a blockquote line so the agent gets a uniform
 * terminator-style output.
 */
function notify(severity: Severity, message: string, options: MdOption): void {
  if (options.md) {
    console.log(`> ${message}`)
    return
  }
  out[severity](message)
}

export const notifyWarn = (message: string, options: MdOption = {}): void =>
  notify('warn', message, options)
export const notifyInfo = (message: string, options: MdOption = {}): void =>
  notify('info', message, options)
export const notifyFail = (message: string, options: MdOption = {}): void =>
  notify('fail', message, options)
export const notifyDone = (message: string, options: MdOption = {}): void =>
  notify('done', message, options)

/**
 * Notify the user that the command can't proceed and return the
 * matching `CommandResult` failure. Replaces the
 * notify-then-return-error pair that was the most-duplicated block in
 * the command surface.
 */
export function failWith(message: string, options: MdOption = {}): CommandResult {
  notifyWarn(message, options)
  return { success: false, error: message }
}

/**
 * Catch-block convenience: turn a thrown error into a `CommandResult`
 * failure with the standard error-message extraction. Replaces the
 *   `} catch (error) { return { success: false, error: getErrorMessage(error) } }`
 * tail that closes nearly every command method.
 *
 * Pass `options` to also notify the user via `notifyFail`; omit it to
 * stay silent (the caller may already log somewhere else).
 */
export function failFromError(error: unknown, options?: MdOption): CommandResult {
  const message = getErrorMessage(error)
  if (options) notifyFail(message, options)
  return { success: false, error: message }
}
