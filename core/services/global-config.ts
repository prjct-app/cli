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

const CONFIG_DIR = path.join(os.homedir(), '.prjct-cli', 'config')
const CONFIG_PATH = path.join(CONFIG_DIR, 'global.json')

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

function readRaw(): GlobalConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as GlobalConfig
  } catch {
    // missing or malformed → start fresh
  }
  return {}
}

function writeRaw(cfg: GlobalConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`, 'utf-8')
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
  return CONFIG_PATH
}
