/**
 * Secure embeddings-key resolution — the env tier (deterministic, no Keychain
 * / filesystem side effects). The Keychain + file tiers are exercised live;
 * here we pin the precedence (env wins) and the per-process cache contract.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  _resetKeyCache,
  EMBEDDINGS_API_KEY_ENV,
  getEmbeddingsKey,
  getKeyLocation,
} from '../../services/embeddings/secure-key'

const original = process.env[EMBEDDINGS_API_KEY_ENV]

beforeEach(() => {
  _resetKeyCache()
})

afterEach(() => {
  if (original === undefined) delete process.env[EMBEDDINGS_API_KEY_ENV]
  else process.env[EMBEDDINGS_API_KEY_ENV] = original
  _resetKeyCache()
})

describe('secure-key — env tier', () => {
  it('resolves the key from the env var', async () => {
    process.env[EMBEDDINGS_API_KEY_ENV] = 'sk-from-env'
    expect(await getEmbeddingsKey()).toBe('sk-from-env')
  })

  it('reports the env location when the env var is set', async () => {
    process.env[EMBEDDINGS_API_KEY_ENV] = 'sk-from-env'
    expect(await getKeyLocation()).toBe('env')
  })

  it('env takes precedence and the value is cached for the process', async () => {
    process.env[EMBEDDINGS_API_KEY_ENV] = 'sk-first'
    expect(await getEmbeddingsKey()).toBe('sk-first')
    // Changing the env WITHOUT resetting the cache keeps the first value.
    process.env[EMBEDDINGS_API_KEY_ENV] = 'sk-second'
    expect(await getEmbeddingsKey()).toBe('sk-first')
    // After an explicit reset, the new value resolves.
    _resetKeyCache()
    expect(await getEmbeddingsKey()).toBe('sk-second')
  })

  it('trims surrounding whitespace from the env value', async () => {
    process.env[EMBEDDINGS_API_KEY_ENV] = '  sk-padded  '
    expect(await getEmbeddingsKey()).toBe('sk-padded')
  })
})
