#!/usr/bin/env node

/**
 * Local testing script for prjct-cli features
 * Run: node test-local.js [command] [args...]
 */

const path = require('path')

// Setup paths - go up one level since we're in tests/
const rootDir = path.join(__dirname, '..')
process.env.PRJCT_CLI_PATH = rootDir
const commands = require(path.join(rootDir, 'core', 'commands'))

// Mock agent as terminal
const mockAgent = {
  name: 'Terminal/CLI',
  type: 'terminal',
  config: {
    commandPrefix: 'prjct',
  },
}

async function runTest(command, args) {
  console.log(`\n🧪 Testing: prjct ${command} ${args.join(' ')}\n`)
  console.log('─'.repeat(50))

  try {
    // Set agent info
    commands.agentInfo = mockAgent

    // Initialize terminal agent
    const TerminalAgent = require(path.join(rootDir, 'core', 'agents', 'terminal-agent'))
    commands.agent = new TerminalAgent()

    // Handle multi-word commands (e.g., "agents init" -> "agentsInit")
    let methodName = command
    if (args.length > 0 && command === 'agents') {
      const subcommand = args.shift()
      methodName = `agents${subcommand.charAt(0).toUpperCase()}${subcommand.slice(1)}`
    }

    // Execute command directly
    if (typeof commands[methodName] !== 'function') {
      throw new Error(`Unknown command: ${methodName}`)
    }

    const result = await commands[methodName](...args)

    console.log(result)
    console.log('─'.repeat(50))
    console.log('✅ Test completed\n')
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('─'.repeat(50))
  }
}

// Parse arguments
const [,, command, ...args] = process.argv

if (!command) {
  console.log(`
📋 Test Local - prjct-cli

Usage: node test-local.js [command] [arguments]

Examples:
  node tests/test-local.js recap
  node tests/test-local.js now "My test task"
  node tests/test-local.js progress week
  node tests/test-local.js next

This will test the features with simplified output.
`)
  process.exit(0)
}

runTest(command, args)
