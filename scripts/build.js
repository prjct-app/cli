#!/usr/bin/env node

/**
 * Build Script for prjct-cli
 *
 * Compiles TypeScript to JavaScript for Node.js compatibility.
 * Builds:
 * - bin/prjct.mjs (CLI entry point)
 * - core/infrastructure/setup.js (postinstall needs this)
 * - core/infrastructure/command-installer.js
 * - core/infrastructure/editors-config.js
 * - core/utils/version.js
 *
 * @version 2.0.0
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

/**
 * Ensure esbuild is available
 */
function ensureEsbuild() {
  try {
    require.resolve('esbuild')
    return true
  } catch {
    console.log('Installing esbuild...')
    try {
      execSync('npm install esbuild --save-dev', { cwd: ROOT, stdio: 'inherit' })
      return true
    } catch (error) {
      console.error('Failed to install esbuild:', error.message)
      return false
    }
  }
}

/**
 * Clean and create dist directory
 */
function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }
  fs.mkdirSync(DIST, { recursive: true })
  fs.mkdirSync(path.join(DIST, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'core', 'infrastructure'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'core', 'utils'), { recursive: true })
}

/**
 * Build all modules
 */
async function build() {
  const esbuild = require('esbuild')

  console.log('Building for Node.js...\n')

  // 1. CLI entry point (ESM)
  console.log('  → bin/prjct.mjs')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'bin/prjct.ts')],
    outfile: path.join(DIST, 'bin', 'prjct.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    sourcemap: false,
    minify: false,
    keepNames: true,
    packages: 'external',
    banner: {
      js: `#!/usr/bin/env node
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);`,
    },
  })
  fs.chmodSync(path.join(DIST, 'bin', 'prjct.mjs'), 0o755)

  // 2. Setup module (CJS - for postinstall)
  console.log('  → core/infrastructure/setup.js')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/infrastructure/setup.ts')],
    outfile: path.join(DIST, 'core', 'infrastructure', 'setup.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    packages: 'external',
  })

  // 3. Command installer (CJS)
  console.log('  → core/infrastructure/command-installer.js')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/infrastructure/command-installer.ts')],
    outfile: path.join(DIST, 'core', 'infrastructure', 'command-installer.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    packages: 'external',
  })

  // 4. Editors config (CJS)
  console.log('  → core/infrastructure/editors-config.js')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/infrastructure/editors-config.ts')],
    outfile: path.join(DIST, 'core', 'infrastructure', 'editors-config.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    packages: 'external',
  })

  // 5. Version util (CJS)
  console.log('  → core/utils/version.js')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/utils/version.ts')],
    outfile: path.join(DIST, 'core', 'utils', 'version.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    keepNames: true,
    packages: 'external',
  })

  console.log('\nBuild complete!')
  console.log(`Output: ${DIST}/`)
}

/**
 * Main
 */
async function main() {
  console.log('prjct-cli build script')
  console.log('======================\n')

  if (!ensureEsbuild()) {
    process.exit(1)
  }

  clean()
  await build()
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
