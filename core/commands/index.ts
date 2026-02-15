/**
 * prjct CLI Commands Handler
 *
 * Barrel export for commands module.
 *
 * Migration path:
 * - Legacy: import commands from './commands' → commands.work()
 * - New: import { commandRegistry } from './commands' → registry.execute('work')
 */

// Types
export * from '../types'
export { default, PrjctCommands } from './commands'
// Command registration (auto-runs on import)
export { registerAllCommands } from './register'
export type { CommandHandler, CommandMeta, ExecutionContext, HandlerFn } from './registry'
// New registry-based exports
export { CommandRegistry, commandRegistry } from './registry'
