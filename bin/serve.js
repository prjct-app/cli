#!/usr/bin/env node

/**
 * prjct serve - Start the web server
 *
 * Launches the prjct web interface with Claude Code CLI integration.
 * Uses your existing Claude subscription via PTY - no API costs!
 *
 * Auto-installs dependencies on first run.
 */

const { spawn, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const packagesDir = path.join(__dirname, '..', 'packages')
const sharedDir = path.join(packagesDir, 'shared')
const webDir = path.join(packagesDir, 'web')

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

// Check if dependencies are installed
const sharedNodeModules = path.join(sharedDir, 'node_modules')
const webNodeModules = path.join(webDir, 'node_modules')
const needsSharedInstall = fs.existsSync(sharedDir) && !fs.existsSync(sharedNodeModules)
const needsWebInstall = !fs.existsSync(webNodeModules)

if (needsSharedInstall || needsWebInstall) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - First Time Setup                            ║
║                                                           ║
║   Installing web dependencies...                          ║
║   This only happens once.                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)

  // Install shared dependencies first (if exists)
  if (needsSharedInstall) {
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
  }

  // Install web dependencies
  if (needsWebInstall) {
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
  }

  console.log('✅ Dependencies installed!\n')
}

// Kill any process using the port
function killPort(portToKill) {
  try {
    if (process.platform === 'win32') {
      // Windows
      const result = spawnSync('netstat', ['-ano'], { shell: true, encoding: 'utf8' })
      const lines = result.stdout.split('\n')
      for (const line of lines) {
        if (line.includes(`:${portToKill}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') {
            spawnSync('taskkill', ['/F', '/PID', pid], { shell: true })
          }
        }
      }
    } else {
      // macOS / Linux
      const result = spawnSync('lsof', ['-ti', `:${portToKill}`], {
        shell: true,
        encoding: 'utf8',
      })
      const pids = result.stdout.trim().split('\n').filter(Boolean)
      for (const pid of pids) {
        spawnSync('kill', ['-9', pid], { shell: true })
      }
    }
  } catch {
    // Ignore errors - port might not be in use
  }
}

// Kill port if occupied
const checkPort = spawnSync('lsof', ['-ti', `:${port}`], {
  shell: true,
  encoding: 'utf8',
})

if (checkPort.stdout.trim()) {
  console.log(`⚠️  Port ${port} is in use. Killing existing process...`)
  killPort(port)
  // Small delay to ensure port is released
  spawnSync('sleep', ['1'], { shell: true })
  console.log(`✅ Port ${port} freed\n`)
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Developer Momentum                          ║
║                                                           ║
║   Production server ready                                 ║
║                                                           ║
║   Web:     http://localhost:${port}                         ║
║                                                           ║
║   Using your Claude subscription - $0 API costs           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)

// Build for production if needed (first run)
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
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  spawn(openCmd, [`http://localhost:${port}`], { shell: true })
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
