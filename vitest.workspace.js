import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
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
  // Website project (jsdom environment)
  './website',
])
