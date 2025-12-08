#!/usr/bin/env node

/**
 * prjct serve - Start the web server
 *
 * Launches the prjct web interface with Claude Code CLI integration.
 * Uses your existing Claude subscription via PTY - no API costs!
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const serverDir = path.join(__dirname, '..', 'packages', 'server')
const webDir = path.join(__dirname, '..', 'packages', 'web')

// Parse arguments
const args = process.argv.slice(2)
const portArg = args.find(a => a.startsWith('--port='))
const port = portArg ? portArg.split('=')[1] : '3333'
const webPort = '3000'

// Check if packages exist
if (!fs.existsSync(serverDir) || !fs.existsSync(webDir)) {
  console.error('❌ Web packages not found. Run from prjct-cli directory.')
  process.exit(1)
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Developer Momentum                          ║
║                                                           ║
║   Starting web server...                                  ║
║                                                           ║
║   API:     http://localhost:${port}                          ║
║   Web:     http://localhost:${webPort}                          ║
║   Claude:  ws://localhost:${port}/ws/claude                  ║
║                                                           ║
║   Using your Claude subscription - $0 API costs           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)

// Start server
const server = spawn('npm', ['run', 'dev'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port }
})

// Start web dev server
const web = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'inherit',
  shell: true
})

// Handle shutdown
const cleanup = () => {
  console.log('\n👋 Shutting down prjct server...')
  server.kill()
  web.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Handle errors
server.on('error', (err) => {
  console.error('Server error:', err.message)
})

web.on('error', (err) => {
  console.error('Web error:', err.message)
})
