/**
 * Capability Installer
 * Handles installation of missing tools and tracks them as workflow tasks
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import projectCapabilities from '../utils/project-capabilities'

const execAsync = promisify(exec)

interface Recommendation {
  install: string
}

interface InstallResult {
  success: boolean
  capability: string
  command: string
  duration?: number
  output?: string
  errors?: string | null
  error?: string
}

interface ConfigureResult {
  configured: boolean
  framework?: string
  tool?: string
}

interface PackageJson {
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

class CapabilityInstaller {
  /**
   * Install capability and create tracking task
   */
  async install(
    capability: string,
    recommendation: Recommendation,
    _dataPath: string
  ): Promise<InstallResult> {
    const command = recommendation.install
    const startTime = Date.now()

    try {
      // Execute installation command
      const { stdout, stderr } = await execAsync(command)

      const duration = Date.now() - startTime
      const durationMin = Math.round((duration / 1000 / 60) * 10) / 10

      return {
        success: true,
        capability,
        command,
        duration: durationMin,
        output: stdout,
        errors: stderr || null,
      }
    } catch (error) {
      return {
        success: false,
        capability,
        command,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Create configuration for installed tool
   */
  async configure(capability: string, projectPath: string): Promise<ConfigureResult> {
    const configs: Record<string, () => Promise<ConfigureResult>> = {
      test: () => this.configureTest(projectPath),
      design: () => this.configureDesign(projectPath),
      docs: () => this.configureDocs(projectPath),
    }

    if (configs[capability]) {
      return await configs[capability]()
    }

    return { configured: false }
  }

  /**
   * Configure test framework
   */
  async configureTest(projectPath: string): Promise<ConfigureResult> {
    // Check if package.json exists
    const pkgPath = path.join(projectPath, 'package.json')
    const pkg: PackageJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'))

    const hasVitest = pkg.devDependencies?.vitest
    const hasJest = pkg.devDependencies?.jest

    if (hasVitest) {
      // Create vitest.config.js
      const config = `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.js'
  }
})
`
      await fs.writeFile(path.join(projectPath, 'vitest.config.js'), config)

      // Add test script
      pkg.scripts = pkg.scripts || {}
      pkg.scripts.test = 'vitest'
      pkg.scripts['test:ui'] = 'vitest --ui'
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2))

      return { configured: true, framework: 'vitest' }
    }

    if (hasJest) {
      // Create jest.config.js
      const config = `module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  moduleNameMapper: {
    '\\\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  }
}
`
      await fs.writeFile(path.join(projectPath, 'jest.config.js'), config)

      // Add test script
      pkg.scripts = pkg.scripts || {}
      pkg.scripts.test = 'jest'
      pkg.scripts['test:watch'] = 'jest --watch'
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2))

      return { configured: true, framework: 'jest' }
    }

    return { configured: false }
  }

  /**
   * Configure design system
   */
  async configureDesign(projectPath: string): Promise<ConfigureResult> {
    const pkgPath = path.join(projectPath, 'package.json')
    const pkg: PackageJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'))

    if (pkg.devDependencies?.storybook) {
      // Storybook auto-configures itself during init
      return { configured: true, tool: 'storybook' }
    }

    return { configured: false }
  }

  /**
   * Configure documentation
   */
  async configureDocs(projectPath: string): Promise<ConfigureResult> {
    const pkgPath = path.join(projectPath, 'package.json')
    const pkg: PackageJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'))

    if (pkg.devDependencies?.jsdoc) {
      // Create jsdoc.json
      const config = {
        source: {
          include: ['src'],
          includePattern: '.+\\.js(doc|x)?$',
          excludePattern: '(node_modules|docs)',
        },
        opts: {
          destination: './docs',
          recurse: true,
        },
      }

      await fs.writeFile(path.join(projectPath, 'jsdoc.json'), JSON.stringify(config, null, 2))

      // Add docs script
      pkg.scripts = pkg.scripts || {}
      pkg.scripts.docs = 'jsdoc -c jsdoc.json'
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2))

      return { configured: true, tool: 'jsdoc' }
    }

    return { configured: false }
  }

  /**
   * Verify installation succeeded
   */
  async verify(capability: string, projectPath: string): Promise<boolean> {
    const detected = await projectCapabilities.detect(projectPath)

    return detected[capability as keyof typeof detected] === true
  }
}

const capabilityInstaller = new CapabilityInstaller()
export default capabilityInstaller
