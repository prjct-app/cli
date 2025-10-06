const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

/**
 * Legacy Installer Detector
 *
 * Detects and cleans up legacy curl-based installations from ~/.prjct-cli/
 * These were installed via curl install.sh before v0.8.2 (npm migration)
 *
 * What it does:
 * 1. Detects ~/.prjct-cli/ directory (legacy curl install location)
 * 2. Checks if it's a git repository (legacy indicator)
 * 3. Backs up global projects data to new npm location
 * 4. Removes legacy installation files
 * 5. Preserves user data (projects/ directory)
 * 6. Cleans up legacy PATH entries and symlinks
 *
 * @version 0.8.8
 */

// Colors
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const NC = '\x1b[0m'

class LegacyInstallerDetector {
  constructor() {
    this.legacyInstallDir = path.join(os.homedir(), '.prjct-cli')
    this.npmGlobalProjectsDir = path.join(os.homedir(), '.prjct-cli', 'projects')
    this.isWindows = process.platform === 'win32'
  }

  /**
   * Check if legacy curl installation exists
   * @returns {Promise<boolean>}
   */
  async hasLegacyInstallation() {
    try {
      const stat = await fs.stat(this.legacyInstallDir)
      if (!stat.isDirectory()) return false

      // Check for .git directory (indicates curl install)
      try {
        await fs.access(path.join(this.legacyInstallDir, '.git'))
        return true // Definitely a git clone from curl install
      } catch {
        // No .git, check for other legacy indicators
        const entries = await fs.readdir(this.legacyInstallDir)

        // Legacy has: bin/, core/, templates/, scripts/, package.json
        const legacyFiles = ['bin', 'core', 'templates', 'scripts', 'package.json']
        const hasLegacyFiles = legacyFiles.every(file => entries.includes(file))

        if (hasLegacyFiles) {
          return true // Has legacy structure
        }

        // Only has projects/ and config/ = already migrated
        const onlyDataDirs = entries.every(entry => ['projects', 'config'].includes(entry))
        return !onlyDataDirs
      }
    } catch {
      return false
    }
  }

  /**
   * Get npm global installation path
   * @returns {string}
   */
  getNpmGlobalPath() {
    try {
      const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
      return path.join(npmRoot, 'prjct-cli')
    } catch {
      // Fallback to common locations
      const nodePath = process.execPath
      const nodeDir = path.dirname(path.dirname(nodePath))
      return path.join(nodeDir, 'lib', 'node_modules', 'prjct-cli')
    }
  }

  /**
   * Check if user has npm global installation
   * @returns {Promise<boolean>}
   */
  async hasNpmInstallation() {
    try {
      execSync('npm list -g prjct-cli', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get version of legacy installation
   * @returns {Promise<string|null>}
   */
  async getLegacyVersion() {
    try {
      const packageJsonPath = path.join(this.legacyInstallDir, 'package.json')
      const content = await fs.readFile(packageJsonPath, 'utf8')
      const pkg = JSON.parse(content)
      return pkg.version || 'unknown'
    } catch {
      return null
    }
  }

  /**
   * Migrate projects data from legacy location to npm location
   * Only migrates if projects/ directory exists in legacy location
   * @returns {Promise<{success: boolean, projectsMigrated: number, message: string}>}
   */
  async migrateProjectsData() {
    const result = {
      success: false,
      projectsMigrated: 0,
      message: ''
    }

    try {
      const legacyProjectsDir = path.join(this.legacyInstallDir, 'projects')

      // Check if legacy projects directory exists
      try {
        await fs.access(legacyProjectsDir)
      } catch {
        result.success = true
        result.message = 'No projects data to migrate'
        return result
      }

      // Ensure npm global projects directory exists
      await fs.mkdir(this.npmGlobalProjectsDir, { recursive: true })

      // Read all project directories
      const projectDirs = await fs.readdir(legacyProjectsDir, { withFileTypes: true })

      for (const entry of projectDirs) {
        if (!entry.isDirectory()) continue

        const legacyProjectPath = path.join(legacyProjectsDir, entry.name)
        const npmProjectPath = path.join(this.npmGlobalProjectsDir, entry.name)

        // Check if project already exists in npm location
        try {
          await fs.access(npmProjectPath)
          // Already exists, skip
          continue
        } catch {
          // Doesn't exist, copy it
          await this.copyDirectory(legacyProjectPath, npmProjectPath)
          result.projectsMigrated++
        }
      }

      result.success = true
      result.message = result.projectsMigrated > 0
        ? `Migrated ${result.projectsMigrated} project(s) to npm global location`
        : 'All projects already in npm location'

      return result
    } catch (error) {
      result.message = `Migration failed: ${error.message}`
      return result
    }
  }

  /**
   * Copy directory recursively
   * @private
   */
  async copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true })

    const entries = await fs.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const destPath = path.join(destination, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath)
      } else {
        await fs.copyFile(sourcePath, destPath)
      }
    }
  }

  /**
   * Remove legacy installation files (keep projects data)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async cleanupLegacyInstallation() {
    const result = {
      success: false,
      message: ''
    }

    try {
      // Directories to remove (everything except projects and config)
      const dirsToRemove = ['bin', 'core', 'templates', 'scripts', 'node_modules', '.git', '__tests__', 'website', 'docs', '.github']
      const filesToRemove = [
        'package.json',
        'package-lock.json',
        'README.md',
        'LICENSE',
        'CHANGELOG.md',
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'MIGRATION.md',
        'TESTING.md',
        '.gitignore',
        '.eslintrc.js',
        '.prettierrc',
        'vitest.config.js',
        'vitest.workspace.js'
      ]

      let removedItems = 0

      // Remove directories
      for (const dir of dirsToRemove) {
        const dirPath = path.join(this.legacyInstallDir, dir)
        try {
          await fs.rm(dirPath, { recursive: true, force: true })
          removedItems++
        } catch {
          // Directory doesn't exist, skip
        }
      }

      // Remove files
      for (const file of filesToRemove) {
        const filePath = path.join(this.legacyInstallDir, file)
        try {
          await fs.unlink(filePath)
          removedItems++
        } catch {
          // File doesn't exist, skip
        }
      }

      result.success = true
      result.message = `Removed ${removedItems} legacy installation items`
      return result
    } catch (error) {
      result.message = `Cleanup failed: ${error.message}`
      return result
    }
  }

  /**
   * Get platform-specific shell config files
   * @returns {string[]}
   */
  getShellConfigFiles() {
    if (this.isWindows) {
      // Windows PowerShell profiles
      const profilePaths = []

      // PowerShell 7+ profile
      if (process.env.USERPROFILE) {
        profilePaths.push(
          path.join(process.env.USERPROFILE, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
          path.join(process.env.USERPROFILE, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
        )
      }

      return profilePaths
    } else {
      // Unix/Linux/macOS shell configs
      return [
        path.join(os.homedir(), '.zshrc'),
        path.join(os.homedir(), '.bashrc'),
        path.join(os.homedir(), '.profile'),
        path.join(os.homedir(), '.bash_profile')
      ]
    }
  }

  /**
   * Clean up legacy PATH entries from shell config files
   * @returns {Promise<{success: boolean, message: string, filesModified: number}>}
   */
  async cleanupLegacyPATH() {
    const result = {
      success: false,
      message: '',
      filesModified: 0
    }

    try {
      const shellConfigs = this.getShellConfigFiles()

      for (const configFile of shellConfigs) {
        try {
          const content = await fs.readFile(configFile, 'utf8')

          // Check if file contains legacy PATH entry
          if (!content.includes('.prjct-cli/bin')) {
            continue
          }

          // Remove lines containing .prjct-cli/bin
          const lines = content.split('\n')
          const filteredLines = lines.filter(line => {
            return !line.includes('.prjct-cli/bin') && !line.includes('# prjct/cli')
          })

          // Remove consecutive empty lines
          const cleanedLines = []
          for (let i = 0; i < filteredLines.length; i++) {
            const line = filteredLines[i]
            const prevLine = filteredLines[i - 1]

            // Skip if both current and previous lines are empty
            if (line.trim() === '' && prevLine && prevLine.trim() === '') {
              continue
            }

            cleanedLines.push(line)
          }

          // Write back
          await fs.writeFile(configFile, cleanedLines.join('\n'), 'utf8')
          result.filesModified++
        } catch {
          // File doesn't exist or can't read, skip
        }
      }

      result.success = true
      result.message = result.filesModified > 0
        ? `Cleaned PATH from ${result.filesModified} shell config(s)`
        : 'No legacy PATH entries found'

      return result
    } catch (error) {
      result.message = `PATH cleanup failed: ${error.message}`
      return result
    }
  }

  /**
   * Clean up legacy symlinks
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async cleanupLegacySymlinks() {
    const result = {
      success: false,
      message: ''
    }

    // Skip on Windows (no .local/bin)
    if (this.isWindows) {
      result.success = true
      result.message = 'No symlinks on Windows'
      return result
    }

    try {
      const symlinkPath = path.join(os.homedir(), '.local', 'bin', 'prjct')

      try {
        const stat = await fs.lstat(symlinkPath)

        if (stat.isSymbolicLink()) {
          const target = await fs.readlink(symlinkPath)

          // Only remove if it points to legacy location
          if (target.includes('.prjct-cli')) {
            await fs.unlink(symlinkPath)
            result.success = true
            result.message = 'Removed legacy symlink'
            return result
          }
        }
      } catch {
        // Symlink doesn't exist
      }

      result.success = true
      result.message = 'No legacy symlinks found'
      return result
    } catch (error) {
      result.message = `Symlink cleanup failed: ${error.message}`
      return result
    }
  }

  /**
   * Perform complete legacy cleanup
   * @param {Object} options
   * @param {boolean} options.verbose - Show detailed output
   * @returns {Promise<Object>}
   */
  async performCleanup(options = {}) {
    const { verbose = true } = options

    const report = {
      success: false,
      legacyVersion: null,
      hasNpm: false,
      steps: {
        projectsMigrated: 0,
        installationCleaned: false,
        pathCleaned: false,
        symlinksCleaned: false
      },
      messages: []
    }

    try {
      // Check prerequisites
      const hasLegacy = await this.hasLegacyInstallation()

      if (!hasLegacy) {
        report.success = true
        report.messages.push('No legacy installation found')
        return report
      }

      report.legacyVersion = await this.getLegacyVersion()
      report.hasNpm = await this.hasNpmInstallation()

      if (verbose) {
        console.log('')
        console.log(`${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
        console.log(`${YELLOW}⚠️  Legacy curl installation detected${NC}`)
        console.log(`${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
        console.log('')
        console.log(`   ${DIM}Version: ${report.legacyVersion || 'unknown'}${NC}`)
        console.log(`   ${DIM}Location: ~/.prjct-cli/${NC}`)
        console.log('')

        if (!report.hasNpm) {
          console.log(`${RED}❌ npm global installation not found${NC}`)
          console.log('')
          console.log(`${CYAN}Install prjct-cli via npm first:${NC}`)
          console.log(`   ${GREEN}npm install -g prjct-cli${NC}`)
          console.log('')
          return report
        }

        console.log(`${CYAN}🔄 Migrating to npm installation...${NC}`)
        console.log('')
      }

      // Step 1: Migrate projects data
      if (verbose) console.log(`   ${DIM}Migrating projects data...${NC}`)
      const projectsMigration = await this.migrateProjectsData()
      report.steps.projectsMigrated = projectsMigration.projectsMigrated
      report.messages.push(projectsMigration.message)
      if (verbose) {
        if (projectsMigration.success) {
          console.log(`   ${GREEN}✓${NC} ${projectsMigration.message}`)
        } else {
          console.log(`   ${RED}✗${NC} ${projectsMigration.message}`)
        }
      }

      // Step 2: Clean legacy installation
      if (verbose) console.log(`   ${DIM}Removing legacy files...${NC}`)
      const installCleanup = await this.cleanupLegacyInstallation()
      report.steps.installationCleaned = installCleanup.success
      report.messages.push(installCleanup.message)
      if (verbose) {
        if (installCleanup.success) {
          console.log(`   ${GREEN}✓${NC} ${installCleanup.message}`)
        } else {
          console.log(`   ${RED}✗${NC} ${installCleanup.message}`)
        }
      }

      // Step 3: Clean PATH entries
      if (verbose) console.log(`   ${DIM}Cleaning shell PATH...${NC}`)
      const pathCleanup = await this.cleanupLegacyPATH()
      report.steps.pathCleaned = pathCleanup.success
      report.messages.push(pathCleanup.message)
      if (verbose) {
        if (pathCleanup.success) {
          console.log(`   ${GREEN}✓${NC} ${pathCleanup.message}`)
        } else {
          console.log(`   ${RED}✗${NC} ${pathCleanup.message}`)
        }
      }

      // Step 4: Clean symlinks
      if (verbose) console.log(`   ${DIM}Cleaning symlinks...${NC}`)
      const symlinkCleanup = await this.cleanupLegacySymlinks()
      report.steps.symlinksCleaned = symlinkCleanup.success
      report.messages.push(symlinkCleanup.message)
      if (verbose) {
        if (symlinkCleanup.success) {
          console.log(`   ${GREEN}✓${NC} ${symlinkCleanup.message}`)
        } else {
          console.log(`   ${RED}✗${NC} ${symlinkCleanup.message}`)
        }
      }

      if (verbose) {
        console.log('')
        console.log(`${GREEN}✨ Migration complete!${NC}`)
        console.log('')
        console.log(`${DIM}Next steps:${NC}`)
        if (pathCleanup.filesModified > 0) {
          console.log(`   ${CYAN}1. Reload your shell:${NC}`)
          console.log(`      source ~/.zshrc  ${DIM}(or ~/.bashrc)${NC}`)
          console.log('')
        }
        console.log(`   ${CYAN}${pathCleanup.filesModified > 0 ? '2' : '1'}. Verify installation:${NC}`)
        console.log(`      which prjct  ${DIM}(should show npm path)${NC}`)
        console.log(`      prjct --version`)
        console.log('')
        console.log(`${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`)
        console.log('')
      }

      report.success = true
      return report
    } catch (error) {
      report.messages.push(`Cleanup failed: ${error.message}`)
      return report
    }
  }

  /**
   * Quick check - silent, returns true if cleanup needed
   * @returns {Promise<boolean>}
   */
  async needsCleanup() {
    const hasLegacy = await this.hasLegacyInstallation()
    const hasNpm = await this.hasNpmInstallation()
    return hasLegacy && hasNpm
  }
}

module.exports = new LegacyInstallerDetector()
