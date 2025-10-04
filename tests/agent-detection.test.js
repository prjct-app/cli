#!/usr/bin/env node

/**
 * Test script for Claude agent detection system
 * 100% Claude-focused architecture
 *
 * Run: node tests/agent-detection.test.js
 *
 * @version 0.5.0
 */

const agentDetector = require('../core/infrastructure/agent-detector')

async function testClaudeDetection() {
  console.log('🧪 Testing prjct-cli Claude Detection System\n')
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
  console.log(`   - Agents: ${detected.capabilities.agents}`)

  // Test 2: Claude environment checks
  console.log('\n📍 Test 2: Claude Environment Checks')
  console.log('-'.repeat(30))

  const isClaude = agentDetector.isClaudeEnvironment()
  console.log(`\n✅ Is Claude Environment: ${isClaude}`)

  if (isClaude) {
    console.log('   Detection Signals:')
    console.log(`   - CLAUDE_AGENT env: ${!!process.env.CLAUDE_AGENT}`)
    console.log(`   - MCP available: ${!!global.mcp || !!process.env.MCP_AVAILABLE}`)
    console.log(
      `   - .claude directory: ${require('fs').existsSync(require('path').join(require('os').homedir(), '.claude'))}`
    )
  }

  // Test 3: Force Claude agent
  console.log('\n📍 Test 3: Force Claude Agent')
  console.log('-'.repeat(30))

  agentDetector.reset()
  const claude = agentDetector.setAgent('claude')
  console.log('\n✅ Claude Code + Desktop:')
  console.log(`   Response Style: ${claude.config.responseStyle}`)
  console.log(`   Has MCP: ${claude.capabilities.mcp}`)
  console.log(`   Config File: ${claude.config.configFile}`)
  console.log(`   Commands Dir: ${claude.config.commandsDir}`)
  console.log(`   Agents Dir: ${claude.config.agentsDir}`)

  // Test 4: Terminal fallback
  console.log('\n📍 Test 4: Terminal Fallback')
  console.log('-'.repeat(30))

  agentDetector.reset()
  const terminal = agentDetector.setAgent('terminal')
  console.log('\n✅ Terminal/CLI (Fallback):')
  console.log(`   Response Style: ${terminal.config.responseStyle}`)
  console.log(`   Colors: ${terminal.capabilities.colors}`)
  console.log(`   Command Prefix: ${terminal.config.commandPrefix}`)
  console.log(`   Agents Support: ${terminal.capabilities.agents}`)

  // Test 5: Environment variable detection
  console.log('\n📍 Test 5: Environment Variable Detection')
  console.log('-'.repeat(30))

  // Simulate Claude environment
  process.env.CLAUDE_AGENT = 'true'
  agentDetector.reset()
  const envClaude = await agentDetector.detect()
  console.log('\n✅ With CLAUDE_AGENT=true:')
  console.log(`   Detected: ${envClaude.name}`)
  console.log(`   Type: ${envClaude.type}`)
  delete process.env.CLAUDE_AGENT

  // Simulate MCP environment
  process.env.MCP_AVAILABLE = 'true'
  agentDetector.reset()
  const mcpClaude = await agentDetector.detect()
  console.log('\n✅ With MCP_AVAILABLE=true:')
  console.log(`   Detected: ${mcpClaude.name}`)
  console.log(`   Has MCP: ${mcpClaude.capabilities.mcp}`)
  delete process.env.MCP_AVAILABLE

  // Test 6: Claude agent adapter
  console.log('\n📍 Test 6: Claude Agent Adapter')
  console.log('-'.repeat(30))

  try {
    const ClaudeAgent = require('../core/infrastructure/agents/claude-agent')
    const claudeAdapter = new ClaudeAgent()

    console.log('\n✅ Claude Adapter:')
    console.log(`   Success: ${claudeAdapter.formatResponse('Feature shipped!', 'success')}`)
    console.log(`   Error: ${claudeAdapter.formatResponse('Build failed', 'error')}`)
    console.log(`   Info: ${claudeAdapter.formatResponse('Processing...', 'info')}`)
  } catch (error) {
    console.error('❌ Error loading Claude adapter:', error.message)
  }

  // Test 7: Commands integration
  console.log('\n📍 Test 7: Commands Integration')
  console.log('-'.repeat(30))

  try {
    const commands = require('../core/commands')

    // This will trigger agent detection
    await commands.initializeAgent()

    console.log('✅ Commands module initialized with Claude detection')
    console.log(`   Agent: ${commands.agentInfo ? commands.agentInfo.name : 'Not detected'}`)
    console.log(`   Agent Type: ${commands.agentInfo ? commands.agentInfo.type : 'N/A'}`)
  } catch (error) {
    console.error('❌ Error in commands integration:', error.message)
  }

  // Test 8: isClaude() and isTerminal() helpers
  console.log('\n📍 Test 8: Helper Methods')
  console.log('-'.repeat(30))

  agentDetector.reset()
  await agentDetector.detect()

  console.log(`\n✅ isClaude(): ${agentDetector.isClaude()}`)
  console.log(`   isTerminal(): ${agentDetector.isTerminal()}`)

  console.log('\n' + '='.repeat(50))
  console.log('✅ Claude Detection Tests Complete!')
  console.log('\nTo test with different environments:')
  console.log('  export CLAUDE_AGENT=true      # Force Claude detection')
  console.log('  export MCP_AVAILABLE=true     # Simulate MCP environment')
  console.log('  export ANTHROPIC_CLAUDE=true  # Alternative Claude detection')
  console.log('  (no export)                   # Terminal/CLI fallback')
  console.log('\n🚀 Built for Claude - Ship fast, no BS')
}

// Run tests
testClaudeDetection().catch(console.error)
