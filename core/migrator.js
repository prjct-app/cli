const fs = require('fs').promises
const path = require('path')
const pathManager = require('./path-manager')
const configManager = require('./config-manager')
const authorDetector = require('./author-detector')

/**
 * Migrator - Handles migration from v0.1.0 to v0.2.1
 *
 * Migration process:
 * 1. Detect legacy .prjct directory
 * 2. Detect author information
 * 3. Create prjct.config.json
 * 4. Create global directory structure
 * 5. Copy all files to global location
 * 6. Validate migration
 * 7. Optionally remove local .prjct
 *
 * @version 0.2.1
 */
class Migrator {
  /**
   * Check if a project needs migration
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if migration needed
   */
  async needsMigration(projectPath) {
    const structureMigration = await configManager.needsMigration(projectPath)
    if (structureMigration) return true

    // Check if config needs version migration (0.2.x → 0.3.0)
    const config = await configManager.readConfig(projectPath)
    if (config && config.version && config.version.startsWith('0.2.')) {
      return true
    }

    return false
  }

  /**
   * Migrate config from 0.2.x to 0.3.0 (author → authors array)
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} - Migration result
   */
  async migrateConfigTo030(projectPath) {
    const result = {
      success: false,
      message: '',
      oldVersion: null,
      newVersion: '0.3.0'
    }

    try {
      const config = await configManager.readConfig(projectPath)
      if (!config) {
        result.message = 'No config found'
        return result
      }

      result.oldVersion = config.version

      // Check if already has authors array
      if (config.authors && Array.isArray(config.authors)) {
        result.success = true
        result.message = 'Already using authors array format'
        return result
      }

      // Convert single author to authors array
      if (config.author) {
        const now = new Date().toISOString()
        config.authors = [
          {
            name: config.author.name || 'Unknown',
            email: config.author.email || '',
            github: config.author.github || '',
            firstContribution: config.created || now,
            lastActivity: config.lastSync || now
          }
        ]
        delete config.author
      } else {
        // No author info, create empty array
        const now = new Date().toISOString()
        config.authors = [
          {
            name: 'Unknown',
            email: '',
            github: '',
            firstContribution: now,
            lastActivity: now
          }
        ]
      }

      // Update version
      config.version = '0.3.0'
      config.lastSync = new Date().toISOString()

      // Write updated config
      await configManager.writeConfig(projectPath, config)

      result.success = true
      result.message = 'Config migrated from 0.2.x to 0.3.0'
      return result
    } catch (error) {
      result.message = `Migration failed: ${error.message}`
      return result
    }
  }

  /**
   * Copy a directory recursively
   *
   * @param {string} source - Source directory
   * @param {string} destination - Destination directory
   * @returns {Promise<number>} - Number of files copied
   * @private
   */
  async copyDirectory(source, destination) {
    let fileCount = 0

    await fs.mkdir(destination, { recursive: true })

    const entries = await fs.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const destPath = path.join(destination, entry.name)

      if (entry.isDirectory()) {
        fileCount += await this.copyDirectory(sourcePath, destPath)
      } else {
        await fs.copyFile(sourcePath, destPath)
        fileCount++
      }
    }

    return fileCount
  }

  /**
   * Map legacy flat structure to new layered structure
   *
   * @param {string} filename - Name of the file
   * @returns {Object} - {layer, filename}
   * @private
   */
  mapLegacyFile(filename) {
    // Core layer
    if (filename === 'now.md' || filename === 'next.md' || filename === 'context.md') {
      return { layer: 'core', filename }
    }

    // Progress layer
    if (filename === 'shipped.md' || filename === 'metrics.md') {
      return { layer: 'progress', filename }
    }

    // Planning layer
    if (filename === 'ideas.md' || filename === 'roadmap.md') {
      return { layer: 'planning', filename }
    }

    // Memory layer
    if (filename === 'memory.jsonl' || filename === 'context.jsonl' || filename === 'decisions.jsonl') {
      return { layer: 'memory', filename }
    }

    // Analysis layer
    if (filename === 'repo-summary.md') {
      return { layer: 'analysis', filename }
    }

    // Default to root of global structure for unknown files
    return { layer: '.', filename }
  }

  /**
   * Migrate files from legacy structure to new layered structure
   *
   * @param {string} legacyPath - Path to legacy .prjct directory
   * @param {string} globalPath - Path to new global project directory
   * @returns {Promise<{fileCount: number, layerCounts: Object}>}
   * @private
   */
  async migrateFiles(legacyPath, globalPath) {
    let fileCount = 0
    const layerCounts = {
      core: 0,
      progress: 0,
      planning: 0,
      analysis: 0,
      memory: 0,
      other: 0
    }

    const validLayers = ['core', 'progress', 'planning', 'analysis', 'memory', 'sessions']
    const entries = await fs.readdir(legacyPath, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(legacyPath, entry.name)

      // Skip config file and backup files
      if (entry.name === 'prjct.config.json' || entry.name.endsWith('.old')) {
        continue
      }

      if (entry.isDirectory()) {
        // Check if this is a layer directory (v0.2.0+ structure)
        if (validLayers.includes(entry.name)) {
          // Copy entire layer directory to global location
          const destPath = path.join(globalPath, entry.name)
          const count = await this.copyDirectory(sourcePath, destPath)
          fileCount += count
          if (layerCounts.hasOwnProperty(entry.name)) {
            layerCounts[entry.name] += count
          } else {
            layerCounts.other += count
          }
        } else {
          // Other subdirectories go to planning/ (legacy behavior)
          const destPath = path.join(globalPath, 'planning', entry.name)
          const count = await this.copyDirectory(sourcePath, destPath)
          fileCount += count
          layerCounts.planning += count
        }
      } else {
        // Map loose files to appropriate layer (v0.1.0 structure)
        const mapping = this.mapLegacyFile(entry.name)
        const destPath = path.join(globalPath, mapping.layer, mapping.filename)

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true })

        // Copy file
        await fs.copyFile(sourcePath, destPath)
        fileCount++

        // Update layer count
        if (mapping.layer === '.') {
          layerCounts.other++
        } else {
          layerCounts[mapping.layer] = (layerCounts[mapping.layer] || 0) + 1
        }
      }
    }

    return { fileCount, layerCounts }
  }

  /**
   * Validate that migration was successful
   *
   * @param {string} projectId - Project ID
   * @returns {Promise<{valid: boolean, issues: string[]}>}
   * @private
   */
  async validateMigration(projectId) {
    const issues = []

    // Check if global project directory exists
    const exists = await pathManager.projectExists(projectId)
    if (!exists) {
      issues.push('Global project directory not found')
      return { valid: false, issues }
    }

    // Check if essential directories exist
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const requiredLayers = ['core', 'progress', 'planning', 'analysis', 'memory']

    for (const layer of requiredLayers) {
      try {
        await fs.access(path.join(globalPath, layer))
      } catch {
        issues.push(`Missing layer directory: ${layer}`)
      }
    }

    // Check if at least some files exist
    try {
      const coreFiles = await fs.readdir(path.join(globalPath, 'core'))
      if (coreFiles.length === 0) {
        issues.push('No files found in core directory')
      }
    } catch {
      issues.push('Cannot read core directory')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Cleanup legacy directories while preserving config
   * Removes: analysis/, core/, memory/, planning/, progress/, sessions/
   * Keeps: prjct.config.json
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<void>}
   * @private
   */
  async cleanupLegacyDirectories(projectPath) {
    const legacyPath = pathManager.getLegacyPrjctPath(projectPath)
    const layersToRemove = ['analysis', 'core', 'memory', 'planning', 'progress', 'sessions']

    for (const layer of layersToRemove) {
      const layerPath = path.join(legacyPath, layer)
      try {
        await fs.rm(layerPath, { recursive: true, force: true })
      } catch {
        // Ignore if directory doesn't exist
      }
    }
  }

  /**
   * Perform the complete migration process
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} options - Migration options
   * @param {boolean} options.removeLegacy - Remove legacy .prjct after migration completely
   * @param {boolean} options.cleanupLegacy - Remove legacy directories but keep config
   * @param {boolean} options.dryRun - Simulate migration without making changes
   * @returns {Promise<Object>} - Migration result
   */
  async migrate(projectPath, options = {}) {
    const result = {
      success: false,
      projectId: null,
      filescopied: 0,
      layerCounts: {},
      config: null,
      author: null,
      issues: [],
      dryRun: options.dryRun || false
    }

    try {
      // Step 1: Check if this is a version migration (0.2.x → 0.3.0)
      const config = await configManager.readConfig(projectPath)
      if (config && config.version && config.version.startsWith('0.2.')) {
        const versionMigration = await this.migrateConfigTo030(projectPath)
        result.success = versionMigration.success
        result.projectId = config.projectId
        result.filesCopied = 0
        result.issues = versionMigration.success ? [] : [versionMigration.message]
        return result
      }

      // Step 2: Check if structural migration is needed (legacy .prjct → global)
      const needsStructuralMigration = await configManager.needsMigration(projectPath)
      if (!needsStructuralMigration) {
        result.success = false
        result.issues.push('No migration needed - either no legacy structure or already migrated')
        return result
      }

      // Step 3: Detect author information
      result.author = await authorDetector.detect()

      // Step 3: Generate project ID
      const projectId = pathManager.generateProjectId(projectPath)
      result.projectId = projectId

      if (options.dryRun) {
        // Simulate migration
        result.success = true
        result.issues.push('DRY RUN - No changes were made')
        return result
      }

      // Step 4: Create global directory structure
      await pathManager.ensureProjectStructure(projectId)

      // Step 5: Create prjct.config.json
      result.config = await configManager.createConfig(projectPath, result.author)

      // Step 6: Migrate files
      const legacyPath = pathManager.getLegacyPrjctPath(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      const migrationStats = await this.migrateFiles(legacyPath, globalPath)
      result.filesCopied = migrationStats.fileCount
      result.layerCounts = migrationStats.layerCounts

      // Step 7: Validate migration
      const validation = await this.validateMigration(projectId)
      result.issues = validation.issues

      if (!validation.valid) {
        result.success = false
        return result
      }

      // Step 8: Optionally remove legacy directory completely
      if (options.removeLegacy) {
        await fs.rm(legacyPath, { recursive: true, force: true })
        result.legacyRemoved = true
      }
      // Or cleanup legacy directories selectively (keep config only)
      else if (options.cleanupLegacy) {
        await this.cleanupLegacyDirectories(projectPath)
        result.legacyCleaned = true
      }

      result.success = true
      return result

    } catch (error) {
      result.success = false
      result.issues.push(`Migration error: ${error.message}`)
      return result
    }
  }

  /**
   * Generate a migration report
   *
   * @param {Object} result - Migration result
   * @returns {string} - Formatted report
   */
  generateReport(result) {
    const lines = []

    lines.push('📦 Migration Report')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (result.dryRun) {
      lines.push('⚠️  DRY RUN MODE - No changes were made')
      lines.push('')
    }

    if (result.success) {
      lines.push('✅ Migration successful!')
      lines.push('')
      lines.push(`📋 Project ID: ${result.projectId}`)
      lines.push(`👤 Author: ${authorDetector.formatAuthor(result.author)}`)
      lines.push(`📁 Files migrated: ${result.filesCopied}`)
      lines.push('')
      lines.push('📂 Files by layer:')
      for (const [layer, count] of Object.entries(result.layerCounts)) {
        if (count > 0) {
          lines.push(`   • ${layer}: ${count} files`)
        }
      }
      lines.push('')
      lines.push(`📍 Data location: ${result.config.dataPath}`)

      if (result.legacyRemoved) {
        lines.push('')
        lines.push('🗑️  Legacy .prjct directory removed')
      }
    } else {
      lines.push('❌ Migration failed!')
      lines.push('')
      if (result.issues.length > 0) {
        lines.push('Issues:')
        for (const issue of result.issues) {
          lines.push(`   • ${issue}`)
        }
      }
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return lines.join('\n')
  }

  /**
   * Check migration status for a project
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} - Status information
   */
  async checkStatus(projectPath) {
    const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
    const hasConfig = await pathManager.hasConfig(projectPath)
    const needsMigration = hasLegacy && !hasConfig

    let status = 'unknown'
    if (!hasLegacy && !hasConfig) {
      status = 'new' // New project, not initialized
    } else if (!hasLegacy && hasConfig) {
      status = 'migrated' // Already migrated to v0.2.0
    } else if (hasLegacy && !hasConfig) {
      status = 'legacy' // v0.1.0, needs migration
    } else if (hasLegacy && hasConfig) {
      status = 'both' // Has both (migration incomplete or manual setup)
    }

    return {
      status,
      hasLegacy,
      hasConfig,
      needsMigration,
      version: hasConfig ? '0.2.0' : hasLegacy ? '0.1.0' : 'none'
    }
  }

  /**
   * Find all projects with .prjct directories on the user's machine
   *
   * @param {Object} options - Search options
   * @param {boolean} options.deepScan - Scan entire home directory (default: true for automatic migration)
   * @returns {Promise<Array<string>>} - Array of project paths
   */
  async findAllProjects(options = {}) {
    const { deepScan = true } = options
    const projectDirs = []
    const os = require('os')

    // Define search paths
    let searchPaths = []
    if (deepScan) {
      searchPaths = [os.homedir()]
    } else {
      // Common project locations
      const commonDirs = ['Projects', 'Documents', 'Developer', 'Code', 'dev', 'workspace', 'repos', 'src']
      searchPaths = commonDirs
        .map(dir => path.join(os.homedir(), dir))
        .filter(dirPath => {
          try {
            fs.accessSync(dirPath)
            return true
          } catch {
            return false
          }
        })
    }

    // Helper to check if path should be skipped
    const shouldSkip = (dirName) => {
      const skipDirs = [
        'node_modules',
        '.git',
        '.next',
        'dist',
        'build',
        '.cache',
        'coverage',
        '.vscode',
        '.idea',
        'vendor',
        '__pycache__'
      ]
      return skipDirs.includes(dirName) || (dirName.startsWith('.') && dirName !== '.prjct')
    }

    // Recursive search function
    const searchDirectory = async (dirPath, depth = 0) => {
      // Limit recursion depth for safety
      if (depth > 10) return

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        // Check if this directory contains .prjct
        if (entries.some(entry => entry.name === '.prjct' && entry.isDirectory())) {
          projectDirs.push(dirPath)
          return // Don't search subdirectories if we found a project
        }

        // Search subdirectories
        for (const entry of entries) {
          if (entry.isDirectory() && !shouldSkip(entry.name)) {
            const subPath = path.join(dirPath, entry.name)
            await searchDirectory(subPath, depth + 1)
          }
        }
      } catch (error) {
        // Skip directories we can't access
      }
    }

    // Search all paths
    for (const searchPath of searchPaths) {
      await searchDirectory(searchPath)
    }

    return projectDirs
  }

  /**
   * Migrate all projects with legacy .prjct directories
   *
   * @param {Object} options - Migration options
   * @param {boolean} options.deepScan - Scan entire home directory
   * @param {boolean} options.removeLegacy - Remove legacy .prjct after migration completely
   * @param {boolean} options.cleanupLegacy - Remove legacy directories but keep config
   * @param {boolean} options.dryRun - Simulate migration without making changes
   * @param {boolean} options.interactive - Ask for confirmation before each migration
   * @param {Function} options.onProgress - Callback for progress updates
   * @returns {Promise<Object>} - Migration summary
   */
  async migrateAll(options = {}) {
    const {
      deepScan = false,
      removeLegacy = false,
      cleanupLegacy = false,
      dryRun = false,
      interactive = false,
      onProgress = null
    } = options

    const summary = {
      success: false,
      totalFound: 0,
      alreadyMigrated: 0,
      successfullyMigrated: 0,
      failed: 0,
      skipped: 0,
      projects: [],
      errors: [],
      dryRun
    }

    try {
      // Find all projects
      if (onProgress) onProgress({ phase: 'scanning', message: 'Searching for projects...' })
      const projectPaths = await this.findAllProjects({ deepScan })
      summary.totalFound = projectPaths.length

      if (projectPaths.length === 0) {
        summary.success = true
        return summary
      }

      // Check each project's status
      for (let i = 0; i < projectPaths.length; i++) {
        const projectPath = projectPaths[i]
        const projectName = path.basename(projectPath)

        if (onProgress) {
          onProgress({
            phase: 'checking',
            message: `Checking ${projectName} (${i + 1}/${projectPaths.length})`,
            current: i + 1,
            total: projectPaths.length
          })
        }

        try {
          const status = await this.checkStatus(projectPath)

          const projectInfo = {
            path: projectPath,
            name: projectName,
            status: status.status
          }

          if (status.status === 'migrated' || status.status === 'new') {
            projectInfo.result = 'skipped'
            projectInfo.reason = status.status === 'migrated' ? 'Already migrated' : 'Not initialized'
            summary.alreadyMigrated++
          } else if (status.needsMigration) {
            // Skip if interactive and user doesn't confirm
            if (interactive && onProgress) {
              const shouldMigrate = await onProgress({
                phase: 'confirm',
                message: `Migrate ${projectName}?`,
                projectPath
              })
              if (!shouldMigrate) {
                projectInfo.result = 'skipped'
                projectInfo.reason = 'User skipped'
                summary.skipped++
                summary.projects.push(projectInfo)
                continue
              }
            }

            // Migrate the project
            if (onProgress) {
              onProgress({
                phase: 'migrating',
                message: `Migrating ${projectName}...`,
                current: i + 1,
                total: projectPaths.length
              })
            }

            const migrationResult = await this.migrate(projectPath, {
              removeLegacy,
              cleanupLegacy,
              dryRun
            })

            projectInfo.projectId = migrationResult.projectId
            projectInfo.filesCopied = migrationResult.filesCopied
            projectInfo.layerCounts = migrationResult.layerCounts

            if (migrationResult.success) {
              projectInfo.result = 'success'
              summary.successfullyMigrated++
            } else {
              projectInfo.result = 'failed'
              projectInfo.errors = migrationResult.issues
              summary.failed++
              summary.errors.push({
                project: projectName,
                path: projectPath,
                issues: migrationResult.issues
              })
            }
          }

          summary.projects.push(projectInfo)
        } catch (error) {
          summary.failed++
          summary.errors.push({
            project: projectName,
            path: projectPath,
            issues: [error.message]
          })
          summary.projects.push({
            path: projectPath,
            name: projectName,
            result: 'failed',
            errors: [error.message]
          })
        }
      }

      summary.success = summary.failed === 0
      return summary

    } catch (error) {
      summary.success = false
      summary.errors.push({
        project: 'global',
        issues: [error.message]
      })
      return summary
    }
  }

  /**
   * Generate a summary report for migrateAll results
   *
   * @param {Object} summary - Migration summary from migrateAll
   * @returns {string} - Formatted report
   */
  generateMigrationSummary(summary) {
    const lines = []

    lines.push('📦 Global Migration Report')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (summary.dryRun) {
      lines.push('⚠️  DRY RUN MODE - No changes were made')
      lines.push('')
    }

    // Summary statistics
    lines.push(`🔍 Found: ${summary.totalFound} projects`)
    lines.push(`✅ Successfully migrated: ${summary.successfullyMigrated}`)
    lines.push(`⏭️  Already migrated: ${summary.alreadyMigrated}`)
    if (summary.skipped > 0) {
      lines.push(`⏸️  Skipped: ${summary.skipped}`)
    }
    if (summary.failed > 0) {
      lines.push(`❌ Failed: ${summary.failed}`)
    }
    lines.push('')

    // List migrated projects
    if (summary.successfullyMigrated > 0) {
      lines.push('✅ Successfully Migrated:')
      summary.projects
        .filter(p => p.result === 'success')
        .forEach(project => {
          lines.push(`   • ${project.name}`)
          lines.push(`     Files: ${project.filesCopied} | ID: ${project.projectId}`)
        })
      lines.push('')
    }

    // List errors
    if (summary.errors.length > 0) {
      lines.push('❌ Errors:')
      summary.errors.forEach(error => {
        lines.push(`   • ${error.project}`)
        error.issues.forEach(issue => lines.push(`     - ${issue}`))
      })
      lines.push('')
    }

    // Success message or next steps
    if (summary.success && summary.successfullyMigrated > 0) {
      lines.push('🎉 All projects migrated successfully!')
      lines.push(`📍 Global data location: ${pathManager.getGlobalBasePath()}`)
    } else if (summary.totalFound === 0) {
      lines.push('ℹ️  No legacy projects found')
    } else if (summary.alreadyMigrated === summary.totalFound) {
      lines.push('ℹ️  All projects already migrated')
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return lines.join('\n')
  }
}

module.exports = new Migrator()
