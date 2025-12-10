/**
 * Task Stack Manager - Handles multiple concurrent tasks with pause/resume capability
 * Enables natural workflow with interruptions and context switching
 */

export type {
  TaskEntry,
  ParsedNowFile,
  MigrationResult,
  SwitchResult,
  StackSummary,
} from './types'

export { parseNowFile, formatDuration } from './parser'
export { ensureStackFile, appendToStack, readStack, writeStack, updateNowFile } from './storage'
export { TaskStack } from './task-stack'

import { TaskStack } from './task-stack'
export default TaskStack
