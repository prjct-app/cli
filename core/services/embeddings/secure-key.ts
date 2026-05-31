/**
 * Secure storage for the BYOT embeddings API key.
 *
 * The key is a secret, so it never lands in `global.json` (plaintext). Order
 * of resolution, most-trusted first:
 *   1. `PRJCT_EMBEDDINGS_API_KEY` env var — CI / ephemeral override.
 *   2. macOS Keychain (`security` CLI) — the secure store on the user's Mac.
 *   3. `~/.prjct-cli/config/embeddings.key`, perms 0600 — non-mac fallback.
 *
 * Stored GLOBALLY (one key for every project), not per-project. The resolved
 * value is cached for the process so HttpEmbeddingProvider.embed() doesn't
 * re-shell to Keychain on every call.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Env override — also re-exported from the embeddings index for back-compat. */
export const EMBEDDINGS_API_KEY_ENV = 'PRJCT_EMBEDDINGS_API_KEY'

const KEYCHAIN_SERVICE = 'prjct-embeddings'
const KEYCHAIN_ACCOUNT = 'prjct'
const KEY_FILE = path.join(os.homedir(), '.prjct-cli', 'config', 'embeddings.key')

// undefined = not yet resolved; null = resolved-and-absent.
let cached: string | null | undefined

function isDarwin(): boolean {
  return process.platform === 'darwin'
}

async function readKeychain(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
      '-w',
    ])
    const v = stdout.trim()
    return v || null
  } catch {
    return null
  }
}

function readFileKey(): string | null {
  try {
    const v = fs.readFileSync(KEY_FILE, 'utf-8').trim()
    return v || null
  } catch {
    return null
  }
}

/** Resolve the key (env → Keychain → file), cached for the process. */
export async function getEmbeddingsKey(): Promise<string | null> {
  if (cached !== undefined) return cached
  const env = process.env[EMBEDDINGS_API_KEY_ENV]?.trim()
  if (env) {
    cached = env
    return cached
  }
  cached = (isDarwin() ? await readKeychain() : null) ?? readFileKey()
  return cached
}

/** Where the key lives, for status output (never prints the value). */
export type KeyLocation = 'env' | 'keychain' | 'file' | 'none'

export async function getKeyLocation(): Promise<KeyLocation> {
  if (process.env[EMBEDDINGS_API_KEY_ENV]?.trim()) return 'env'
  if (isDarwin() && (await readKeychain())) return 'keychain'
  if (readFileKey()) return 'file'
  return 'none'
}

/** Persist the key to the most secure store available. Returns where it went. */
export async function setEmbeddingsKey(value: string): Promise<'keychain' | 'file'> {
  const key = value.trim()
  cached = key
  if (isDarwin()) {
    try {
      // -U updates an existing item instead of erroring on duplicate.
      await execFileAsync('security', [
        'add-generic-password',
        '-U',
        '-a',
        KEYCHAIN_ACCOUNT,
        '-s',
        KEYCHAIN_SERVICE,
        '-w',
        key,
      ])
      return 'keychain'
    } catch {
      // Keychain unavailable (locked, headless) → fall through to file.
    }
  }
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 })
  try {
    fs.chmodSync(KEY_FILE, 0o600)
  } catch {
    /* best-effort on platforms without POSIX perms */
  }
  return 'file'
}

/** Remove the key from every store. */
export async function clearEmbeddingsKey(): Promise<void> {
  cached = null
  if (isDarwin()) {
    try {
      await execFileAsync('security', [
        'delete-generic-password',
        '-a',
        KEYCHAIN_ACCOUNT,
        '-s',
        KEYCHAIN_SERVICE,
      ])
    } catch {
      /* not present */
    }
  }
  try {
    fs.rmSync(KEY_FILE)
  } catch {
    /* not present */
  }
}

/** Test seam — reset the process cache. */
export function _resetKeyCache(): void {
  cached = undefined
}
