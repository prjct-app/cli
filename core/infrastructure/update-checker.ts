/**
 * UpdateChecker - Checks for package updates from npm registry
 *
 * @version 0.5.0
 */

import fs from 'node:fs/promises'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { getErrorMessage } from '../types/fs'
import { fileExists } from '../utils/fs-helpers'

interface UpdateCache {
  lastCheck: number
  latestVersion: string
}

interface UpdateResult {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
}

class UpdateChecker {
  packageName: string
  cacheDir: string
  cacheFile: string
  checkInterval: number

  constructor() {
    this.packageName = 'prjct-cli'
    this.cacheDir = path.join(os.homedir(), '.prjct-cli', 'config')
    this.cacheFile = path.join(this.cacheDir, 'update-cache.json')
    this.checkInterval = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  }

  /**
   * Get current installed version from package.json
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
      return packageJson.version
    } catch (error) {
      console.error('Error reading package version:', getErrorMessage(error))
      return null
    }
  }

  /**
   * Fetch latest version from npm registry
   */
  async getLatestVersion(): Promise<string> {
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
  compareVersions(v1: string, v2: string): number {
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
  async readCache(): Promise<UpdateCache | null> {
    try {
      if (await fileExists(this.cacheFile)) {
        const cache = JSON.parse(await fs.readFile(this.cacheFile, 'utf8'))
        return cache
      }
    } catch (_error) {
      // Cache file doesn't exist or is corrupted - expected
    }
    return null
  }

  /**
   * Write cache file
   */
  async writeCache(data: UpdateCache): Promise<void> {
    try {
      // Ensure cache directory exists
      if (!(await fileExists(this.cacheDir))) {
        await fs.mkdir(this.cacheDir, { recursive: true })
      }

      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf8')
    } catch (_error) {
      // Fail silently - cache is not critical
    }
  }

  /**
   * Check if update is available (respects 24-hour cache)
   * Returns: { updateAvailable: boolean, currentVersion: string, latestVersion: string } or null
   */
  async checkForUpdates(): Promise<UpdateResult | null> {
    try {
      const currentVersion = await this.getCurrentVersion()
      if (!currentVersion) {
        return null
      }

      // Check cache first
      const cache = await this.readCache()
      const now = Date.now()

      if (cache?.lastCheck && now - cache.lastCheck < this.checkInterval) {
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
      await this.writeCache({
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
    } catch (_error) {
      // Network error or other issue - fail silently (expected)
      // Return null to indicate check couldn't be performed
      return null
    }
  }

  /**
   * Get formatted update notification message
   */
  async getUpdateNotification(): Promise<string | null> {
    const result = await this.checkForUpdates()

    if (!result || !result.updateAvailable) {
      return null
    }

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

export default UpdateChecker
export { UpdateChecker }
