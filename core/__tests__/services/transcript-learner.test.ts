/**
 * Transcript Learner — extraction + dedup tests.
 *
 * Covers parser, candidate extraction with phrase heuristics, hash
 * dedup, paragraph length floor, and per-session candidate cap. Does
 * not exercise the full ingestTranscript() path since that needs a real
 * project DB; that is integration-tested via the Stop hook in
 * production sessions.
 */

import { describe, expect, test } from 'bun:test'
import { _internal } from '../../services/transcript-learner'

const { parseTranscript, extractCandidates, hashContent, PHRASE_TYPE_MAP } = _internal

function transcriptLine(role: string, text: string): string {
  return JSON.stringify({ role, content: text })
}

describe('transcript-learner — parseTranscript', () => {
  test('skips non-assistant roles', () => {
    const raw = [
      transcriptLine('user', 'a'.repeat(200)),
      transcriptLine('assistant', 'b'.repeat(200)),
      transcriptLine('system', 'c'.repeat(200)),
    ].join('\n')
    const out = parseTranscript(raw)
    expect(out).toHaveLength(1)
    expect(out[0].role).toBe('assistant')
  })

  test('skips messages shorter than the paragraph floor', () => {
    const raw = [
      transcriptLine('assistant', 'short answer'),
      transcriptLine('assistant', 'long answer '.repeat(50)),
    ].join('\n')
    const out = parseTranscript(raw)
    expect(out).toHaveLength(1)
  })

  test('handles content as text-block array shape', () => {
    const raw = JSON.stringify({
      role: 'assistant',
      content: [
        { type: 'text', text: 'a'.repeat(100) },
        { type: 'tool_use', id: 'x', name: 'Bash', input: {} },
      ],
    })
    const out = parseTranscript(raw)
    expect(out).toHaveLength(1)
    expect(out[0].text).toMatch(/^a{100}$/)
  })

  test('survives malformed JSONL lines', () => {
    const raw = ['not json', '', transcriptLine('assistant', 'x'.repeat(200))].join('\n')
    const out = parseTranscript(raw)
    expect(out).toHaveLength(1)
  })

  test('handles nested message.content shape', () => {
    const raw = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: 'y'.repeat(100) },
    })
    const out = parseTranscript(raw)
    expect(out).toHaveLength(1)
  })
})

describe('transcript-learner — extractCandidates', () => {
  test('extracts decision phrases as type=decision', () => {
    const messages = [
      {
        role: 'assistant' as const,
        text: `We considered three approaches and decided to go with option B because it has the simplest invariants and the lowest blast radius if it fails.`,
      },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('decision')
    expect(out[0].matchedPhrase).toBe('decided to')
  })

  test('extracts learning phrases as type=learning', () => {
    const messages = [
      {
        role: 'assistant' as const,
        text: `Turns out that the daemon was caching the rules per-process — which is why a restart was needed before the change took effect.`,
      },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('learning')
  })

  test('extracts gotcha phrases as type=gotcha', () => {
    const messages = [
      {
        role: 'assistant' as const,
        text: `Gotcha: the path resolver fails when the project root is a symlink — we hit this on macOS with /tmp pointing into /private/tmp.`,
      },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('gotcha')
  })

  test('skips paragraphs without recognized phrases', () => {
    const messages = [
      {
        role: 'assistant' as const,
        text: 'This is a long paragraph with no high-signal phrase, just normal prose talking about something. '.repeat(
          2
        ),
      },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(0)
  })

  test('skips paragraphs shorter than the floor', () => {
    const messages = [
      {
        role: 'assistant' as const,
        text: 'I decided to go.',
      },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(0)
  })

  test('dedups by content hash within a single run', () => {
    const para = `The right call here was to keep the daemon and just make it invisible to the user — every alternative had worse trade-offs around latency and routing.`
    const messages = [
      { role: 'assistant' as const, text: para },
      { role: 'assistant' as const, text: para },
    ]
    const out = extractCandidates(messages)
    expect(out).toHaveLength(1)
  })

  test('caps at MAX_CANDIDATES_PER_SESSION', () => {
    const decisions: { role: 'assistant'; text: string }[] = []
    for (let i = 0; i < 50; i++) {
      decisions.push({
        role: 'assistant',
        text: `Decided to take action ${i} because of the unique reasoning ${i} that supports this choice in context ${i}.`,
      })
    }
    const out = extractCandidates(decisions)
    expect(out.length).toBeLessThanOrEqual(12)
    expect(out.length).toBe(12)
  })
})

describe('transcript-learner — hashContent', () => {
  test('returns a 16-char lowercase hex prefix', () => {
    const h = hashContent('Hello World')
    expect(h).toHaveLength(16)
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  test('case- and whitespace-insensitive', () => {
    expect(hashContent('  Hello World  ')).toBe(hashContent('hello world'))
    expect(hashContent('HELLO WORLD')).toBe(hashContent('hello world'))
  })
})

describe('transcript-learner — PHRASE_TYPE_MAP', () => {
  test('every phrase maps to one of the known memory types', () => {
    const validTypes = new Set(['decision', 'learning', 'gotcha', 'fact'])
    for (const entry of PHRASE_TYPE_MAP) {
      expect(validTypes.has(entry.type)).toBe(true)
    }
  })

  test('phrases are lowercase (extractor lowercases the haystack)', () => {
    for (const entry of PHRASE_TYPE_MAP) {
      expect(entry.phrase).toBe(entry.phrase.toLowerCase())
    }
  })
})
