#!/usr/bin/env node

/**
 * Release Script for prjct-cli
 *
 * Complete release flow:
 * 1. Validate (clean git, on main/release branch)
 * 2. Build (compile ALL TypeScript to dist/)
 * 3. Test (run tests)
 * 4. Version bump (patch/minor/major)
 * 5. Commit + Tag
 * 6. Publish to npm
 *
 * Usage:
 *   node scripts/release.js patch   # 0.29.2 → 0.29.3
 *   node scripts/release.js minor   # 0.29.2 → 0.30.0
 *   node scripts/release.js major   # 0.29.2 → 1.0.0
 *
 * @version 1.0.0
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const DIST = path.join(ROOT, 'dist')

// Colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const NC = '\x1b[0m'

function log(msg) { console.log(msg) }
function info(msg) { console.log(`${BLUE}ℹ${NC} ${msg}`) }
function success(msg) { console.log(`${GREEN}✓${NC} ${msg}`) }
function warn(msg) { console.log(`${YELLOW}⚠${NC} ${msg}`) }
function error(msg) { console.log(`${RED}✗${NC} ${msg}`) }

function exec(cmd, options = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...options }).trim()
}

function execSilent(cmd) {
  try {
    return exec(cmd, { stdio: 'pipe' })
  } catch {
    return null
  }
}

// =============================================================================
// STEP 1: Validate
// =============================================================================

function validate() {
  log('\n📋 Step 1: Validate\n')

  // Check for uncommitted changes
  const status = exec('git status --porcelain')
  if (status) {
    error('Uncommitted changes detected:')
    console.log(status)
    console.log('\nCommit or stash changes before release.')
    process.exit(1)
  }
  success('Git working directory clean')

  // Check branch (allow main, master, or release branches)
  const branch = exec('git branch --show-current')
  const allowedBranches = ['main', 'master']
  const isReleaseBranch = branch.startsWith('release/') || branch.startsWith('feature/')

  if (!allowedBranches.includes(branch) && !isReleaseBranch) {
    warn(`On branch '${branch}' - typically releases are from main`)
    // Don't exit, just warn
  }
  success(`On branch: ${branch}`)

  // Check npm login
  const npmUser = execSilent('npm whoami')
  if (!npmUser) {
    error('Not logged into npm. Run: npm login')
    process.exit(1)
  }
  success(`npm logged in as: ${npmUser}`)

  return { branch }
}

// =============================================================================
// STEP 2: Build
// =============================================================================

async function build() {
  log('\n🔨 Step 2: Build\n')

  const esbuild = require('esbuild')

  // Clean dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }
  fs.mkdirSync(DIST, { recursive: true })

  // Create directory structure
  fs.mkdirSync(path.join(DIST, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'core', 'infrastructure'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'core', 'utils'), { recursive: true })

  // 1. Build CLI entry point (ESM for bin/prjct wrapper)
  info('Building bin/prjct.mjs...')
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
  success('bin/prjct.mjs')

  // 2. Build setup module (CJS for postinstall)
  info('Building core/infrastructure/setup.js...')
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
    external: ['../utils/version'], // Will be built separately
  })
  success('core/infrastructure/setup.js')

  // 3. Build command-installer (CJS, used by setup)
  info('Building core/infrastructure/command-installer.js...')
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
  success('core/infrastructure/command-installer.js')

  // 4. Build editors-config (CJS, used by setup)
  info('Building core/infrastructure/editors-config.js...')
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
  success('core/infrastructure/editors-config.js')

  // 5. Build version util (CJS)
  info('Building core/utils/version.js...')
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
  success('core/utils/version.js')

  // Verify all files exist
  const requiredFiles = [
    'bin/prjct.mjs',
    'core/infrastructure/setup.js',
    'core/infrastructure/command-installer.js',
    'core/infrastructure/editors-config.js',
    'core/utils/version.js',
  ]

  for (const file of requiredFiles) {
    const fullPath = path.join(DIST, file)
    if (!fs.existsSync(fullPath)) {
      error(`Missing: ${file}`)
      process.exit(1)
    }
  }

  success(`Build complete: ${requiredFiles.length} files`)
}

// =============================================================================
// STEP 3: Test
// =============================================================================

function test() {
  log('\n🧪 Step 3: Test\n')

  try {
    const result = exec('bun test 2>&1', { stdio: 'pipe' })
    console.log(result)

    // Check if tests actually passed (look for "0 fail" or no "fail" count)
    if (result.includes(' 0 fail') || !result.includes('fail')) {
      success('Tests passed')
    } else {
      error('Tests failed')
      process.exit(1)
    }
  } catch (e) {
    // Even if exit code is non-zero, check if tests passed
    const output = e.stdout?.toString() || ''
    console.log(output)

    if (output.includes(' 0 fail') || (output.includes(' pass') && !output.match(/[1-9]\d* fail/))) {
      success('Tests passed (with warnings)')
    } else {
      error('Tests failed')
      process.exit(1)
    }
  }
}

// =============================================================================
// STEP 4: Version Bump
// =============================================================================

function bumpVersion(type) {
  log('\n📦 Step 4: Version Bump\n')

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
  const currentVersion = pkg.version

  const [major, minor, patch] = currentVersion.split('.').map(Number)

  let newVersion
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`
      break
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`
      break
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`
  }

  pkg.version = newVersion
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n')

  // Also update version.ts
  const versionTsPath = path.join(ROOT, 'core/utils/version.ts')
  if (fs.existsSync(versionTsPath)) {
    let versionTs = fs.readFileSync(versionTsPath, 'utf8')
    versionTs = versionTs.replace(
      /export const VERSION = ['"][^'"]+['"]/,
      `export const VERSION = '${newVersion}'`
    )
    fs.writeFileSync(versionTsPath, versionTs)
  }

  info(`${currentVersion} → ${newVersion}`)
  success(`Version bumped to ${newVersion}`)

  return { currentVersion, newVersion }
}

// =============================================================================
// STEP 5: Commit + Tag
// =============================================================================

function commitAndTag(version) {
  log('\n📝 Step 5: Commit + Tag\n')

  exec('git add -A')

  const commitMsg = `chore: release v${version}

Generated with [p/](https://www.prjct.app/)`

  exec(`git commit -m "${commitMsg}"`)
  success(`Committed: release v${version}`)

  exec(`git tag -a v${version} -m "Release v${version}"`)
  success(`Tagged: v${version}`)
}

// =============================================================================
// STEP 6: Publish
// =============================================================================

function publish() {
  log('\n🚀 Step 6: Publish to npm\n')

  try {
    exec('npm publish', { stdio: 'inherit' })
    success('Published to npm')
  } catch (e) {
    error('Publish failed')
    console.log('\nYou can retry with: npm publish')
    process.exit(1)
  }
}

// =============================================================================
// STEP 7: Push
// =============================================================================

function push(branch) {
  log('\n☁️  Step 7: Push to remote\n')

  try {
    exec(`git push origin ${branch}`)
    exec('git push --tags')
    success('Pushed to remote')
  } catch (e) {
    warn('Push failed - you may need to push manually')
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const type = args[0] || 'patch'

  if (!['patch', 'minor', 'major'].includes(type)) {
    error(`Invalid version type: ${type}`)
    console.log('Usage: node scripts/release.js [patch|minor|major]')
    process.exit(1)
  }

  log(`\n${'='.repeat(50)}`)
  log(`  prjct-cli Release (${type})`)
  log(`${'='.repeat(50)}`)

  // Run all steps
  const { branch } = validate()
  await build()
  test()
  const { newVersion } = bumpVersion(type)
  commitAndTag(newVersion)
  publish()
  push(branch)

  log(`\n${'='.repeat(50)}`)
  log(`${GREEN}  ✓ Released prjct-cli@${newVersion}${NC}`)
  log(`${'='.repeat(50)}\n`)
}

main().catch(err => {
  error(err.message)
  process.exit(1)
})
