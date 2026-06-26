/**
 * Friction detector — extracts user-pushback signals from a Claude
 * Code session transcript. Tests pin: classifier coverage,
 * idempotent dedup, language-agnostic markers, conservative cap.
 */

import { describe, expect, it } from 'bun:test'
import { _internal } from '../../services/friction-detector'

describe('friction-detector classify', () => {
  it('flags negation markers (es + en)', () => {
    expect(_internal.classify('no, así no es')).toBe('negation')
    expect(_internal.classify('No. that is wrong')).toBe('negation')
    expect(_internal.classify('así no')).toBe('negation')
    expect(_internal.classify('espera, déjame ver')).toBe('negation')
    expect(_internal.classify('stop please')).toBe('negation')
    expect(_internal.classify('wait — ')).toBe('negation')
  })

  it('flags correction markers', () => {
    expect(_internal.classify('that should be feat: not fix:')).toBe('correction')
    expect(_internal.classify('rather than X, try Y')).toBe('correction')
    expect(_internal.classify('en realidad lo que necesito es')).toBe('correction')
    expect(_internal.classify('use Y instead of X')).toBe('correction')
  })

  it('flags complaint markers', () => {
    expect(_internal.classify("doesn't work")).toBe('complaint')
    expect(_internal.classify('no funciona el comando')).toBe('complaint')
    expect(_internal.classify('this is broken')).toBe('complaint')
  })

  it('returns null for ordinary discussion', () => {
    expect(_internal.classify('let me see if that works')).toBeNull()
    expect(_internal.classify('ok proceed')).toBeNull()
    expect(_internal.classify('sounds good, continue')).toBeNull()
  })
})

describe('friction-detector parseJsonl + extractSignals', () => {
  it('extracts a friction signal from user negation after assistant action', () => {
    const lines = _internal.parseJsonl(
      [
        JSON.stringify({ role: 'assistant', content: "I'll run prjct ship now." }),
        JSON.stringify({ role: 'user', content: 'no, primero corramos los tests' }),
      ].join('\n')
    )
    const signals = _internal.extractSignals(lines)
    expect(signals.length).toBe(1)
    expect(signals[0]?.category).toBe('negation')
    expect(signals[0]?.precedingAssistantPreview).toContain('prjct ship')
  })

  it('handles Anthropic content-block format', () => {
    const lines = _internal.parseJsonl(
      [
        JSON.stringify({
          role: 'assistant',
          content: [{ type: 'text', text: 'Done. Anything else?' }],
        }),
        JSON.stringify({
          role: 'user',
          content: [{ type: 'text', text: "doesn't work, try again" }],
        }),
      ].join('\n')
    )
    const signals = _internal.extractSignals(lines)
    expect(signals.length).toBe(1)
    expect(signals[0]?.category).toBe('complaint')
  })

  it('skips malformed JSONL lines silently', () => {
    const raw = [
      'not-json-at-all',
      JSON.stringify({ role: 'user', content: 'no, do something else' }),
      '',
    ].join('\n')
    const lines = _internal.parseJsonl(raw)
    expect(lines.length).toBe(1)
    const signals = _internal.extractSignals(lines)
    expect(signals.length).toBe(1)
  })

  it('hashSignal normalises whitespace and casing for dedup', () => {
    const a = _internal.hashSignal('No,   THIS is broken')
    const b = _internal.hashSignal('no, this is broken')
    expect(a).toBe(b)
  })

  it('formats friction as a structured lesson instead of a raw quote lead', () => {
    const signal = {
      category: 'negation' as const,
      excerpt: 'no, primero corramos los tests',
      precedingAssistantPreview: "I'll run prjct ship now.",
    }
    const formatted = _internal.formatSignal(signal)

    expect(formatted).toStartWith('[negation] Lesson:')
    expect(formatted).toContain('What happened: The user pushed back after the assistant response.')
    expect(formatted).toContain('Why it mattered:')
    expect(formatted).toContain('Pattern:')
    expect(formatted).toContain('Anti-pattern:')
    expect(formatted).toContain('Next action:')
    expect(formatted).not.toContain('Evidence:')
    expect(formatted).not.toContain('no, primero corramos los tests')
    expect(formatted).not.toContain("I'll run prjct ship now.")
    expect(formatted).not.toStartWith('[negation] User pushback:')
  })

  it('caps signals at MAX_SIGNALS_PER_SESSION', () => {
    expect(_internal.MAX_SIGNALS_PER_SESSION).toBeLessThanOrEqual(10)
  })
})
