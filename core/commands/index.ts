/**
 * prjct CLI Commands Handler
 *
 * Barrel export for commands module.
 *
 * Migration path:
 * - Legacy: import commands from './commands' → commands.work()
 * - New: import { commandRegistry } from './commands' → registry.execute('work')
 */

// Legacy exports (backwards compat)
export { default, PrjctCommands } from './commands'

// New registry-based exports
export { commandRegistry, CommandRegistry } from './registry'
export type { ExecutionContext, CommandHandler, HandlerFn, CommandMeta } from './registry'

// Command registration (auto-runs on import)
export { registerAllCommands } from './register'

// Types
export * from './types'
