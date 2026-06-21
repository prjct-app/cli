/**
 * buildEmbeddingsRequest — auth/header/query wiring for the OpenAI-compatible
 * embeddings path. Pins that we reach ANY provider, not just Bearer/OpenAI:
 * the default shape (OpenAI/OpenRouter/Ollama), Azure OpenAI (api-key header +
 * api-version query), and arbitrary custom headers.
 */

import { describe, expect, test } from 'bun:test'
import { buildEmbeddingsRequest } from '../../services/embeddings'
import { normalizeModelForBaseUrl } from '../../services/embeddings/global'

function headers(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>
}

describe('buildEmbeddingsRequest', () => {
  test('default: OpenRouter shape — Bearer auth + model namespaced to openai/', () => {
    const { url, init } = buildEmbeddingsRequest(
      'https://openrouter.ai/api/v1',
      'text-embedding-3-small',
      ['hi'],
      'sk-or-v1-abc'
    )
    expect(url).toBe('https://openrouter.ai/api/v1/embeddings')
    expect(headers(init).authorization).toBe('Bearer sk-or-v1-abc')
    expect(headers(init)['content-type']).toBe('application/json')
    // OpenRouter requires `vendor/model`; the bare id is prefixed on the wire.
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'openai/text-embedding-3-small',
      input: ['hi'],
    })
  })

  test('OpenAI base: bare model is sent as-is (no namespacing)', () => {
    const { init } = buildEmbeddingsRequest(
      'https://api.openai.com/v1',
      'text-embedding-3-small',
      ['hi'],
      'sk-abc'
    )
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'text-embedding-3-small',
      input: ['hi'],
    })
  })

  test('OpenRouter base: an already-namespaced model is left untouched', () => {
    const { init } = buildEmbeddingsRequest(
      'https://openrouter.ai/api/v1',
      'qwen/qwen3-embedding',
      ['hi'],
      'sk-or-v1-abc'
    )
    expect(JSON.parse(init.body as string).model).toBe('qwen/qwen3-embedding')
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

describe('normalizeModelForBaseUrl', () => {
  test('OpenRouter + bare OpenAI id → prefixes openai/', () => {
    expect(normalizeModelForBaseUrl('text-embedding-3-small', 'https://openrouter.ai/api/v1')).toBe(
      'openai/text-embedding-3-small'
    )
  })
  test('OpenRouter + already-namespaced id → unchanged', () => {
    expect(
      normalizeModelForBaseUrl('openai/text-embedding-3-large', 'https://openrouter.ai/api/v1')
    ).toBe('openai/text-embedding-3-large')
  })
  test('non-OpenRouter base → unchanged', () => {
    expect(normalizeModelForBaseUrl('text-embedding-3-small', 'https://api.openai.com/v1')).toBe(
      'text-embedding-3-small'
    )
    expect(normalizeModelForBaseUrl('nomic-embed-text', 'http://localhost:11434/v1')).toBe(
      'nomic-embed-text'
    )
  })
})
