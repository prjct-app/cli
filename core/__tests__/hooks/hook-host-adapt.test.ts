import { describe, expect, it } from 'bun:test'
import { adaptHookOutputForHost, buildDenyOutput, buildHookOutput } from '../../hooks/_shared'

describe('adaptHookOutputForHost (gemini)', () => {
  it('rewrites Claude deny to Gemini decision/reason', () => {
    const deny = buildDenyOutput('PreToolUse', 'turn budget exceeded')
    const adapted = adaptHookOutputForHost(deny, 'gemini')
    expect(adapted).toEqual({
      decision: 'deny',
      reason: 'turn budget exceeded',
    })
  })

  it('maps UserPromptSubmit additionalContext to BeforeAgent', () => {
    const out = buildHookOutput('UserPromptSubmit', 'CTX')
    const adapted = adaptHookOutputForHost(out, 'gemini')
    expect(adapted).toEqual({
      hookSpecificOutput: {
        hookEventName: 'BeforeAgent',
        additionalContext: 'CTX',
      },
    })
  })

  it('leaves Claude host payload unchanged', () => {
    const out = buildHookOutput('SessionStart', 'HELLO')
    expect(adaptHookOutputForHost(out, 'claude')).toEqual(out)
  })

  it('maps Cursor host to camelCase + additional_context snake_case', () => {
    const out = buildHookOutput('UserPromptSubmit', 'CTX')
    const adapted = adaptHookOutputForHost(out, 'cursor')
    expect(adapted.additional_context).toBe('CTX')
    const hso = adapted.hookSpecificOutput as Record<string, string>
    expect(hso.hookEventName).toBe('beforeSubmitPrompt')
    expect(hso.additional_context).toBe('CTX')
  })

  it('rewrites Cursor deny with decision + permissionDecision', () => {
    const deny = buildDenyOutput('PreToolUse', 'budget')
    const adapted = adaptHookOutputForHost(deny, 'cursor')
    expect(adapted.decision).toBe('deny')
    expect(adapted.permissionDecision).toBe('deny')
    expect(adapted.reason).toBe('budget')
  })
})
