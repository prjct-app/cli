#!/usr/bin/env bun

/**
 * prjct dev - Start prjct web development environment
 *
 * Launches Next.js fullstack app on port 9472
 * - Frontend + API routes + WebSocket for PTY
 *
 * Usage: prjct dev [--no-open]
 */

const { spawn, exec } = require('child_process')
const path = require('path')
const os = require('os')

// Configuration
const PORT = process.env.PRJCT_PORT || 9472
const WEB_URL = `http://localhost:${PORT}`

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
  const locations = [
    path.join(__dirname, '..'),
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

  return locations[0]
}

const PRJCT_ROOT = findPrjctRoot()
const WEB_PATH = path.join(PRJCT_ROOT, 'packages', 'web')

// Print banner
function printBanner() {
  console.log(`
${colors.cyan}${colors.bright}╔═══════════════════════════════════════════════╗
║                                               ║
║   ⚡ prjct dev                                 ║
║                                               ║
║   App:     ${colors.green}http://localhost:${PORT}${colors.cyan}            ║
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

  // Check port
  const portAvailable = await checkPort(PORT)

  if (!portAvailable) {
    console.log(`${colors.red}Port ${PORT} is already in use. Stop other services or set PRJCT_PORT.${colors.reset}`)
    process.exit(1)
  }

  printBanner()

  // Start Next.js with custom server
  console.log(`${colors.cyan}Starting prjct...${colors.reset}`)
  const webProc = spawn('npm', ['run', 'dev'], {
    cwd: WEB_PATH,
    env: { ...process.env, PORT: PORT.toString() },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  webProc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(line => {
      // Show relevant output
      if (line.includes('ready') || line.includes('Ready') || line.includes('[WS]')) {
        console.log(`${colors.green}${line}${colors.reset}`)
      } else if (!line.includes('╔') && !line.includes('║') && !line.includes('╚')) {
        console.log(`${colors.dim}${line}${colors.reset}`)
      }
    })
  })

  webProc.stderr.on('data', (data) => {
    const msg = data.toString().trim()
    // Filter out common non-error messages
    if (!msg.includes('ExperimentalWarning') && !msg.includes('punycode')) {
      console.log(`${colors.red}${msg}${colors.reset}`)
    }
  })

  // Wait for server and open browser
  try {
    console.log(`${colors.dim}Waiting for server to start...${colors.reset}`)
    await waitForServer(PORT)

    console.log(`${colors.green}${colors.bright}Ready!${colors.reset}\n`)

    if (!noOpen) {
      setTimeout(() => openBrowser(WEB_URL), 500)
    }
  } catch (err) {
    console.log(`${colors.red}${err.message}${colors.reset}`)
  }

  // Handle shutdown
  const cleanup = () => {
    console.log(`\n${colors.yellow}Shutting down...${colors.reset}`)
    webProc.kill()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  webProc.on('error', (err) => {
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`)
  })

  webProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.red}Exited with code ${code}${colors.reset}`)
    }
  })
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`)
  process.exit(1)
})
