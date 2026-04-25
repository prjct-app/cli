/**
 * Obsidian vault bootstrap + auto-register.
 *
 * Obsidian refuses to open arbitrary folders via the `obsidian://open`
 * URL scheme — a folder is only a "known vault" if:
 *   1. It contains a `.obsidian/` directory (Obsidian treats the folder
 *      as already-initialized and skips its trust prompt).
 *   2. It's registered in Obsidian's global vault list at
 *      `<config>/obsidian/obsidian.json` (the app's in-memory list
 *      derives from this file).
 *
 * This module does both so the vault we generate is one click away
 * from being usable. Obsidian still needs a restart after first
 * registration to notice the new entry — we print that hint.
 *
 * Graceful by design: if Obsidian isn't installed (no config dir) we
 * skip registry without erroring.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

interface ObsidianRegistrationResult {
  bootstrapped: boolean
  registered: boolean
  vaultName: string
  openUrl: string
  obsidianConfigFound: boolean
  alreadyRegistered: boolean
}

/**
 * Ensure a folder is a minimally-initialized Obsidian vault and is
 * listed in the user's global Obsidian vault registry. Idempotent:
 * safe to call on every wiki regen.
 *
 * Never throws on Obsidian-related failures — the vault directory is
 * the source of truth; registry is a convenience.
 */
export async function ensureObsidianVault(vaultPath: string): Promise<ObsidianRegistrationResult> {
  const bootstrapped = await bootstrapObsidianDir(vaultPath)
  const vaultName = path.basename(vaultPath)
  const openUrl = `obsidian://open?vault=${encodeURIComponent(vaultName)}`

  const configPath = resolveObsidianConfigPath()
  if (!configPath) {
    return {
      bootstrapped,
      registered: false,
      vaultName,
      openUrl,
      obsidianConfigFound: false,
      alreadyRegistered: false,
    }
  }

  const { registered, alreadyRegistered } = await registerVaultInObsidianConfig(
    configPath,
    vaultPath
  )

  return {
    bootstrapped,
    registered,
    vaultName,
    openUrl,
    obsidianConfigFound: true,
    alreadyRegistered,
  }
}

/**
 * Platform-aware location of Obsidian's config file.
 *   macOS:   ~/Library/Application Support/obsidian/obsidian.json
 *   Linux:   ~/.config/obsidian/obsidian.json  (or $XDG_CONFIG_HOME)
 *   Windows: %APPDATA%\obsidian\obsidian.json
 * Returns null if the Obsidian config dir doesn't exist — Obsidian
 * hasn't been launched on this machine, or isn't installed at all.
 *
 * `PRJCT_OBSIDIAN_CONFIG_DIR` takes precedence on all platforms so
 * tests can sandbox the config dir without touching the user's real
 * Obsidian install.
 */
export function resolveObsidianConfigPath(): string | null {
  const home = os.homedir()
  let configDir: string
  const envOverride = process.env.PRJCT_OBSIDIAN_CONFIG_DIR?.trim()
  if (envOverride) {
    configDir = envOverride
  } else {
    switch (process.platform) {
      case 'darwin':
        configDir = path.join(home, 'Library', 'Application Support', 'obsidian')
        break
      case 'win32':
        configDir = path.join(
          process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
          'obsidian'
        )
        break
      default:
        configDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'obsidian')
        break
    }
  }

  // best-effort sync check — we can't use async here since callers
  // resolve this in hot paths; fs.existsSync is cheap.
  try {
    if (!require('node:fs').existsSync(configDir)) return null
  } catch {
    return null
  }
  return path.join(configDir, 'obsidian.json')
}

/**
 * Create a minimal `.obsidian/` inside the vault so Obsidian treats the
 * folder as initialized. Returns true if we created it, false if it
 * already existed.
 */
async function bootstrapObsidianDir(vaultPath: string): Promise<boolean> {
  const obsidianDir = path.join(vaultPath, '.obsidian')
  const appJson = path.join(obsidianDir, 'app.json')
  try {
    await fs.stat(appJson)
    return false
  } catch {
    // fall through to create
  }
  await fs.mkdir(obsidianDir, { recursive: true })
  await fs.writeFile(appJson, `${JSON.stringify({}, null, 2)}\n`, 'utf-8')
  return true
}

interface ObsidianConfig {
  vaults?: Record<string, { path: string; ts?: number; open?: boolean }>
  [key: string]: unknown
}

async function registerVaultInObsidianConfig(
  configPath: string,
  vaultPath: string
): Promise<{ registered: boolean; alreadyRegistered: boolean }> {
  let config: ObsidianConfig = {}
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    config = JSON.parse(raw) as ObsidianConfig
  } catch {
    // no prior config — we'll write a fresh one below
  }

  const vaults = config.vaults ?? {}
  const normalized = path.resolve(vaultPath)

  // Already registered (by path)? Skip.
  for (const v of Object.values(vaults)) {
    if (path.resolve(v.path) === normalized) {
      return { registered: false, alreadyRegistered: true }
    }
  }

  const id = crypto.randomBytes(8).toString('hex')
  vaults[id] = { path: normalized, ts: Date.now() }
  const next: ObsidianConfig = { ...config, vaults }

  try {
    await fs.writeFile(configPath, JSON.stringify(next), 'utf-8')
    return { registered: true, alreadyRegistered: false }
  } catch {
    return { registered: false, alreadyRegistered: false }
  }
}
