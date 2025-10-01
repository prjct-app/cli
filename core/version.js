const fs = require('fs')
const path = require('path')

/**
 * Version Manager - Single source of truth for application version
 *
 * Reads version from package.json dynamically to ensure consistency
 * across the entire application.
 *
 * @module version
 */

let cachedVersion = null
let cachedPackageJson = null

/**
 * Get the current application version from package.json
 *
 * @returns {string} - Semantic version string (e.g., "0.2.1")
 */
function getVersion() {
  if (cachedVersion) {
    return cachedVersion
  }

  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    cachedVersion = packageJson.version
    cachedPackageJson = packageJson
    return cachedVersion
  } catch (error) {
    console.error('Failed to read version from package.json:', error.message)
    return '0.0.0' // Fallback version
  }
}

/**
 * Get the full package.json object
 *
 * @returns {Object} - Package.json contents
 */
function getPackageInfo() {
  if (!cachedPackageJson) {
    getVersion() // This will populate cachedPackageJson
  }
  return cachedPackageJson
}

/**
 * Compare two semantic version strings
 *
 * @param {string} v1 - First version (e.g., "0.2.1")
 * @param {string} v2 - Second version (e.g., "0.2.0")
 * @returns {number} - Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
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
 *
 * @param {string} configVersion - Version from config file
 * @returns {boolean} - True if compatible
 */
function isCompatible(configVersion) {
  const current = getVersion()
  const [currentMajor, currentMinor] = current.split('.').map(Number)
  const [configMajor, configMinor] = configVersion.split('.').map(Number)

  // Same major and minor version = compatible
  return currentMajor === configMajor && currentMinor === configMinor
}

/**
 * Check if migration is needed based on version comparison
 *
 * @param {string} fromVersion - Current config version
 * @param {string} toVersion - Target version (defaults to current)
 * @returns {boolean} - True if migration needed
 */
function needsMigration(fromVersion, toVersion = null) {
  const target = toVersion || getVersion()
  return compareVersions(fromVersion, target) < 0
}

// Export version as constant for convenience
const VERSION = getVersion()

module.exports = {
  VERSION,
  getVersion,
  getPackageInfo,
  compareVersions,
  isCompatible,
  needsMigration
}
