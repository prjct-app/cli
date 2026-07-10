/**
 * PKCE S256 helpers for CLI browser login (flow=pkce-v1).
 *
 * Verifier/state live only in process memory for the duration of one
 * `prjct login` attempt — never written to disk or logged.
 */

import { createHash, randomBytes } from 'node:crypto'

export const CLI_PKCE_FLOW = 'pkce-v1' as const

/** RFC 7636 unreserved charset for code_verifier. */
const VERIFIER_BYTES = 32

export interface PkceMaterial {
  /** Random state bound into the authorization + callback. */
  state: string
  /** High-entropy verifier retained only in memory until exchange. */
  codeVerifier: string
  /** S256 challenge sent to the browser/app (never the verifier). */
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

export function base64Url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Cryptographically random PKCE verifier + S256 challenge + state. */
export function generatePkceMaterial(): PkceMaterial {
  const codeVerifier = base64Url(randomBytes(VERIFIER_BYTES))
  const state = base64Url(randomBytes(VERIFIER_BYTES))
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier, 'ascii').digest())
  return {
    state,
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  }
}

/** Build the SPA login URL query — never includes secrets or the verifier. */
export function buildCliLoginSearchParams(input: {
  port: number
  deviceId: string
  hostname: string
  state: string
  codeChallenge: string
}): URLSearchParams {
  return new URLSearchParams({
    flow: CLI_PKCE_FLOW,
    port: String(input.port),
    device_id: input.deviceId,
    hostname: input.hostname,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  })
}

export type CallbackParse =
  | { ok: true; code: string; state: string }
  | { ok: false; reason: 'legacy-bearer' | 'missing' | 'mismatch'; message: string }

/**
 * Parse the loopback callback. Accepts only `code` + `state`.
 * Legacy bearer `key=` is rejected without closing semantics decided by caller.
 */
export function parsePkceCallback(
  searchParams: URLSearchParams,
  expectedState: string
): CallbackParse {
  const legacyKey = searchParams.get('key')
  if (legacyKey) {
    return {
      ok: false,
      reason: 'legacy-bearer',
      message:
        'This CLI requires PKCE login. Update the web app or set flow=pkce-v1; bearer tokens in the callback URL are no longer accepted.',
    }
  }
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) {
    return {
      ok: false,
      reason: 'missing',
      message: 'Missing authorization code or state in callback',
    }
  }
  if (state !== expectedState) {
    return {
      ok: false,
      reason: 'mismatch',
      message: 'Login state mismatch — try `prjct login` again',
    }
  }
  return { ok: true, code, state }
}

export interface ExchangeBody {
  flow: typeof CLI_PKCE_FLOW
  code: string
  state: string
  code_verifier: string
  device_id: string
  redirect_uri: string
}

export function buildExchangeBody(input: {
  code: string
  state: string
  codeVerifier: string
  deviceId: string
  port: number
}): ExchangeBody {
  return {
    flow: CLI_PKCE_FLOW,
    code: input.code,
    state: input.state,
    code_verifier: input.codeVerifier,
    device_id: input.deviceId,
    redirect_uri: `http://127.0.0.1:${input.port}/callback`,
  }
}

export interface MintedKeyResponse {
  apiKey: string
  userId: string
  email: string
  deviceId: string
}

/** Normalize camelCase / snake_case exchange JSON. */
export function parseMintedKeyResponse(raw: unknown): MintedKeyResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const apiKey = (o.apiKey ?? o.api_key) as string | undefined
  const userId = (o.userId ?? o.user_id) as string | undefined
  const email = o.email as string | undefined
  const deviceId = (o.deviceId ?? o.device_id) as string | undefined
  if (!apiKey || !userId || !email || !deviceId) return null
  return { apiKey, userId, email, deviceId }
}
