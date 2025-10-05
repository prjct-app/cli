import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['core/**/*.test.js', 'tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'website/', 'tests/', 'scripts/'],
    },
    globals: true,
    environment: 'node',
  },
})
