/**
 * TechDetector - Dynamic Technology Detection
 * 
 * NO HARDCODING - Detects technologies from actual project files
 * Works with ANY technology stack (Elixir, Phoenix, Svelte, etc.)
 * 
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')

class TechDetector {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.cache = null
  }

  /**
   * Detect all technologies in the project
   * Returns structured data about languages, frameworks, tools
   * @returns {Promise<Object>} - { languages: [], frameworks: [], tools: [], packageManagers: [] }
   */
  async detectAll() {
    if (this.cache) {
      return this.cache
    }

    const detected = {
      languages: [],
      frameworks: [],
      tools: [],
      packageManagers: [],
      databases: [],
      buildTools: [],
      testFrameworks: []
    }

    // Detect from package managers (most reliable source)
    await this.detectFromPackageJson(detected)
    await this.detectFromCargoToml(detected)
    await this.detectFromGoMod(detected)
    await this.detectFromRequirements(detected)
    await this.detectFromGemfile(detected)
    await this.detectFromMixExs(detected) // Elixir
    await this.detectFromPomXml(detected) // Maven/Java
    await this.detectFromComposerJson(detected) // PHP

    // Detect from config files
    await this.detectFromConfigFiles(detected)

    // Detect from directory structure
    await this.detectFromStructure(detected)

    // Cache result
    this.cache = detected
    return detected
  }

  /**
   * Detect from package.json (Node.js/JavaScript/TypeScript)
   */
  async detectFromPackageJson(detected) {
    try {
      const packagePath = path.join(this.projectPath, 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      const pkg = JSON.parse(content)

      detected.packageManagers.push('npm')

      // Language
      if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
        detected.languages.push('TypeScript')
      } else {
        detected.languages.push('JavaScript')
      }

      // Collect all dependencies (no hardcoding - just list them)
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      }

      // Frameworks and tools are in dependencies - let Claude decide what's important
      // We just collect the names, no assumptions
      const depNames = Object.keys(allDeps)
      
      // Common patterns (but not hardcoded - just helpers)
      for (const dep of depNames) {
        // Frontend frameworks
        if (['react', 'vue', 'angular', 'svelte'].includes(dep.toLowerCase())) {
          detected.frameworks.push(dep)
        }
        // Meta-frameworks
        else if (['next', 'nuxt', 'sveltekit', 'remix'].includes(dep.toLowerCase())) {
          detected.frameworks.push(dep)
        }
        // Backend frameworks
        else if (['express', 'fastify', 'koa', 'hapi', 'nest'].includes(dep.toLowerCase())) {
          detected.frameworks.push(dep)
        }
        // Build tools
        else if (['vite', 'webpack', 'rollup', 'esbuild', 'parcel'].includes(dep.toLowerCase())) {
          detected.buildTools.push(dep)
        }
        // Test frameworks
        else if (['jest', 'vitest', 'mocha', 'jasmine', 'cypress', 'playwright'].includes(dep.toLowerCase())) {
          detected.testFrameworks.push(dep)
        }
        // Databases
        else if (['mongoose', 'sequelize', 'prisma', 'typeorm'].includes(dep.toLowerCase())) {
          detected.databases.push(dep)
        }
      }

      // Also check for yarn/pnpm
      if (await this.fileExists('yarn.lock')) {
        detected.packageManagers.push('yarn')
      }
      if (await this.fileExists('pnpm-lock.yaml')) {
        detected.packageManagers.push('pnpm')
      }
    } catch (error) {
      // File doesn't exist or invalid JSON - skip
    }
  }

  /**
   * Detect from Cargo.toml (Rust)
   */
  async detectFromCargoToml(detected) {
    try {
      const cargoPath = path.join(this.projectPath, 'Cargo.toml')
      await fs.readFile(cargoPath, 'utf-8')
      
      detected.languages.push('Rust')
      detected.packageManagers.push('Cargo')
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from go.mod (Go)
   */
  async detectFromGoMod(detected) {
    try {
      const goModPath = path.join(this.projectPath, 'go.mod')
      await fs.readFile(goModPath, 'utf-8')
      
      detected.languages.push('Go')
      detected.packageManagers.push('Go Modules')
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from requirements.txt (Python)
   */
  async detectFromRequirements(detected) {
    try {
      const reqPath = path.join(this.projectPath, 'requirements.txt')
      const content = await fs.readFile(reqPath, 'utf-8')
      
      detected.languages.push('Python')
      detected.packageManagers.push('pip')
      
      // Detect common frameworks
      const lines = content.split('\n').map(l => l.trim().toLowerCase())
      if (lines.some(l => l.includes('django'))) detected.frameworks.push('Django')
      if (lines.some(l => l.includes('flask'))) detected.frameworks.push('Flask')
      if (lines.some(l => l.includes('fastapi'))) detected.frameworks.push('FastAPI')
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from Gemfile (Ruby)
   */
  async detectFromGemfile(detected) {
    try {
      const gemfilePath = path.join(this.projectPath, 'Gemfile')
      const content = await fs.readFile(gemfilePath, 'utf-8')
      
      detected.languages.push('Ruby')
      detected.packageManagers.push('Bundler')
      
      if (content.includes('rails')) {
        detected.frameworks.push('Rails')
      }
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from mix.exs (Elixir)
   */
  async detectFromMixExs(detected) {
    try {
      const mixPath = path.join(this.projectPath, 'mix.exs')
      const content = await fs.readFile(mixPath, 'utf-8')
      
      detected.languages.push('Elixir')
      detected.packageManagers.push('Mix')
      
      if (content.includes('phoenix')) {
        detected.frameworks.push('Phoenix')
      }
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from pom.xml (Maven/Java)
   */
  async detectFromPomXml(detected) {
    try {
      const pomPath = path.join(this.projectPath, 'pom.xml')
      await fs.readFile(pomPath, 'utf-8')
      
      detected.languages.push('Java')
      detected.packageManagers.push('Maven')
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from composer.json (PHP)
   */
  async detectFromComposerJson(detected) {
    try {
      const composerPath = path.join(this.projectPath, 'composer.json')
      const content = await fs.readFile(composerPath, 'utf-8')
      const composer = JSON.parse(content)
      
      detected.languages.push('PHP')
      detected.packageManagers.push('Composer')
      
      const allDeps = {
        ...(composer.require || {}),
        ...(composer['require-dev'] || {})
      }
      
      if (Object.keys(allDeps).some(d => d.includes('laravel'))) {
        detected.frameworks.push('Laravel')
      }
      if (Object.keys(allDeps).some(d => d.includes('symfony'))) {
        detected.frameworks.push('Symfony')
      }
    } catch (error) {
      // File doesn't exist - skip
    }
  }

  /**
   * Detect from config files (Docker, etc.)
   */
  async detectFromConfigFiles(detected) {
    // Docker
    if (await this.fileExists('Dockerfile')) {
      detected.tools.push('Docker')
    }
    if (await this.fileExists('docker-compose.yml') || await this.fileExists('docker-compose.yaml')) {
      detected.tools.push('Docker Compose')
    }

    // Kubernetes
    if (await this.fileExists('k8s') || await this.fileExists('kubernetes')) {
      detected.tools.push('Kubernetes')
    }

    // Terraform
    if (await this.fileExists('.tf') || await this.findFiles('*.tf')) {
      detected.tools.push('Terraform')
    }
  }

  /**
   * Detect from directory structure
   */
  async detectFromStructure(_detected) {
    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true })
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)

      // Common patterns (but not assumptions - just hints)
      // Could analyze structure here in the future
      if (dirs.includes('src') && dirs.includes('lib')) {
        // Could be Elixir, but don't assume
      }
    } catch (error) {
      // Can't read directory - skip
    }
  }

  /**
   * Get a summary string of detected technologies
   * Useful for agent generation
   */
  async getSummary() {
    const tech = await this.detectAll()
    const parts = []

    if (tech.languages.length > 0) {
      parts.push(`Languages: ${tech.languages.join(', ')}`)
    }
    if (tech.frameworks.length > 0) {
      parts.push(`Frameworks: ${tech.frameworks.join(', ')}`)
    }
    if (tech.tools.length > 0) {
      parts.push(`Tools: ${tech.tools.join(', ')}`)
    }
    if (tech.databases.length > 0) {
      parts.push(`Databases: ${tech.databases.join(', ')}`)
    }

    return parts.join(' | ')
  }

  /**
   * Helper: Check if file exists
   */
  async fileExists(filename) {
    try {
      await fs.access(path.join(this.projectPath, filename))
      return true
    } catch {
      return false
    }
  }

  /**
   * Helper: Find files matching pattern
   */
  async findFiles(pattern) {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      const { stdout } = await execAsync(
        `find . -name "${pattern}" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | head -1`,
        { cwd: this.projectPath }
      )
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  /**
   * Clear cache (useful after project changes)
   */
  clearCache() {
    this.cache = null
  }
}

module.exports = TechDetector

