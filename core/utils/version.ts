import fs from 'fs'
import path from 'path'

/**
 * Version Manager - Single source of truth for application version
 *
 * Reads version from package.json dynamically to ensure consistency
 * across the entire application.
 */

interface PackageJson {
  version: string
  name?: string
  description?: string
  [key: string]: unknown
}

let cachedVersion: string | null = null
let cachedPackageJson: PackageJson | null = null
let cachedPackageRoot: string | null = null

/**
 * Find the package root by searching up from __dirname for package.json
 * Works whether running from source (core/utils/) or compiled (dist/core/utils/)
 */
export function getPackageRoot(): string {
  if (cachedPackageRoot) {
    return cachedPackageRoot
  }

  let currentDir = __dirname

  // Search up to 5 levels up for package.json with name "prjct-cli"
  for (let i = 0; i < 5; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        if (pkg.name === 'prjct-cli') {
          cachedPackageRoot = currentDir
          return currentDir
        }
      } catch (_error) {
        // Continue searching
      }
    }
    currentDir = path.dirname(currentDir)
  }

  // Fallback: assume 3 levels up from __dirname (works for dist/core/utils/)
  cachedPackageRoot = path.join(__dirname, '..', '..', '..')
  return cachedPackageRoot
}

/**
 * Get the current application version from package.json
 */
export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  try {
    const packageJsonPath = path.join(getPackageRoot(), 'package.json')
    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    cachedVersion = packageJson.version
    cachedPackageJson = packageJson
    return cachedVersion
  } catch (error) {
    console.error('Failed to read version from package.json:', (error as Error).message)
    return '0.0.0'
  }
}

/**
 * Get the full package.json object
 */
export function getPackageInfo(): PackageJson | null {
  if (!cachedPackageJson) {
    getVersion()
  }
  return cachedPackageJson
}

/**
 * Compare two semantic version strings
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

/**
 * Check if a config version is compatible with current version
 */
export function isCompatible(configVersion: string): boolean {
  const current = getVersion()
  const [currentMajor, currentMinor] = current.split('.').map(Number)
  const [configMajor, configMinor] = configVersion.split('.').map(Number)

  return currentMajor === configMajor && currentMinor === configMinor
}

/**
 * Check if migration is needed based on version comparison
 */
export function needsMigration(fromVersion: string, toVersion: string | null = null): boolean {
  const target = toVersion || getVersion()
  return compareVersions(fromVersion, target) < 0
}

export const VERSION = getVersion()
export const PACKAGE_ROOT = getPackageRoot()

// Default export for CommonJS compatibility
export default {
  getVersion,
  getPackageRoot,
  getPackageInfo,
  compareVersions,
  isCompatible,
  needsMigration,
  VERSION,
  PACKAGE_ROOT
}
