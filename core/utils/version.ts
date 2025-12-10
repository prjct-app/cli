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

/**
 * Get the current application version from package.json
 */
export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  try {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json')
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

// Default export for CommonJS compatibility
export default {
  getVersion,
  getPackageInfo,
  compareVersions,
  isCompatible,
  needsMigration,
  VERSION
}
