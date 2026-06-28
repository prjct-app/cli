import { describe, expect, it } from 'bun:test'
import { parseTranscriptJsonl, sumTranscriptUsage } from '../../services/transcript-jsonl'

describe('sumTranscriptUsage', () => {
  it('sums input/output across assistant turns, counting cache reads/creations as input', () => {
    const lines = parseTranscriptJsonl(
      [
        JSON.stringify({ type: 'user', message: { role: 'user' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            usage: {
              input_tokens: 100,
              output_tokens: 40,
              cache_creation_input_tokens: 10,
              cache_read_input_tokens: 5,
            },
          },
        }),
        JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', usage: { input_tokens: 200, output_tokens: 60 } },
        }),
      ].join('\n')
    )

    const usage = sumTranscriptUsage(lines)
    expect(usage.tokensIn).toBe(100 + 10 + 5 + 200)
    expect(usage.tokensOut).toBe(40 + 60)
  })

  it('returns zero usage when no usage blocks are present', () => {
    const lines = parseTranscriptJsonl(JSON.stringify({ type: 'user', message: { role: 'user' } }))
    expect(sumTranscriptUsage(lines)).toEqual({ tokensIn: 0, tokensOut: 0 })
  })

  it('is agent-agnostic: reads OpenAI and Gemini usage shapes too', () => {
    const lines = parseTranscriptJsonl(
      [
        // OpenAI Chat Completions shape (top-level usage)
        JSON.stringify({ usage: { prompt_tokens: 300, completion_tokens: 120 } }),
        // Gemini shape (usageMetadata)
        JSON.stringify({ usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 } }),
      ].join('\n')
    )
    const usage = sumTranscriptUsage(lines)
    expect(usage.tokensIn).toBe(300 + 50)
    expect(usage.tokensOut).toBe(120 + 25)
  })
})
