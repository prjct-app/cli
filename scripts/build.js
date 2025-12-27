#!/usr/bin/env node

/**
 * Build Script for prjct-cli
 *
 * Transpiles TypeScript to JavaScript for Node.js compatibility.
 * Uses esbuild for fast builds.
 *
 * @version 1.0.0
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

/**
 * Check if esbuild is available, install if not
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
 * Clean dist directory
 */
function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }
  fs.mkdirSync(DIST, { recursive: true })
}

/**
 * Build using esbuild
 *
 * Bundles the CLI into a single file for Node.js compatibility.
 */
async function build() {
  const esbuild = require('esbuild')

  console.log('Building for Node.js...')

  // Bundle bin/prjct.ts into a single file
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
    // Mark all node_modules as external
    packages: 'external',
    // Banner with shebang and __dirname polyfill for ESM
    banner: {
      js: `#!/usr/bin/env node
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);`,
    },
  })

  // Make executable
  fs.chmodSync(path.join(DIST, 'bin', 'prjct.mjs'), 0o755)

  console.log('Build complete!')
  console.log(`Output: ${DIST}/bin/prjct.mjs`)
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

main().catch(error => {
  console.error('Build failed:', error)
  process.exit(1)
})
