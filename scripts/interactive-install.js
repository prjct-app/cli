#!/usr/bin/env node

/**
 * Interactive Claude Installation for prjct-cli
 *
 * 100% Claude-focused architecture
 * Simplified installation with automatic detection
 *
 * @version 0.5.0
 */

const prompts = require('prompts')
const installer = require('../core/command-installer')

async function main() {
  try {
    console.log('')
    console.log('🔍 Detecting Claude installation...')
    console.log('')

    // Detect Claude
    const claudeDetected = await installer.detectClaude()

    if (!claudeDetected) {
      console.log('❌ Claude not detected on this system.')
      console.log('')
      console.log('prjct-cli requires Claude Code or Claude Desktop.')
      console.log('')
      console.log('Please install Claude and try again:')
      console.log('  • Claude Code: https://claude.ai/code')
      console.log('  • Claude Desktop: https://claude.ai/download')
      console.log('')
      process.exit(1)
    }

    // Show confirmation
    const response = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Install prjct commands to Claude?',
      initial: true,
    })

    // Check if user cancelled
    if (!response.proceed) {
      console.log('')
      console.log('Installation cancelled.')
      process.exit(0)
    }

    console.log('')
    console.log('📦 Installing commands to Claude...')
    console.log('')

    // Install to Claude
    const result = await installer.installCommands()

    if (result.success) {
      console.log('')
      console.log('✅ Installation successful!')
      console.log('')
      console.log(`Installed ${result.installed.length} commands to:`)
      console.log(`  ${result.path}`)
      console.log('')
      console.log('Commands installed:')
      result.installed.forEach(cmd => {
        console.log(`  • /p:${cmd}`)
      })
      console.log('')
      console.log('Ready to use in Claude Code and Claude Desktop!')
      console.log('')
    } else {
      console.error('')
      console.error('❌ Installation failed:', result.error)
      console.error('')
      process.exit(1)
    }

    // Output result as JSON for bash script to parse
    console.log('__RESULT_START__')
    console.log(JSON.stringify(result, null, 2))
    console.log('__RESULT_END__')

    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('❌ Installation failed:', error.message)
    console.error('')

    // Output error result
    const errorResult = {
      success: false,
      error: error.message,
      installed: [],
    }

    console.log('__RESULT_START__')
    console.log(JSON.stringify(errorResult, null, 2))
    console.log('__RESULT_END__')

    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

module.exports = main
