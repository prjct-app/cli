/**
 * StackDetector - Detects project technology stack
 *
 * Analyzes the project to detect:
 * - Frontend frameworks (React, Vue, Svelte, Angular)
 * - Backend frameworks (Express, Fastify, Hono, etc.)
 * - Database usage (Prisma, Mongoose, etc.)
 * - Docker configuration
 * - Testing frameworks
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { StackDetection, StackPackageJson } from '../types'

export type { StackDetection, StackPackageJson } from '../types'

// ============================================================================
// STACK DETECTOR
// ============================================================================

export class StackDetector {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Detect the full technology stack of the project
   */
  async detect(): Promise<StackDetection> {
    const stack: StackDetection = {
      hasFrontend: false,
      hasBackend: false,
      hasDatabase: false,
      hasDocker: false,
      hasTesting: false,
      frontendType: null,
      frameworks: [],
    }

    // Try to read package.json for JS/TS projects
    const pkg = await this.readPackageJson()

    if (pkg) {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      // Detect each category
      this.detectFrontend(deps, stack)
      this.detectBackend(deps, stack)
      this.detectDatabase(deps, stack)
      this.detectTesting(deps, pkg, stack)
      this.collectFrameworks(deps, stack)
    }

    // Docker detection (file-based)
    stack.hasDocker = await this.detectDocker()

    return stack
  }

  // ==========================================================================
  // DETECTION METHODS
  // ==========================================================================

  /**
   * Detect frontend frameworks and type (web/mobile/both)
   */
  private detectFrontend(deps: Record<string, string>, stack: StackDetection): void {
    // Web frameworks
    if (deps.react || deps.vue || deps.svelte || deps['@angular/core']) {
      stack.hasFrontend = true
      stack.frontendType = 'web'
    }

    // Mobile frameworks
    if (deps['react-native'] || deps.expo) {
      stack.hasFrontend = true
      stack.frontendType = stack.frontendType === 'web' ? 'both' : 'mobile'
    }
  }

  /**
   * Detect backend frameworks
   */
  private detectBackend(deps: Record<string, string>, stack: StackDetection): void {
    const backendFrameworks = [
      'express',
      'fastify',
      'hono',
      'koa',
      '@nestjs/core',
      'nest',
      '@hapi/hapi',
      'restify',
      'polka',
    ]

    if (backendFrameworks.some((fw) => deps[fw])) {
      stack.hasBackend = true
    }
  }

  /**
   * Detect database/ORM usage
   */
  private detectDatabase(deps: Record<string, string>, stack: StackDetection): void {
    const databaseLibs = [
      'prisma',
      '@prisma/client',
      'mongoose',
      'pg',
      'mysql2',
      'sequelize',
      'typeorm',
      'drizzle-orm',
      'knex',
      'better-sqlite3',
      'mongodb',
      'redis',
      'ioredis',
    ]

    if (databaseLibs.some((lib) => deps[lib])) {
      stack.hasDatabase = true
    }
  }

  /**
   * Detect testing frameworks
   */
  private detectTesting(
    deps: Record<string, string>,
    pkg: StackPackageJson,
    stack: StackDetection
  ): void {
    const testingFrameworks = [
      'jest',
      'vitest',
      'mocha',
      '@testing-library/react',
      '@testing-library/vue',
      'cypress',
      'playwright',
      '@playwright/test',
      'ava',
      'tap',
      'bun-types', // Bun's built-in test runner
    ]

    if (testingFrameworks.some((fw) => deps[fw] || pkg.devDependencies?.[fw])) {
      stack.hasTesting = true
    }
  }

  /**
   * Detect Docker configuration
   */
  private async detectDocker(): Promise<boolean> {
    const dockerFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore']

    for (const file of dockerFiles) {
      if (await this.fileExists(file)) {
        return true
      }
    }

    return false
  }

  /**
   * Collect detected frameworks into the frameworks array
   */
  private collectFrameworks(deps: Record<string, string>, stack: StackDetection): void {
    // Frontend frameworks
    if (deps.react) stack.frameworks.push('React')
    if (deps.next) stack.frameworks.push('Next.js')
    if (deps.vue) stack.frameworks.push('Vue')
    if (deps.nuxt) stack.frameworks.push('Nuxt')
    if (deps.svelte) stack.frameworks.push('Svelte')
    if (deps['@angular/core']) stack.frameworks.push('Angular')
    if (deps['react-native']) stack.frameworks.push('React Native')
    if (deps.expo) stack.frameworks.push('Expo')

    // Backend frameworks
    if (deps.express) stack.frameworks.push('Express')
    if (deps.fastify) stack.frameworks.push('Fastify')
    if (deps.hono) stack.frameworks.push('Hono')
    if (deps.koa) stack.frameworks.push('Koa')
    if (deps['@nestjs/core'] || deps.nest) stack.frameworks.push('NestJS')

    // Meta-frameworks
    if (deps.astro) stack.frameworks.push('Astro')
    if (deps.remix) stack.frameworks.push('Remix')
    if (deps.gatsby) stack.frameworks.push('Gatsby')
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Read and parse package.json
   */
  private async readPackageJson(): Promise<StackPackageJson | null> {
    try {
      const pkgPath = path.join(this.projectPath, 'package.json')
      const content = await fs.readFile(pkgPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Check if a file exists in the project
   */
  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, filename))
      return true
    } catch {
      return false
    }
  }
}

export default StackDetector
