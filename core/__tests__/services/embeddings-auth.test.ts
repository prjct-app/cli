/**
 * buildEmbeddingsRequest — auth/header/query wiring for the OpenAI-compatible
 * embeddings path. Pins that we reach ANY provider, not just Bearer/OpenAI:
 * the default shape (OpenAI/OpenRouter/Ollama), Azure OpenAI (api-key header +
 * api-version query), and arbitrary custom headers.
 */

import { describe, expect, test } from 'bun:test'
import { buildEmbeddingsRequest } from '../../services/embeddings'

function headers(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>
}

describe('buildEmbeddingsRequest', () => {
  test('default: OpenAI/OpenRouter shape — Bearer on authorization', () => {
    const { url, init } = buildEmbeddingsRequest(
      'https://openrouter.ai/api/v1',
      'text-embedding-3-small',
      ['hi'],
      'sk-or-v1-abc'
    )
    expect(url).toBe('https://openrouter.ai/api/v1/embeddings')
    expect(headers(init).authorization).toBe('Bearer sk-or-v1-abc')
    expect(headers(init)['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'text-embedding-3-small',
      input: ['hi'],
    })
  })

  test('trailing slashes on baseUrl are normalized', () => {
    const { url } = buildEmbeddingsRequest('https://api.openai.com/v1///', 'm', ['x'], 'k')
    expect(url).toBe('https://api.openai.com/v1/embeddings')
  })

  test('Azure OpenAI: api-key header (no scheme) + api-version query', () => {
    const { url, init } = buildEmbeddingsRequest(
      'https://res.openai.azure.com/openai/deployments/embed',
      'text-embedding-3-small',
      ['hi'],
      'AZURE_KEY',
      { authHeader: 'api-key', authScheme: '', query: 'api-version=2023-05-15' }
    )
    expect(url).toBe(
      'https://res.openai.azure.com/openai/deployments/embed/embeddings?api-version=2023-05-15'
    )
    expect(headers(init)['api-key']).toBe('AZURE_KEY')
    // No Bearer / authorization header when a custom scheme-less header is used.
    expect(headers(init).authorization).toBeUndefined()
  })

  test('leading ? on query is tolerated', () => {
    const { url } = buildEmbeddingsRequest('https://x/v1', 'm', ['x'], 'k', {
      query: '?api-version=2024-02-01',
    })
    expect(url).toBe('https://x/v1/embeddings?api-version=2024-02-01')
  })

  test('custom header name with a scheme', () => {
    const { init } = buildEmbeddingsRequest('https://x/v1', 'm', ['x'], 'k', {
      authHeader: 'x-api-key',
      authScheme: 'Token',
    })
    expect(headers(init)['x-api-key']).toBe('Token k')
  })

  test('extra static headers are merged', () => {
    const { init } = buildEmbeddingsRequest('https://x/v1', 'm', ['x'], 'k', {
      extraHeaders: { 'HTTP-Referer': 'https://prjct.app', 'X-Title': 'prjct' },
    })
    expect(headers(init)['HTTP-Referer']).toBe('https://prjct.app')
    expect(headers(init)['X-Title']).toBe('prjct')
    expect(headers(init).authorization).toBe('Bearer k') // default auth still applied
  })

  test('no key → no auth header (e.g. local Ollama)', () => {
    const { init } = buildEmbeddingsRequest(
      'http://localhost:11434/v1',
      'nomic-embed-text',
      ['x'],
      null
    )
    expect(headers(init).authorization).toBeUndefined()
    expect(headers(init)['content-type']).toBe('application/json')
  })
})
