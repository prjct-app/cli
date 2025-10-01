const fs = require('fs').promises
const path = require('path')
const pathManager = require('./path-manager')
const configManager = require('./config-manager')
const authorDetector = require('./author-detector')

/**
 * Migrator - Handles migrations between versions
 *
 * Migration process:
 * 1. Detect legacy .prjct directory (v0.1.0 → v0.2.x)
 * 2. Detect author information
 * 3. Create prjct.config.json
 * 4. Create global directory structure
 * 5. Copy all files to global location
 * 6. Move authors/version/created/lastSync to global config (v0.2.x → v0.3.0)
 * 7. Validate migration
 * 8. Optionally remove local .prjct
 *
 * @version 0.3.0
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


    const config = await configManager.readConfig(projectPath)
    if (config && config.version && config.version.startsWith('0.2.')) {
      return true
    }

    return false
  }

  /**
   * Migrate config from 0.2.x to 0.3.0 (move authors to global config)
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
      const localConfig = await configManager.readConfig(projectPath)
      if (!localConfig) {
        result.message = 'No config found'
        return result
      }

      result.oldVersion = localConfig.version
      const projectId = localConfig.projectId


      const globalConfig = await configManager.readGlobalConfig(projectId)
      if (globalConfig && globalConfig.authors && globalConfig.authors.length > 0) {

        const needsCleanup = localConfig.authors || localConfig.author ||
                            localConfig.version || localConfig.created || localConfig.lastSync

        if (needsCleanup) {

          delete localConfig.authors
          delete localConfig.author
          delete localConfig.version
          delete localConfig.created
          delete localConfig.lastSync
          await configManager.writeConfig(projectPath, localConfig)
        }
        result.success = true
        result.message = 'Authors already in global config, cleaned up local config'
        return result
      }


      let authors = []
      const now = new Date().toISOString()

      if (localConfig.authors && Array.isArray(localConfig.authors)) {

        authors = localConfig.authors
      } else if (localConfig.author) {

        authors = [
          {
            name: localConfig.author.name || 'Unknown',
            email: localConfig.author.email || '',
            github: localConfig.author.github || '',
            firstContribution: localConfig.created || now,
            lastActivity: localConfig.lastSync || now
          }
        ]
      } else {

        authors = [
          {
            name: 'Unknown',
            email: '',
            github: '',
            firstContribution: now,
            lastActivity: now
          }
        ]
      }


      const newGlobalConfig = {
        projectId,
        authors,
        version: '0.3.0',
        created: localConfig.created || now,
        lastSync: now
      }
      await configManager.writeGlobalConfig(projectId, newGlobalConfig)


      delete localConfig.authors
      delete localConfig.author
      delete localConfig.version
      delete localConfig.created
      delete localConfig.lastSync
      await configManager.writeConfig(projectPath, localConfig)

      result.success = true
      result.message = `Migrated ${authors.length} author(s) to global config`
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

    if (filename === 'now.md' || filename === 'next.md' || filename === 'context.md') {
      return { layer: 'core', filename }
    }


    if (filename === 'shipped.md' || filename === 'metrics.md') {
      return { layer: 'progress', filename }
    }


    if (filename === 'ideas.md' || filename === 'roadmap.md') {
      return { layer: 'planning', filename }
    }


    if (filename === 'memory.jsonl' || filename === 'context.jsonl' || filename === 'decisions.jsonl') {
      return { layer: 'memory', filename }
    }


    if (filename === 'repo-summary.md') {
      return { layer: 'analysis', filename }
    }


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


      if (entry.name === 'prjct.config.json' || entry.name.endsWith('.old')) {
        continue
      }

      if (entry.isDirectory()) {

        if (validLayers.includes(entry.name)) {

          const destPath = path.join(globalPath, entry.name)
          const count = await this.copyDirectory(sourcePath, destPath)
          fileCount += count
          if (layerCounts.hasOwnProperty(entry.name)) {
            layerCounts[entry.name] += count
          } else {
            layerCounts.other += count
          }
        } else {

          const destPath = path.join(globalPath, 'planning', entry.name)
          const count = await this.copyDirectory(sourcePath, destPath)
          fileCount += count
          layerCounts.planning += count
        }
      } else {

        const mapping = this.mapLegacyFile(entry.name)
        const destPath = path.join(globalPath, mapping.layer, mapping.filename)


        await fs.mkdir(path.dirname(destPath), { recursive: true })


        await fs.copyFile(sourcePath, destPath)
        fileCount++


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


    const exists = await pathManager.projectExists(projectId)
    if (!exists) {
      issues.push('Global project directory not found')
      return { valid: false, issues }
    }


    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const requiredLayers = ['core', 'progress', 'planning', 'analysis', 'memory']

    for (const layer of requiredLayers) {
      try {
        await fs.access(path.join(globalPath, layer))
      } catch {
        issues.push(`Missing layer directory: ${layer}`)
      }
    }


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

      const config = await configManager.readConfig(projectPath)
      if (config && config.version && config.version.startsWith('0.2.')) {
        const versionMigration = await this.migrateConfigTo030(projectPath)
        result.success = versionMigration.success
        result.projectId = config.projectId
        result.filesCopied = 0
        result.issues = versionMigration.success ? [] : [versionMigration.message]
        return result
      }


      const needsStructuralMigration = await configManager.needsMigration(projectPath)
      if (!needsStructuralMigration) {
        result.success = false
        result.issues.push('No migration needed - either no legacy structure or already migrated')
        return result
      }


      result.author = await authorDetector.detect()


      const projectId = pathManager.generateProjectId(projectPath)
      result.projectId = projectId

      if (options.dryRun) {

        result.success = true
        result.issues.push('DRY RUN - No changes were made')
        return result
      }


      await pathManager.ensureProjectStructure(projectId)


      result.config = await configManager.createConfig(projectPath, result.author)


      const legacyPath = pathManager.getLegacyPrjctPath(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      const migrationStats = await this.migrateFiles(legacyPath, globalPath)
      result.filesCopied = migrationStats.fileCount
      result.layerCounts = migrationStats.layerCounts


      const validation = await this.validateMigration(projectId)
      result.issues = validation.issues

      if (!validation.valid) {
        result.success = false
        return result
      }


      if (options.removeLegacy) {
        await fs.rm(legacyPath, { recursive: true, force: true })
        result.legacyRemoved = true
      }

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


    let searchPaths = []
    if (deepScan) {
      searchPaths = [os.homedir()]
    } else {

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


    const searchDirectory = async (dirPath, depth = 0) => {

      if (depth > 10) return

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })


        if (entries.some(entry => entry.name === '.prjct' && entry.isDirectory())) {
          projectDirs.push(dirPath)
          return // Don't search subdirectories if we found a project
        }


        for (const entry of entries) {
          if (entry.isDirectory() && !shouldSkip(entry.name)) {
            const subPath = path.join(dirPath, entry.name)
            await searchDirectory(subPath, depth + 1)
          }
        }
      } catch (error) {

      }
    }


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

      if (onProgress) onProgress({ phase: 'scanning', message: 'Searching for projects...' })
      const projectPaths = await this.findAllProjects({ deepScan })
      summary.totalFound = projectPaths.length

      if (projectPaths.length === 0) {
        summary.success = true
        return summary
      }


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


    if (summary.errors.length > 0) {
      lines.push('❌ Errors:')
      summary.errors.forEach(error => {
        lines.push(`   • ${error.project}`)
        error.issues.forEach(issue => lines.push(`     - ${issue}`))
      })
      lines.push('')
    }


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
