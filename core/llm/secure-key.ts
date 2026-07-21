/**
 * Secure storage for owned-loop LLM API keys — one key per profile name.
 *
 * Resolution order for getLlmKey(profile, { isActive }):
 *   1. `PRJCT_LLM_API_KEY_<PROFILE>` env (PROFILE = name uppercased, - → _)
 *   2. `PRJCT_LLM_API_KEY` env — ONLY when resolving the active profile
 *      (CI / single-brain). Never applied to a non-active named profile.
 *   3. macOS Keychain service `prjct-llm` account `<profile>`
 *   4. `~/.prjct-cli/config/llm-keys/<profile>.key` (0600)
 *
 * Never stores keys in global.json. Guest mode / embeddings keys are separate.
 */

import fs from 'node:fs'
import path from 'node:path'
import { resolveCliHome } from '../infrastructure/cli-home'
import { execFileAsync } from '../utils/exec'
import { slugifyProfileName } from './detect'

export const LLM_API_KEY_ENV = 'PRJCT_LLM_API_KEY'

const KEYCHAIN_SERVICE = 'prjct-llm'
/** Placeholder stored for local runtimes that accept any key. Not a real secret. */
export const LOCAL_DUMMY_KEY = 'ollama'

function isDarwin(): boolean {
  return process.platform === 'darwin'
}

/** Tests / CI: never touch the real Keychain (security(1) can hang on UI prompts). */
function preferFileStore(): boolean {
  return process.env.PRJCT_TEST_MODE === '1' || process.env.PRJCT_LLM_FORCE_FILE === '1'
}

function keyDir(): string {
  return path.join(resolveCliHome(), 'config', 'llm-keys')
}

function keyFilePath(profile: string): string {
  const safe = slugifyProfileName(profile)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 64)
  return path.join(keyDir(), `${safe}.key`)
}

/** Env var name for a per-profile key override. */
export function profileKeyEnvName(profile: string): string {
  const slug = slugifyProfileName(profile).toUpperCase().replace(/-/g, '_')
  return `${LLM_API_KEY_ENV}_${slug}`
}

// Cache: profile → key | null. Env is re-checked each call (not cached).
const storeCache = new Map<string, string | null>()

async function readKeychain(profile: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a',
      profile,
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

function readFileKey(profile: string): string | null {
  try {
    const v = fs.readFileSync(keyFilePath(profile), 'utf-8').trim()
    return v || null
  } catch {
    return null
  }
}

export interface GetLlmKeyOpts {
  /**
   * When true, `PRJCT_LLM_API_KEY` (global) may supply the key.
   * When false/omitted, only per-profile env + store apply — prevents
   * cross-profile key bleed when multiple brains are configured.
   */
  isActive?: boolean
}

/**
 * Resolve key for a profile.
 * Env vars always win over store; global env only for the active profile.
 */
export async function getLlmKey(profile: string, opts: GetLlmKeyOpts = {}): Promise<string | null> {
  const name = slugifyProfileName(profile)

  const perProfile = process.env[profileKeyEnvName(name)]?.trim()
  if (perProfile) return perProfile

  if (opts.isActive) {
    const global = process.env[LLM_API_KEY_ENV]?.trim()
    if (global) return global
  }

  if (storeCache.has(name)) return storeCache.get(name) ?? null

  const v =
    (!preferFileStore() && isDarwin() ? await readKeychain(name) : null) ?? readFileKey(name)
  storeCache.set(name, v)
  return v
}

export type LlmKeyLocation = 'env-profile' | 'env' | 'keychain' | 'file' | 'none' | 'dummy'

export async function getLlmKeyLocation(
  profile: string,
  opts: GetLlmKeyOpts = {}
): Promise<LlmKeyLocation> {
  const name = slugifyProfileName(profile)

  if (process.env[profileKeyEnvName(name)]?.trim()) return 'env-profile'
  if (opts.isActive && process.env[LLM_API_KEY_ENV]?.trim()) return 'env'
  if (!preferFileStore() && isDarwin() && (await readKeychain(name))) return 'keychain'
  const file = readFileKey(name)
  if (file) return file === LOCAL_DUMMY_KEY ? 'dummy' : 'file'
  return 'none'
}

/** Persist key for a profile. Returns where it was stored. */
export async function setLlmKey(profile: string, value: string): Promise<'keychain' | 'file'> {
  const name = slugifyProfileName(profile)
  const key = value.trim()
  if (!key) throw new Error('API key must not be empty')
  storeCache.set(name, key)

  if (!preferFileStore() && isDarwin()) {
    try {
      await execFileAsync('security', [
        'add-generic-password',
        '-U',
        '-a',
        name,
        '-s',
        KEYCHAIN_SERVICE,
        '-w',
        key,
      ])
      return 'keychain'
    } catch {
      // fall through to file
    }
  }

  fs.mkdirSync(keyDir(), { recursive: true, mode: 0o700 })
  const file = keyFilePath(name)
  fs.writeFileSync(file, `${key}\n`, { mode: 0o600 })
  try {
    fs.chmodSync(file, 0o600)
  } catch {
    /* best effort */
  }
  return 'file'
}

/** Remove key for a profile from keychain + file. */
export async function clearLlmKey(profile: string): Promise<void> {
  const name = slugifyProfileName(profile)
  storeCache.delete(name)
  if (!preferFileStore() && isDarwin()) {
    try {
      await execFileAsync('security', [
        'delete-generic-password',
        '-a',
        name,
        '-s',
        KEYCHAIN_SERVICE,
      ])
    } catch {
      /* absent is fine */
    }
  }
  try {
    fs.unlinkSync(keyFilePath(name))
  } catch {
    /* absent is fine */
  }
}

/**
 * Clear keys for every known profile name, plus any orphan files under llm-keys/.
 * Used by `prjct llm clear --all` so secrets never outlive profiles.
 */
export async function clearAllLlmKeys(knownProfiles: string[] = []): Promise<string[]> {
  const cleared = new Set<string>()
  for (const p of knownProfiles) {
    await clearLlmKey(p)
    cleared.add(slugifyProfileName(p))
  }
  // Orphan files (profile removed without clear, or crash mid-way)
  try {
    const dir = keyDir()
    if (fs.existsSync(dir)) {
      for (const ent of fs.readdirSync(dir)) {
        if (!ent.endsWith('.key')) continue
        const slug = ent.replace(/\.key$/, '')
        await clearLlmKey(slug)
        cleared.add(slug)
      }
      // Remove empty dir best-effort
      try {
        fs.rmdirSync(dir)
      } catch {
        /* not empty or busy */
      }
    }
  } catch {
    /* dir absent */
  }
  return [...cleared]
}

export function isDummyKey(key: string | null | undefined): boolean {
  return key === LOCAL_DUMMY_KEY
}

/** Drop process cache (tests). */
export function resetLlmKeyCache(): void {
  storeCache.clear()
}
