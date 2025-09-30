const fs = require('fs').promises
const path = require('path')
const pathManager = require('./path-manager')
const configManager = require('./config-manager')
const authorDetector = require('./author-detector')

/**
 * Migrator - Handles migration from v0.1.0 to v0.2.0
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
 * @version 0.2.0
 */
class Migrator {
  /**
   * Check if a project needs migration
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if migration needed
   */
  async needsMigration(projectPath) {
    return await configManager.needsMigration(projectPath)
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

    const entries = await fs.readdir(legacyPath, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(legacyPath, entry.name)

      if (entry.isDirectory()) {
        // Handle subdirectories (e.g., tasks/, designs/)
        const destPath = path.join(globalPath, 'planning', entry.name)
        const count = await this.copyDirectory(sourcePath, destPath)
        fileCount += count
        layerCounts.planning += count
      } else {
        // Map file to appropriate layer
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
   * Perform the complete migration process
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} options - Migration options
   * @param {boolean} options.removeLegacy - Remove legacy .prjct after migration
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
      // Step 1: Check if migration is needed
      const needsMigration = await this.needsMigration(projectPath)
      if (!needsMigration) {
        result.success = false
        result.issues.push('No migration needed - either no legacy structure or already migrated')
        return result
      }

      // Step 2: Detect author information
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

      // Step 8: Optionally remove legacy directory
      if (options.removeLegacy) {
        await fs.rm(legacyPath, { recursive: true, force: true })
        result.legacyRemoved = true
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
}

module.exports = new Migrator()
