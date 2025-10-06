import { defineWorkspace } from 'vitest/config'
import { existsSync } from 'fs'
import { join } from 'path'

// Check if website dependencies are installed
const websiteDepsInstalled = existsSync(join(process.cwd(), 'website', 'node_modules'))

const projects = [
  // Core project (Node.js environment)
  {
    test: {
      include: ['core/**/*.test.js', 'tests/**/*.test.js'],
      name: 'core',
      environment: 'node',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'website/', 'tests/', 'scripts/'],
      },
      globals: true,
    },
  },
]

// Only include website project if dependencies are installed
if (websiteDepsInstalled) {
  projects.push('./website')
}

export default defineWorkspace(projects)
