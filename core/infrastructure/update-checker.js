const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')

class UpdateChecker {
  constructor() {
    this.packageName = 'prjct-cli'
    this.cacheDir = path.join(os.homedir(), '.prjct-cli', 'config')
    this.cacheFile = path.join(this.cacheDir, 'update-cache.json')
    this.checkInterval = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  }

  /**
   * Get current installed version from package.json
   */
  getCurrentVersion() {
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      return packageJson.version
    } catch (error) {
      console.error('Error reading package version:', error.message)
      return null
    }
  }

  /**
   * Fetch latest version from npm registry
   */
  async getLatestVersion() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'registry.npmjs.org',
        path: `/${this.packageName}/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'prjct-cli-update-checker',
          Accept: 'application/json',
        },
      }

      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const packageData = JSON.parse(data)
              resolve(packageData.version)
            } else {
              reject(new Error(`npm registry returned status ${res.statusCode}`))
            }
          } catch (error) {
            reject(error)
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.setTimeout(5000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0

      if (part1 > part2) return 1
      if (part1 < part2) return -1
    }

    return 0
  }

  /**
   * Read cache file
   */
  readCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'))
        return cache
      }
    } catch (error) {
      // Cache file doesn't exist or is corrupted, ignore
    }
    return null
  }

  /**
   * Write cache file
   */
  writeCache(data) {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true })
      }

      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      // Fail silently - cache is not critical
    }
  }

  /**
   * Check if update is available (respects 24-hour cache)
   * Returns: { updateAvailable: boolean, currentVersion: string, latestVersion: string } or null
   */
  async checkForUpdates() {
    try {
      const currentVersion = this.getCurrentVersion()
      if (!currentVersion) {
        return null
      }

      // Check cache first
      const cache = this.readCache()
      const now = Date.now()

      if (cache && cache.lastCheck && now - cache.lastCheck < this.checkInterval) {
        // Cache is still valid
        if (cache.latestVersion && this.compareVersions(cache.latestVersion, currentVersion) > 0) {
          return {
            updateAvailable: true,
            currentVersion,
            latestVersion: cache.latestVersion,
          }
        }
        return {
          updateAvailable: false,
          currentVersion,
          latestVersion: currentVersion,
        }
      }

      // Cache expired or doesn't exist, fetch from npm
      const latestVersion = await this.getLatestVersion()

      // Update cache
      this.writeCache({
        lastCheck: now,
        latestVersion,
      })

      // Compare versions
      const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
      }
    } catch (error) {
      // Network error or other issue - fail silently
      // Return null to indicate check couldn't be performed
      return null
    }
  }

  /**
   * Get formatted update notification message
   */
  async getUpdateNotification() {
    const result = await this.checkForUpdates()

    if (!result || !result.updateAvailable) {
      return null
    }

    const chalk = require('chalk')

    return (
      '\n' +
      chalk.yellow('┌───────────────────────────────────────────────────────────┐') +
      '\n' +
      chalk.yellow('│') +
      '  ' +
      chalk.bold('Update available!') +
      ' ' +
      chalk.dim(`${result.currentVersion} → ${result.latestVersion}`) +
      '  ' +
      chalk.yellow('│') +
      '\n' +
      chalk.yellow('│') +
      '                                                           ' +
      chalk.yellow('│') +
      '\n' +
      chalk.yellow('│') +
      '  Run: ' +
      chalk.cyan('npm update -g prjct-cli') +
      '                       ' +
      chalk.yellow('│') +
      '\n' +
      chalk.yellow('└───────────────────────────────────────────────────────────┘') +
      '\n'
    )
  }
}

module.exports = UpdateChecker
