/**
 * Claude Code hook response schema guard.
 *
 * Every hook emits JSON that Claude Code validates. The schema is strict:
 * `hookSpecificOutput.additionalContext` is only valid for SessionStart,
 * UserPromptSubmit, and PostToolUse. Emitting it on Stop / PreToolUse /
 * SubagentStart / CwdChanged triggers a visible "The hook's output was …
 * Expected schema: …" error to the user every turn.
 *
 * `buildHookOutput` is the single routing point, so this test pins its
 * behavior per event. If someone adds a new event or forgets to widen
 * the allow-list, this catches it at CI.
 */

import { describe, expect, test } from 'bun:test'
import { buildHookOutput } from '../../hooks/_shared'

describe('buildHookOutput routes per Claude Code schema', () => {
  test('SessionStart uses hookSpecificOutput.additionalContext', () => {
    const out = buildHookOutput('SessionStart', 'hello')
    expect(out.hookSpecificOutput).toEqual({
      hookEventName: 'SessionStart',
      additionalContext: 'hello',
    })
    expect(out.systemMessage).toBeUndefined()
  })

  test('UserPromptSubmit uses hookSpecificOutput.additionalContext', () => {
    const out = buildHookOutput('UserPromptSubmit', 'ctx')
    expect(out.hookSpecificOutput?.additionalContext).toBe('ctx')
    expect(out.systemMessage).toBeUndefined()
  })

  test('PostToolUse uses hookSpecificOutput.additionalContext', () => {
    const out = buildHookOutput('PostToolUse', 'ctx')
    expect(out.hookSpecificOutput?.additionalContext).toBe('ctx')
    expect(out.systemMessage).toBeUndefined()
  })

  test('Stop falls back to systemMessage — schema rejects hookSpecificOutput here', () => {
    const out = buildHookOutput('Stop', 'nudge')
    expect(out.systemMessage).toBe('nudge')
    expect(out.hookSpecificOutput).toBeUndefined()
  })

  test('PreToolUse falls back to systemMessage — additionalContext not in its schema', () => {
    const out = buildHookOutput('PreToolUse', 'nudge')
    expect(out.systemMessage).toBe('nudge')
    expect(out.hookSpecificOutput).toBeUndefined()
  })

  test('SubagentStart falls back to systemMessage', () => {
    const out = buildHookOutput('SubagentStart', 'nudge')
    expect(out.systemMessage).toBe('nudge')
    expect(out.hookSpecificOutput).toBeUndefined()
  })

  test('CwdChanged falls back to systemMessage', () => {
    const out = buildHookOutput('CwdChanged', 'nudge')
    expect(out.systemMessage).toBe('nudge')
    expect(out.hookSpecificOutput).toBeUndefined()
  })

  test('null context always produces an empty object', () => {
    for (const event of [
      'SessionStart',
      'UserPromptSubmit',
      'PostToolUse',
      'Stop',
      'PreToolUse',
      'SubagentStart',
      'CwdChanged',
    ]) {
      expect(buildHookOutput(event, null)).toEqual({})
    }
  })

  test('emitted JSON only contains top-level fields Claude Code accepts', () => {
    // Schema whitelist from the Claude Code hook response validator.
    const ALLOWED_TOP_LEVEL = new Set([
      'continue',
      'suppressOutput',
      'stopReason',
      'decision',
      'reason',
      'systemMessage',
      'permissionDecision',
      'hookSpecificOutput',
    ])
    for (const event of [
      'SessionStart',
      'UserPromptSubmit',
      'PostToolUse',
      'Stop',
      'PreToolUse',
      'SubagentStart',
      'CwdChanged',
    ]) {
      const out = buildHookOutput(event, 'x')
      for (const key of Object.keys(out)) {
        expect(ALLOWED_TOP_LEVEL.has(key)).toBe(true)
      }
    }
  })
})
