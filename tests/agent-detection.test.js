#!/usr/bin/env node

/**
 * Test script for agent detection system
 * Run: node test-agent-detection.js
 */

const agentDetector = require('./core/agent-detector')

async function testAgentDetection() {
  console.log('🧪 Testing prjct-cli Agent Detection System\n')
  console.log('='.repeat(50))

  // Test 1: Auto-detection
  console.log('\n📍 Test 1: Auto-Detection')
  console.log('-'.repeat(30))

  const detected = await agentDetector.detect()
  console.log(`✅ Detected Agent: ${detected.name}`)
  console.log(`   Type: ${detected.type}`)
  console.log(`   Command Prefix: ${detected.config.commandPrefix}`)
  console.log('   Capabilities:')
  console.log(`   - MCP: ${detected.capabilities.mcp}`)
  console.log(`   - Markdown: ${detected.capabilities.markdown}`)
  console.log(`   - Colors: ${detected.capabilities.colors}`)
  console.log(`   - Interactive: ${detected.capabilities.interactive}`)

  // Test 2: Force different agents
  console.log('\n📍 Test 2: Force Different Agents')
  console.log('-'.repeat(30))

  // Test Claude
  agentDetector.reset()
  const claude = agentDetector.setAgent('claude')
  console.log('\n✅ Claude Code:')
  console.log(`   Response Style: ${claude.config.responseStyle}`)
  console.log(`   Has MCP: ${claude.capabilities.mcp}`)
  console.log(`   Config File: ${claude.config.configFile}`)

  // Test Codex
  agentDetector.reset()
  const codex = agentDetector.setAgent('codex')
  console.log('\n✅ OpenAI Codex:')
  console.log(`   Response Style: ${codex.config.responseStyle}`)
  console.log(`   Sandboxed: ${codex.environment.sandboxed}`)
  console.log(`   Config File: ${codex.config.configFile}`)

  // Test Terminal
  agentDetector.reset()
  const terminal = agentDetector.setAgent('terminal')
  console.log('\n✅ Terminal/CLI:')
  console.log(`   Response Style: ${terminal.config.responseStyle}`)
  console.log(`   Colors: ${terminal.capabilities.colors}`)
  console.log(`   Command Prefix: ${terminal.config.commandPrefix}`)

  // Test 3: Environment variable detection
  console.log('\n📍 Test 3: Environment Variable Detection')
  console.log('-'.repeat(30))

  // Simulate Codex environment
  process.env.CODEX_AGENT = 'true'
  agentDetector.reset()
  const envCodex = await agentDetector.detect()
  console.log('\n✅ With CODEX_AGENT=true:')
  console.log(`   Detected: ${envCodex.name}`)
  delete process.env.CODEX_AGENT

  // Simulate Claude environment
  process.env.CLAUDE_AGENT = 'true'
  agentDetector.reset()
  const envClaude = await agentDetector.detect()
  console.log('\n✅ With CLAUDE_AGENT=true:')
  console.log(`   Detected: ${envClaude.name}`)
  delete process.env.CLAUDE_AGENT

  // Test 4: Agent adapters
  console.log('\n📍 Test 4: Agent Adapters')
  console.log('-'.repeat(30))

  try {
    const ClaudeAgent = require('./core/agents/claude-agent')
    const CodexAgent = require('./core/agents/codex-agent')
    const TerminalAgent = require('./core/agents/terminal-agent')

    const claudeAdapter = new ClaudeAgent()
    const codexAdapter = new CodexAgent()
    const terminalAdapter = new TerminalAgent()

    console.log('\n✅ Claude Adapter:')
    console.log(`   ${claudeAdapter.formatResponse('Test message', 'success')}`)

    console.log('\n✅ Codex Adapter:')
    console.log(`   ${codexAdapter.formatResponse('Test message', 'success')}`)

    console.log('\n✅ Terminal Adapter:')
    console.log(`   ${terminalAdapter.formatResponse('Test message', 'success')}`)
  } catch (error) {
    console.error('❌ Error loading adapters:', error.message)
  }

  // Test 5: Commands integration
  console.log('\n📍 Test 5: Commands Integration')
  console.log('-'.repeat(30))

  try {
    const commands = require('./core/commands')

    // This will trigger agent detection
    await commands.initializeAgent()

    console.log('✅ Commands module initialized with agent detection')
    console.log(`   Agent: ${commands.agentInfo ? commands.agentInfo.name : 'Not detected'}`)
  } catch (error) {
    console.error('❌ Error in commands integration:', error.message)
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Agent Detection Tests Complete!')
  console.log('\nTo test with different agents:')
  console.log('  export CODEX_AGENT=true   # For OpenAI Codex')
  console.log('  export CLAUDE_AGENT=true  # For Claude Code')
  console.log('  (no export)              # For Terminal/CLI')
}

// Run tests
testAgentDetection().catch(console.error)
