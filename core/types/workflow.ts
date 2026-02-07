/**
 * Workflow Types
 * Types for workflow preferences and hooks.
 */

export type PreferenceScope = 'permanent' | 'session' | 'once'
export type HookPhase = 'before' | 'after' | 'skip'
export type HookCommand = 'task' | 'done' | 'ship' | 'sync'

export interface WorkflowPreference {
  hook: HookPhase
  command: HookCommand
  action: string
  scope: PreferenceScope
  createdAt: string
}

export interface HookResult {
  success: boolean
  failed?: string
  skipped?: string[]
  output?: string
}
