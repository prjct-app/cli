#!/usr/bin/env node

/**
 * Build Script for prjct-cli
 *
 * Produces a complete dist/ for npm publishing:
 * - dist/bin/prjct.mjs     CLI entry point (ESM, minified, sourcemapped)
 * - dist/cli/linear.mjs    Linear CLI subprocess (ESM, minified)
 * - dist/templates.json    All templates bundled into single JSON
 *
 * @version 3.0.0
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
  fs.mkdirSync(path.join(DIST, 'cli'), { recursive: true })
}

/**
 * Build CLI entry point and Linear CLI
 */
async function buildJs() {
  const esbuild = require('esbuild')

  // 1. CLI entry point (ESM, minified, sourcemapped)
  console.log('  → dist/bin/prjct.mjs')
  const mainResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'bin/prjct.ts')],
    outfile: path.join(DIST, 'bin', 'prjct.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    sourcemap: true,
    minify: true,
    keepNames: true,
    packages: 'external',
    metafile: true,
    banner: {
      js: `#!/usr/bin/env node
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);`,
    },
  })
  fs.chmodSync(path.join(DIST, 'bin', 'prjct.mjs'), 0o755)

  // 2. Linear CLI (ESM, minified — spawned as subprocess)
  console.log('  → dist/cli/linear.mjs')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/cli/linear.ts')],
    outfile: path.join(DIST, 'cli', 'linear.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    sourcemap: true,
    minify: true,
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
  fs.chmodSync(path.join(DIST, 'cli', 'linear.mjs'), 0o755)

  return mainResult.metafile
}

/**
 * Bundle all templates into a single JSON file
 *
 * Structure: { "commands/p.md": "...", "global/CLAUDE.md": "...", ... }
 * Keys are relative paths from templates/ directory.
 */
function bundleTemplates() {
  const templatesDir = path.join(ROOT, 'templates')
  const bundle = {}
  let fileCount = 0

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue
      const fullPath = path.join(dir, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        walk(fullPath, relativePath)
      } else {
        bundle[relativePath] = fs.readFileSync(fullPath, 'utf-8')
        fileCount++
      }
    }
  }

  walk(templatesDir, '')

  const outPath = path.join(DIST, 'templates.json')
  fs.writeFileSync(outPath, JSON.stringify(bundle))

  console.log(`  → dist/templates.json (${fileCount} files)`)
  return fileCount
}

/**
 * Print build summary with file sizes
 */
function printSummary() {
  console.log('\nBuild output:')

  const files = [
    'bin/prjct.mjs',
    'bin/prjct.mjs.map',
    'cli/linear.mjs',
    'cli/linear.mjs.map',
    'templates.json',
  ]

  let totalSize = 0
  for (const file of files) {
    const filePath = path.join(DIST, file)
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath)
      totalSize += stat.size
      const sizeKb = (stat.size / 1024).toFixed(1)
      console.log(`  ${file.padEnd(25)} ${sizeKb} KB`)
    }
  }

  console.log(`  ${'─'.repeat(40)}`)
  console.log(`  ${'Total'.padEnd(25)} ${(totalSize / 1024).toFixed(1)} KB`)
}

/**
 * Main
 */
async function main() {
  console.log('prjct-cli build script v3.0')
  console.log('==========================\n')

  if (!ensureEsbuild()) {
    process.exit(1)
  }

  clean()

  console.log('Compiling TypeScript...')
  await buildJs()

  console.log('\nBundling templates...')
  bundleTemplates()

  printSummary()
  console.log('\nBuild complete!')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
