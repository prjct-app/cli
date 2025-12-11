#!/usr/bin/env bun

/**
 * prjct serve - Start the web server
 *
 * Launches the prjct web interface with Claude Code CLI integration.
 * Uses your existing Claude subscription via PTY - no API costs!
 *
 * Smart dependency management:
 * - Tracks installed version in .prjct-web-state.json
 * - Only installs when version changes or node_modules missing
 * - Reuses existing prjct-web server if already running on port
 */

const { spawn, spawnSync, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const packagesDir = path.join(__dirname, '..', 'packages')
const sharedDir = path.join(packagesDir, 'shared')
const webDir = path.join(packagesDir, 'web')
const prjctDir = path.join(require('os').homedir(), '.prjct-cli')
const stateFile = path.join(prjctDir, '.prjct-web-state.json')

// Parse arguments
const args = process.argv.slice(2)
const portArg = args.find((a) => a.startsWith('--port='))
const port = portArg ? portArg.split('=')[1] : '9472'

// Check if web package exists
if (!fs.existsSync(webDir)) {
  console.error('❌ Web package not found.')
  console.error('   This might be a broken installation.')
  console.error('   Try reinstalling: npm install -g prjct-cli')
  process.exit(1)
}

/**
 * Read the current state file
 */
function readState() {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    }
  } catch {
    // Ignore errors, return empty state
  }
  return {}
}

/**
 * Write state file
 */
function writeState(state) {
  try {
    // Ensure ~/.prjct-cli directory exists
    if (!fs.existsSync(prjctDir)) {
      fs.mkdirSync(prjctDir, { recursive: true })
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  } catch {
    // Ignore write errors
  }
}

/**
 * Get package.json version
 */
function getPackageVersion(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Check if dependencies need to be installed
 * Simple logic: install only if node_modules missing OR version changed
 */
function needsInstall(pkgDir, stateKey) {
  const nodeModules = path.join(pkgDir, 'node_modules')

  // If node_modules doesn't exist, need install
  if (!fs.existsSync(nodeModules)) {
    return { needed: true, reason: 'node_modules not found' }
  }

  const state = readState()
  const currentVersion = getPackageVersion(pkgDir)
  const savedVersion = state[stateKey]?.version

  // If version changed, need install
  if (savedVersion && savedVersion !== currentVersion) {
    return { needed: true, reason: `${savedVersion} → ${currentVersion}` }
  }

  // node_modules exists and version unchanged = skip
  return { needed: false }
}

/**
 * Update state after successful install
 */
function markInstalled(pkgDir, stateKey) {
  const state = readState()
  state[stateKey] = {
    version: getPackageVersion(pkgDir),
    installedAt: new Date().toISOString()
  }
  writeState(state)
}

// Check if dependencies need installation
const sharedCheck = fs.existsSync(sharedDir) ? needsInstall(sharedDir, 'shared') : { needed: false }
const webCheck = needsInstall(webDir, 'web')

if (sharedCheck.needed || webCheck.needed) {
  const reasons = []
  if (sharedCheck.needed) reasons.push(`shared: ${sharedCheck.reason}`)
  if (webCheck.needed) reasons.push(`web: ${webCheck.reason}`)

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Dependency Update                           ║
║                                                           ║
║   ${reasons.join(', ').substring(0, 45).padEnd(45)}       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)

  // Install shared dependencies first (if needed)
  if (sharedCheck.needed) {
    console.log('📦 Installing packages/shared dependencies...')
    const sharedInstall = spawnSync('npm', ['install'], {
      cwd: sharedDir,
      stdio: 'inherit',
      shell: true,
    })

    if (sharedInstall.status !== 0) {
      console.error('❌ Failed to install shared dependencies')
      process.exit(1)
    }

    // Build shared package
    console.log('🔨 Building shared package...')
    const sharedBuild = spawnSync('npm', ['run', 'build'], {
      cwd: sharedDir,
      stdio: 'inherit',
      shell: true,
    })

    if (sharedBuild.status !== 0) {
      console.error('⚠️  Warning: Failed to build shared package')
    }

    markInstalled(sharedDir, 'shared')
  }

  // Install web dependencies (if needed)
  if (webCheck.needed) {
    console.log('📦 Installing packages/web dependencies...')
    const webInstall = spawnSync('npm', ['install'], {
      cwd: webDir,
      stdio: 'inherit',
      shell: true,
    })

    if (webInstall.status !== 0) {
      console.error('❌ Failed to install web dependencies')
      process.exit(1)
    }

    markInstalled(webDir, 'web')
  }

  console.log('✅ Dependencies ready!\n')
} else {
  console.log('✅ Dependencies up to date\n')
}

/**
 * Check if process on port is a prjct-web server
 */
function isPrjctWebProcess(pid) {
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('wmic', ['process', 'where', `processid=${pid}`, 'get', 'commandline'], {
        shell: true,
        encoding: 'utf8',
      })
      return result.stdout.includes('server.ts') || result.stdout.includes('prjct')
    } else {
      // macOS / Linux - check process command line
      const result = spawnSync('ps', ['-p', pid, '-o', 'command='], {
        shell: true,
        encoding: 'utf8',
      })
      const cmd = result.stdout.trim()
      return cmd.includes('server.ts') || cmd.includes('prjct') || cmd.includes('next')
    }
  } catch {
    return false
  }
}

/**
 * Get PIDs using a port
 */
function getPortPids(portToCheck) {
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('netstat', ['-ano'], { shell: true, encoding: 'utf8' })
      const pids = []
      const lines = result.stdout.split('\n')
      for (const line of lines) {
        if (line.includes(`:${portToCheck}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') pids.push(pid)
        }
      }
      return pids
    } else {
      const result = spawnSync('lsof', ['-ti', `:${portToCheck}`], {
        shell: true,
        encoding: 'utf8',
      })
      return result.stdout.trim().split('\n').filter(Boolean)
    }
  } catch {
    return []
  }
}

/**
 * Kill specific PIDs
 */
function killPids(pids) {
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/PID', pid], { shell: true })
      } else {
        spawnSync('kill', ['-9', pid], { shell: true })
      }
    } catch {
      // Ignore individual kill errors
    }
  }
}

/**
 * Open URL in browser
 */
function openBrowser(url) {
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  spawn(openCmd, [url], { shell: true, detached: true }).unref()
}

// Check if port is in use and handle accordingly
const portPids = getPortPids(port)
let serverAlreadyRunning = false

if (portPids.length > 0) {
  // Check if it's a prjct-web server
  const isPrjctWeb = portPids.some(pid => isPrjctWebProcess(pid))

  if (isPrjctWeb) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Server Already Running                      ║
║                                                           ║
║   Found existing prjct-web on port ${port}                 ║
║   Opening browser...                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)
    openBrowser(`http://localhost:${port}`)
    serverAlreadyRunning = true
  } else {
    // Not a prjct-web process, ask before killing
    console.log(`⚠️  Port ${port} is in use by another process.`)
    console.log(`   PIDs: ${portPids.join(', ')}`)
    console.log(`   Stopping to avoid killing unrelated processes.`)
    console.log(`   Use --port=XXXX to specify a different port.`)
    process.exit(1)
  }
}

// If server is already running, we're done - just opened browser above
if (serverAlreadyRunning) {
  process.exit(0)
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Developer Momentum                          ║
║                                                           ║
║   Starting production server...                           ║
║                                                           ║
║   Web:     http://localhost:${port}                         ║
║                                                           ║
║   Using your Claude subscription - $0 API costs           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)

// Build for production if needed (first run or .next missing)
const nextDir = path.join(webDir, '.next')
if (!fs.existsSync(nextDir)) {
  console.log('🔨 Building for production (first run)...\n')
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
  })
  if (buildResult.status !== 0) {
    console.error('❌ Build failed')
    process.exit(1)
  }
  console.log('✅ Build complete!\n')
}

// Start web server in production mode
const web = spawn('npm', ['run', 'start:prod'], {
  cwd: webDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port, NODE_ENV: 'production' },
})

// Open browser after a short delay
setTimeout(() => {
  openBrowser(`http://localhost:${port}`)
}, 3000)

// Handle shutdown
const cleanup = () => {
  console.log('\n👋 Shutting down prjct server...')
  web.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Handle errors
web.on('error', (err) => {
  console.error('Web error:', err.message)
})
