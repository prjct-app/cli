/**
 * Package manager detection for `prjct update`.
 *
 * Owns all knowledge about how npm/pnpm/bun/yarn install global packages,
 * how to detect which one launched the running binary, and how to
 * redirect PACKAGE_ROOT to the freshly installed copy after Phase 1.
 */

import { execFileSync, execSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { resetPackageRoot } from '../../utils/version'

export type PkgManagerName = 'npm' | 'pnpm' | 'bun' | 'yarn'

export interface PkgManager {
  name: PkgManagerName
  installArgs: string[]
  /** Returns the path to the directory containing prjct-cli/, or null. */
  getInstallRoot: () => string | null
}

export interface InstalledLocation {
  pm: PkgManager
  version: string
}

const HOME = os.homedir()

export const MANAGERS: Record<PkgManagerName, PkgManager> = {
  npm: {
    name: 'npm',
    installArgs: ['install', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        return execSync('npm root -g', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch {
        return null
      }
    },
  },
  pnpm: {
    name: 'pnpm',
    installArgs: ['add', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        return execSync('pnpm root -g', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch {
        return null
      }
    },
  },
  bun: {
    name: 'bun',
    installArgs: ['add', '-g', 'prjct-cli@latest'],
    getInstallRoot: () => path.join(HOME, '.bun', 'install', 'global', 'node_modules'),
  },
  yarn: {
    name: 'yarn',
    installArgs: ['global', 'add', 'prjct-cli@latest'],
    getInstallRoot: () => {
      try {
        const dir = execSync('yarn global dir', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
        return path.join(dir, 'node_modules')
      } catch {
        return null
      }
    },
  },
}

export function isHomebrewInstall(): boolean {
  try {
    const result = execFileSync('brew', ['list', 'prjct-cli'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return !!result
  } catch {
    return false
  }
}

/** Whether `name` resolves to an executable in the current PATH. */
export function isOnPath(name: PkgManagerName): boolean {
  try {
    execFileSync('which', [name], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Detect which package manager owns the running prjct binary by inspecting
 * its real path. Returns null if no signal is found.
 */
export function detectInstallerFromRunningBinary(): PkgManagerName | null {
  const candidates = [process.argv[1], process.execPath].filter(Boolean) as string[]
  for (const candidate of candidates) {
    let real = candidate
    try {
      real = require('node:fs').realpathSync(candidate)
    } catch {
      // ignore
    }
    if (real.includes('/.bun/install/global') || real.includes('/.bun/bin/')) return 'bun'
    if (real.includes('/Library/pnpm/') || real.includes('/.pnpm/')) return 'pnpm'
    if (real.includes('/.local/share/pnpm/')) return 'pnpm'
    if (real.includes('/.yarn/') || real.includes('/yarn/global')) return 'yarn'
  }
  return null
}

/**
 * Pick the package manager to use for the upgrade.
 * Priority: detected installer (if available on PATH) → first available among
 * bun/pnpm/npm/yarn. Throws if none are available.
 */
export function selectPackageManager(): PkgManager {
  const detected = detectInstallerFromRunningBinary()
  if (detected && isOnPath(detected)) return MANAGERS[detected]

  for (const name of ['bun', 'pnpm', 'npm', 'yarn'] as PkgManagerName[]) {
    if (isOnPath(name)) return MANAGERS[name]
  }
  throw new Error(
    'No supported package manager found in PATH (tried npm, pnpm, bun, yarn). ' +
      'Install one and re-run, or upgrade manually: bun add -g prjct-cli@latest'
  )
}

/**
 * Find every package manager that has prjct-cli installed globally.
 * Returns one entry per manager, with the version read from its package.json.
 * Use this to update all installs (not just the running binary's manager) —
 * users with multiple installs hit PATH-resolution bugs where updating one
 * leaves the other stale and shadowing it.
 */
export function getAllInstalledLocations(): InstalledLocation[] {
  const found: InstalledLocation[] = []
  for (const pm of [MANAGERS.bun, MANAGERS.pnpm, MANAGERS.npm, MANAGERS.yarn]) {
    const root = pm.getInstallRoot()
    if (!root) continue
    const pkgPath = path.join(root, 'prjct-cli', 'package.json')
    try {
      const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'))
      if (pkg?.name === 'prjct-cli' && typeof pkg.version === 'string') {
        found.push({ pm, version: pkg.version })
      }
    } catch {
      // not installed via this manager
    }
  }
  return found
}

/**
 * After Phase 1 installs the new package, redirect PACKAGE_ROOT and the
 * template cache to the INSTALLED copy. Without this the running process
 * keeps using paths from whatever started it (source tree via npm link,
 * old install). Phase 2+3 must operate on the installed files.
 */
export function redirectToInstalledPackage(): void {
  try {
    const { existsSync, realpathSync, readFileSync } = require('node:fs')

    const sourceRoot = (() => {
      try {
        return realpathSync(path.resolve(__dirname, '..', '..', '..'))
      } catch {
        return ''
      }
    })()

    const roots = [
      MANAGERS.bun.getInstallRoot(),
      MANAGERS.pnpm.getInstallRoot(),
      MANAGERS.npm.getInstallRoot(),
      MANAGERS.yarn.getInstallRoot(),
    ].filter((p): p is string => !!p)

    for (const root of roots) {
      const candidate = path.join(root, 'prjct-cli')
      const pkgJsonPath = path.join(candidate, 'package.json')
      if (!existsSync(pkgJsonPath)) continue

      let resolved = candidate
      try {
        resolved = realpathSync(candidate)
      } catch {
        // ignore
      }

      // Skip if the install resolves back to our source tree (e.g. npm link)
      if (sourceRoot && resolved === sourceRoot) continue

      try {
        const pkg = JSON.parse(readFileSync(path.join(resolved, 'package.json'), 'utf-8'))
        if (pkg?.name !== 'prjct-cli') continue
      } catch {
        continue
      }

      resetPackageRoot(resolved)
      const { resetBundle } = require('../../agentic/template-loader')
      resetBundle()
      return
    }
  } catch {
    // Non-blocking: fall through to use current PACKAGE_ROOT
  }
}
