/**
 * Project Capabilities Detector
 * Detects ONLY what exists - no assumptions, no hallucinations
 */

const fs = require('fs').promises
const path = require('path')

class ProjectCapabilities {
  /**
   * Detect project capabilities
   * @param {string} projectPath - Project root path
   * @returns {Promise<Object>} Capabilities object
   */
  async detect(projectPath = process.cwd()) {
    return {
      design: await this.hasDesign(projectPath),
      test: await this.hasTest(projectPath),
      docs: await this.hasDocs(projectPath),
    }
  }

  /**
   * Check if project has design system
   */
  async hasDesign(projectPath) {
    return (
      await this.hasFolder(projectPath, 'design') ||
      await this.hasFolder(projectPath, 'designs') ||
      await this.hasFolder(projectPath, '.storybook') ||
      await this.hasDep(projectPath, '@storybook/react') ||
      await this.hasDep(projectPath, '@storybook/vue') ||
      await this.hasFiles(projectPath, '**/*.figma')
    )
  }

  /**
   * Check if project has test framework
   */
  async hasTest(projectPath) {
    return (
      await this.hasDep(projectPath, 'jest') ||
      await this.hasDep(projectPath, 'vitest') ||
      await this.hasDep(projectPath, 'mocha') ||
      await this.hasDep(projectPath, '@jest/core') ||
      await this.hasFiles(projectPath, '**/*.{test,spec}.{js,ts,jsx,tsx}') ||
      await this.hasFile(projectPath, 'jest.config.js') ||
      await this.hasFile(projectPath, 'vitest.config.js')
    )
  }

  /**
   * Check if project has documentation system
   */
  async hasDocs(projectPath) {
    return (
      await this.hasFolder(projectPath, 'docs') ||
      await this.hasFolder(projectPath, 'documentation') ||
      await this.hasFile(projectPath, 'README.md') ||
      await this.hasDep(projectPath, 'typedoc') ||
      await this.hasDep(projectPath, 'jsdoc')
    )
  }

  /**
   * Check if folder exists
   */
  async hasFolder(projectPath, folderName) {
    try {
      const folderPath = path.join(projectPath, folderName)
      const stat = await fs.stat(folderPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Check if file exists
   */
  async hasFile(projectPath, fileName) {
    try {
      const filePath = path.join(projectPath, fileName)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if files matching pattern exist
   */
  async hasFiles(projectPath, pattern) {
    try {
      // Convert glob pattern to regex
      const regex = this.globToRegex(pattern)
      const files = await fs.readdir(projectPath, { recursive: true })

      // Filter by pattern and ignore node_modules, dist, build
      return files.some(file => {
        const skip = file.includes('node_modules/') ||
                    file.includes('dist/') ||
                    file.includes('build/')
        return !skip && regex.test(file)
      })
    } catch {
      return false
    }
  }

  /**
   * Convert simple glob pattern to regex
   */
  globToRegex(pattern) {
    // Convert **/*.{test,spec}.{js,ts,jsx,tsx} to regex
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`)
    return new RegExp(escaped)
  }

  /**
   * Check if dependency exists in package.json
   */
  async hasDep(projectPath, depName) {
    try {
      const pkgPath = path.join(projectPath, 'package.json')
      const content = await fs.readFile(pkgPath, 'utf8')
      const pkg = JSON.parse(content)

      return !!(
        (pkg.dependencies && pkg.dependencies[depName]) ||
        (pkg.devDependencies && pkg.devDependencies[depName])
      )
    } catch {
      return false
    }
  }
}

module.exports = new ProjectCapabilities()
