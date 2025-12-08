#!/usr/bin/env node

/**
 * prjct dev - Start prjct web development environment
 *
 * Launches:
 * - API server on port 9471
 * - Web frontend on port 9472
 * - Auto-opens browser
 *
 * Usage: prjct dev [--no-open]
 */

const { spawn, exec } = require('child_process')
const path = require('path')
const os = require('os')

// Configuration
const API_PORT = process.env.PRJCT_PORT || 9471
const WEB_PORT = process.env.PRJCT_WEB_PORT || 9472
const WEB_URL = `http://localhost:${WEB_PORT}`

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
}

// Find prjct-cli root (where packages/ lives)
function findPrjctRoot() {
  // Check common locations
  const locations = [
    path.join(__dirname, '..'),  // When running from bin/
    path.join(os.homedir(), 'Apps', 'prjct', 'prjct-cli'),
    path.join(os.homedir(), '.prjct-cli', 'source'),
  ]

  for (const loc of locations) {
    const pkgPath = path.join(loc, 'packages')
    try {
      require('fs').accessSync(pkgPath)
      return loc
    } catch {}
  }

  return locations[0] // Default to first option
}

const PRJCT_ROOT = findPrjctRoot()
const SERVER_PATH = path.join(PRJCT_ROOT, 'packages', 'server')
const WEB_PATH = path.join(PRJCT_ROOT, 'packages', 'web')

// Print banner
function printBanner() {
  console.log(`
${colors.cyan}${colors.bright}╔═══════════════════════════════════════════════╗
║                                               ║
║   ⚡ prjct dev                                 ║
║                                               ║
║   Web:     ${colors.green}http://localhost:${WEB_PORT}${colors.cyan}            ║
║   API:     ${colors.dim}http://localhost:${API_PORT}${colors.cyan}${colors.bright}            ║
║                                               ║
║   ${colors.dim}Press Ctrl+C to stop${colors.cyan}${colors.bright}                        ║
║                                               ║
╚═══════════════════════════════════════════════╝${colors.reset}
`)
}

// Open browser based on OS
function openBrowser(url) {
  const platform = os.platform()
  let command

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`
      break
    case 'win32':
      command = `start "" "${url}"`
      break
    default:
      command = `xdg-open "${url}"`
  }

  exec(command, (err) => {
    if (err) {
      console.log(`${colors.yellow}Could not open browser automatically. Visit: ${url}${colors.reset}`)
    }
  })
}

// Check if port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net')
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port)
  })
}

// Wait for server to be ready
function waitForServer(port, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const check = () => {
      const http = require('http')
      const req = http.get(`http://localhost:${port}`, (res) => {
        resolve(true)
      })

      req.on('error', () => {
        attempts++
        if (attempts >= maxAttempts) {
          reject(new Error(`Server on port ${port} did not start`))
        } else {
          setTimeout(check, 500)
        }
      })

      req.end()
    }

    check()
  })
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  const noOpen = args.includes('--no-open')

  // Check ports
  const apiAvailable = await checkPort(API_PORT)
  const webAvailable = await checkPort(WEB_PORT)

  if (!apiAvailable) {
    console.log(`${colors.red}Port ${API_PORT} is already in use. Stop other services or set PRJCT_PORT.${colors.reset}`)
    process.exit(1)
  }

  if (!webAvailable) {
    console.log(`${colors.red}Port ${WEB_PORT} is already in use. Stop other services or set PRJCT_WEB_PORT.${colors.reset}`)
    process.exit(1)
  }

  printBanner()

  // Start API server
  console.log(`${colors.cyan}Starting API server...${colors.reset}`)
  const serverProc = spawn('npm', ['run', 'dev'], {
    cwd: SERVER_PATH,
    env: { ...process.env, PRJCT_PORT: API_PORT.toString() },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  })

  serverProc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(line => {
      if (!line.includes('╔') && !line.includes('║') && !line.includes('╚')) {
        console.log(`${colors.dim}[api]${colors.reset} ${line}`)
      }
    })
  })

  serverProc.stderr.on('data', (data) => {
    console.log(`${colors.red}[api]${colors.reset} ${data.toString().trim()}`)
  })

  // Start Web frontend - Pass port directly to vite
  console.log(`${colors.cyan}Starting web frontend...${colors.reset}`)
  const webProc = spawn('npx', ['vite', '--port', WEB_PORT.toString(), '--strictPort'], {
    cwd: WEB_PATH,
    env: { ...process.env, PRJCT_PORT: API_PORT.toString() },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  })

  webProc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(line => {
      // Skip vite banner lines
      if (!line.includes('VITE') && !line.includes('➜') && !line.includes('ready in')) {
        console.log(`${colors.dim}[web]${colors.reset} ${line}`)
      }
    })
  })

  webProc.stderr.on('data', (data) => {
    console.log(`${colors.red}[web]${colors.reset} ${data.toString().trim()}`)
  })

  // Wait for servers and open browser
  try {
    console.log(`${colors.dim}Waiting for servers to start...${colors.reset}`)
    await Promise.all([
      waitForServer(API_PORT),
      waitForServer(WEB_PORT)
    ])

    console.log(`${colors.green}${colors.bright}Ready!${colors.reset} ${colors.dim}Opening browser...${colors.reset}\n`)

    if (!noOpen) {
      setTimeout(() => openBrowser(WEB_URL), 500)
    }
  } catch (err) {
    console.log(`${colors.red}${err.message}${colors.reset}`)
  }

  // Handle shutdown
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down...${colors.reset}`)
    serverProc.kill()
    webProc.kill()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Handle child process errors
  serverProc.on('error', (err) => {
    console.log(`${colors.red}API server error: ${err.message}${colors.reset}`)
  })

  webProc.on('error', (err) => {
    console.log(`${colors.red}Web frontend error: ${err.message}${colors.reset}`)
  })

  serverProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.red}API server exited with code ${code}${colors.reset}`)
    }
  })

  webProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.red}Web frontend exited with code ${code}${colors.reset}`)
    }
  })
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`)
  process.exit(1)
})
