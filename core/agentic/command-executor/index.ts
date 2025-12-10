/**
 * Command Executor
 * Orchestrates command execution with agentic delegation.
 *
 * @module agentic/command-executor
 * @version 3.4
 */

export type { ExecutionResult, SimpleExecutionResult, ExecutionToolsFn } from './types'
export { signalStart, signalEnd } from './status-signal'
export { CommandExecutor } from './command-executor'

import { CommandExecutor } from './command-executor'

const commandExecutor = new CommandExecutor()
export default commandExecutor
