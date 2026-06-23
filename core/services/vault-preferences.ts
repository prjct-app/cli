/**
 * Vault location preferences.
 *
 * `prjct setup` owns the user's global vault-root choice. Project-specific
 * `vaultPath` still wins when present; `PRJCT_VAULT_ROOT` remains the highest
 * automation/test override so CI never writes to the real Documents folder.
 */

import fs from 'node:fs'
import path from 'node:path'
import { resolveUserHome } from '../infrastructure/user-home'
import { getConfig, setConfig, unsetConfig } from './global-config'

export const VAULT_ROOT_CONFIG_KEY = 'vault-root'

export function getConfiguredVaultRoot(): string | undefined {
  const value = getConfig(VAULT_ROOT_CONFIG_KEY)
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function setConfiguredVaultRoot(value: string): string {
  const resolved = resolveVaultRootInput(value)
  setConfig(VAULT_ROOT_CONFIG_KEY, resolved)
  return resolved
}

export function unsetConfiguredVaultRoot(): void {
  unsetConfig(VAULT_ROOT_CONFIG_KEY)
}

export function resolveVaultRootInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Vault root cannot be empty')
  if (trimmed === '~') return resolveUserHome()
  if (trimmed.startsWith(`~${path.sep}`) || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.resolve(resolveUserHome(), trimmed.slice(2))
  }
  return path.resolve(trimmed)
}

export function getDefaultVaultRoot(): string {
  return path.join(resolveDocumentsDir(), 'prjct')
}

export function resolveVaultRoot(): string {
  const env = process.env.PRJCT_VAULT_ROOT?.trim()
  if (env) return resolveVaultRootInput(env)
  const configured = getConfiguredVaultRoot()
  if (configured) return resolveVaultRootInput(configured)
  return getDefaultVaultRoot()
}

function resolveDocumentsDir(): string {
  const home = resolveUserHome()
  if (process.platform === 'linux') {
    const xdg = readXdgDocumentsDir(home)
    if (xdg) return xdg
  }
  return path.join(home, 'Documents')
}

function readXdgDocumentsDir(home: string): string | undefined {
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || path.join(home, '.config')
  const file = path.join(configHome, 'user-dirs.dirs')
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const match = raw.match(/^XDG_DOCUMENTS_DIR=(['"])(.+)\1/m)
    if (!match) return undefined
    const expanded = match[2].replace(/^\$HOME(?=\/|$)/, home)
    return path.resolve(expanded)
  } catch {
    return undefined
  }
}
