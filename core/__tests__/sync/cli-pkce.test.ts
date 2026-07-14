/**
 * PKCE material + callback parsing for CLI login (flow=pkce-v1).
 */

import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  base64Url,
  buildCliLoginSearchParams,
  buildExchangeBody,
  CLI_PKCE_FLOW,
  generatePkceMaterial,
  parseMintedKeyResponse,
  parsePkceCallback,
} from '../../sync/cli-pkce'

describe('cli-pkce', () => {
  test('generatePkceMaterial produces unique high-entropy fields', () => {
    const a = generatePkceMaterial()
    const b = generatePkceMaterial()
    expect(a.state.length).toBeGreaterThanOrEqual(43)
    expect(a.codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(a.codeChallenge.length).toBe(43)
    expect(a.codeChallengeMethod).toBe('S256')
    expect(a.state).not.toBe(b.state)
    expect(a.codeVerifier).not.toBe(b.codeVerifier)
  })

  test('codeChallenge is S256 of verifier', () => {
    const m = generatePkceMaterial()
    const expected = base64Url(createHash('sha256').update(m.codeVerifier, 'ascii').digest())
    expect(m.codeChallenge).toBe(expected)
  })

  test('buildCliLoginSearchParams never embeds the verifier', () => {
    const m = generatePkceMaterial()
    const q = buildCliLoginSearchParams({
      port: 43123,
      deviceId: 'dev-1',
      hostname: 'mac',
      state: m.state,
      codeChallenge: m.codeChallenge,
    })
    expect(q.get('flow')).toBe(CLI_PKCE_FLOW)
    expect(q.get('code_challenge_method')).toBe('S256')
    expect(q.get('code_challenge')).toBe(m.codeChallenge)
    expect(q.get('state')).toBe(m.state)
    expect(q.toString()).not.toContain(m.codeVerifier)
    expect(q.has('code_verifier')).toBe(false)
  })

  test('parsePkceCallback accepts matching code+state', () => {
    const m = generatePkceMaterial()
    const params = new URLSearchParams({ code: 'auth-code-xyz', state: m.state })
    const parsed = parsePkceCallback(params, m.state)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.code).toBe('auth-code-xyz')
      expect(parsed.state).toBe(m.state)
    }
  })

  test('parsePkceCallback rejects legacy bearer key without consuming success', () => {
    const m = generatePkceMaterial()
    const params = new URLSearchParams({ key: 'pk_live_xxx', state: m.state })
    const parsed = parsePkceCallback(params, m.state)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('legacy-bearer')
  })

  test('parsePkceCallback rejects state mismatch', () => {
    const m = generatePkceMaterial()
    const params = new URLSearchParams({ code: 'c', state: 'wrong-state-value-xxxxxxxxxxxxxxxx' })
    const parsed = parsePkceCallback(params, m.state)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('mismatch')
  })

  test('parsePkceCallback rejects missing fields', () => {
    const m = generatePkceMaterial()
    expect(parsePkceCallback(new URLSearchParams(), m.state).ok).toBe(false)
  })

  test('buildExchangeBody binds loopback redirect_uri to the listening port', () => {
    const body = buildExchangeBody({
      code: 'c',
      state: 's'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      deviceId: 'd',
      port: 9999,
    })
    expect(body.flow).toBe(CLI_PKCE_FLOW)
    expect(body.redirect_uri).toBe('http://127.0.0.1:9999/callback')
    expect(body.code_verifier).toHaveLength(43)
  })

  test('parseMintedKeyResponse accepts camelCase and snake_case', () => {
    expect(
      parseMintedKeyResponse({
        apiKey: 'pk_live_a',
        userId: 'u1',
        email: 'a@b.c',
        deviceId: 'd1',
      })
    ).toEqual({ apiKey: 'pk_live_a', userId: 'u1', email: 'a@b.c', deviceId: 'd1' })
    expect(
      parseMintedKeyResponse({
        api_key: 'pk_live_b',
        user_id: 'u2',
        email: 'c@d.e',
        device_id: 'd2',
      })
    ).toEqual({ apiKey: 'pk_live_b', userId: 'u2', email: 'c@d.e', deviceId: 'd2' })
    expect(parseMintedKeyResponse({})).toBeNull()
  })
})
