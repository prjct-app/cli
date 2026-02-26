/** Directories to skip during indexing and scanning */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '.parcel-cache',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
  '.venv',
  'venv',
  'eggs',
  '*.egg-info',
  '.prjct',
])

/** Config file names to track */
export const CONFIG_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'webpack.config.js',
  'rollup.config.js',
  'esbuild.config.js',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.ts',
  'vitest.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
])

/** Extensions to try when resolving imports */
export const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']

/** Regex for extracting import paths */
export const IMPORT_REGEX = /(?:import|from)\s+['"]([^'"]+)['"]/g
