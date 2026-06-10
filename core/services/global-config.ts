/**
 * Global config — small typed key/value store at
 * `~/.prjct-cli/config/global.json`. Lets users opt into behaviors
 * (e.g. auto-update) without per-project state.
 *
 * Design: deliberately minimal. No schema versioning, no migrations.
 * Unknown keys are preserved on round-trip so newer/older versions of
 * prjct don't trample each other's settings.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Resolve the config dir at call time. Honors `PRJCT_CLI_HOME` (the same
 * override `system-database.ts` uses) so tests and alt-home installs redirect
 * cleanly. Resolving lazily — not once at module load — matters because tests
 * can't rely on `os.homedir()`: Bun ignores a mutated `process.env.HOME`, so a
 * test that only patched HOME would silently read/write the user's REAL config.
 */
function configDir(): string {
  const override = process.env.PRJCT_CLI_HOME?.trim()
  const base = override ? path.resolve(override) : path.join(os.homedir(), '.prjct-cli')
  return path.join(base, 'config')
}

function configFilePath(): string {
  return path.join(configDir(), 'global.json')
}

type GlobalConfigValue = string | number | boolean

interface GlobalConfig {
  /** Opt into silent self-update (1/hour throttled). Default: false. */
  'auto-update'?: 'on' | 'off'
  /** ISO timestamp of last update check. Internal — set by auto-updater. */
  'auto-update-last-check'?: string
  /** Suppress proactive workflow suggestions in the prompt hook. */
  suggestions?: 'on' | 'off'
  // Free-form bag for forward compat — readers preserve unknown keys.
  [key: string]: GlobalConfigValue | undefined
}

// Parsed-config cache validated by file identity (path + mtime + size).
// `resolveGlobalEmbeddings` calls getConfig 7× per invocation, on every
// Stop hook — each was a readFileSync + JSON.parse. A stat is ~10× cheaper
// and stays correct across processes (a CLI `prjct embeddings set` bumps
// the mtime, so a long-lived daemon picks the change up on its next read).
let _cache: GlobalConfig | null = null
let _cacheStamp = ''

function fileStamp(file: string): string {
  try {
    const st = fs.statSync(file)
    return `${file}|${st.mtimeMs}|${st.size}`
  } catch {
    return `${file}|absent`
  }
}

function readRaw(): GlobalConfig {
  const file = configFilePath()
  const stamp = fileStamp(file)
  if (_cache !== null && stamp === _cacheStamp) return _cache
  let cfg: GlobalConfig = {}
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cfg = parsed as GlobalConfig
  } catch {
    // missing or malformed → start fresh
  }
  _cache = cfg
  _cacheStamp = stamp
  return cfg
}

function writeRaw(cfg: GlobalConfig): void {
  fs.mkdirSync(configDir(), { recursive: true })
  fs.writeFileSync(configFilePath(), `${JSON.stringify(cfg, null, 2)}\n`, 'utf-8')
  _cache = cfg
  _cacheStamp = fileStamp(configFilePath())
}

export function getConfig<K extends keyof GlobalConfig>(key: K): GlobalConfig[K] {
  return readRaw()[key]
}

export function getAll(): GlobalConfig {
  return readRaw()
}

export function setConfig<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): void {
  const cfg = readRaw()
  if (value === undefined) delete cfg[key]
  else cfg[key] = value
  writeRaw(cfg)
}

export function unsetConfig(key: keyof GlobalConfig): void {
  setConfig(key, undefined as GlobalConfig[typeof key])
}

export function configPath(): string {
  return configFilePath()
}
