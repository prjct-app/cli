/**
 * Interactive workflow prompts for missing capabilities
 * Asks users before skipping or installing tools
 */

class WorkflowPrompts {
  /**
   * Get recommendation based on detected stack
   */
  getRecommendation(stepName, projectInfo = {}) {
    const recommendations = {
      design: {
        tools: ['Figma plugin', 'Storybook', 'Design tokens'],
        install: 'npx storybook@latest init',
        reason: 'Component documentation and design system'
      },
      test: {
        tools: this.getTestRecommendation(projectInfo),
        install: this.getTestInstallCommand(projectInfo),
        reason: 'Quality assurance and regression prevention'
      },
      docs: {
        tools: ['JSDoc', 'TypeDoc', 'Docusaurus'],
        install: 'npm install -D jsdoc',
        reason: 'API documentation and code examples'
      }
    }

    return recommendations[stepName] || null
  }

  /**
   * Detect test framework based on project stack
   */
  getTestRecommendation(projectInfo) {
    const { framework, typescript } = projectInfo

    if (framework === 'react') {
      return typescript
        ? ['Vitest + Testing Library', 'Jest + Testing Library']
        : ['Jest + Testing Library', 'Vitest']
    }

    if (framework === 'vue') {
      return ['Vitest', '@vue/test-utils']
    }

    if (framework === 'angular') {
      return ['Jasmine + Karma', 'Jest']
    }

    // Default Node.js
    return typescript
      ? ['Vitest', 'Jest with ts-jest']
      : ['Jest', 'Vitest', 'Mocha + Chai']
  }

  /**
   * Get install command based on stack
   */
  getTestInstallCommand(projectInfo) {
    const { framework, typescript } = projectInfo

    if (framework === 'react') {
      return typescript
        ? 'npm install -D vitest @testing-library/react @testing-library/jest-dom'
        : 'npm install -D jest @testing-library/react @testing-library/jest-dom'
    }

    if (framework === 'vue') {
      return 'npm install -D vitest @vue/test-utils'
    }

    if (framework === 'angular') {
      return 'npm install -D jest @types/jest ts-jest'
    }

    return typescript
      ? 'npm install -D vitest'
      : 'npm install -D jest'
  }

  /**
   * Detect project stack from package.json
   */
  async detectStack(projectPath) {
    const fs = require('fs').promises
    const path = require('path')

    try {
      const pkgPath = path.join(projectPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      return {
        framework: this.detectFramework(deps),
        typescript: 'typescript' in deps,
        bundler: this.detectBundler(deps),
        runtime: this.detectRuntime(deps)
      }
    } catch {
      return { framework: 'node', typescript: false }
    }
  }

  detectFramework(deps) {
    if ('react' in deps) return 'react'
    if ('vue' in deps) return 'vue'
    if ('@angular/core' in deps) return 'angular'
    if ('next' in deps) return 'next'
    if ('nuxt' in deps) return 'nuxt'
    return 'node'
  }

  detectBundler(deps) {
    if ('vite' in deps) return 'vite'
    if ('webpack' in deps) return 'webpack'
    if ('esbuild' in deps) return 'esbuild'
    return null
  }

  detectRuntime(deps) {
    if ('bun' in deps) return 'bun'
    if ('deno' in deps) return 'deno'
    return 'node'
  }

  /**
   * Build prompt message for missing capability
   */
  async buildPrompt(step, capabilities, projectPath) {
    const stack = await this.detectStack(projectPath)
    const rec = this.getRecommendation(step.needs, stack)

    if (!rec) {
      return {
        message: `⚠️  Step "${step.name}" requires ${step.needs} capability\n\nOptions:\n1. Skip this step\n2. Continue without ${step.needs}\n3. Pause workflow`,
        options: ['skip', 'continue', 'pause'],
        recommendation: null
      }
    }

    const toolsList = rec.tools.join(', ')

    return {
      message: `⚠️  Missing ${step.needs} capability for "${step.name}" step\n\n` +
               `📋 Recommended: ${toolsList}\n` +
               `💡 Reason: ${rec.reason}\n\n` +
               `Options:\n` +
               `1. Install recommended (${rec.install})\n` +
               `2. Skip this step\n` +
               `3. Continue without ${step.needs}\n` +
               `4. Pause workflow`,
      options: ['install', 'skip', 'continue', 'pause'],
      recommendation: rec,
      stack
    }
  }

  /**
   * Parse user choice from response
   */
  parseChoice(response) {
    const lower = response.toLowerCase().trim()

    if (lower.match(/^(1|install|yes|y)/)) return 'install'
    if (lower.match(/^(2|skip|s)/)) return 'skip'
    if (lower.match(/^(3|continue|c)/)) return 'continue'
    if (lower.match(/^(4|pause|p)/)) return 'pause'

    return 'skip' // Default to skip if unclear
  }

  /**
   * Create installation task for workflow
   */
  createInstallTask(step, recommendation) {
    return {
      name: `install-${step.needs}`,
      agent: 'devops',
      action: `Install ${step.needs}: ${recommendation.install}`,
      required: true,
      type: 'install',
      install: recommendation.install,
      capability: step.needs,
      reason: recommendation.reason
    }
  }
}

module.exports = new WorkflowPrompts()
