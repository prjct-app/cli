#!/usr/bin/env node

/**
 * Interactive Claude Installation for prjct-cli
 *
 * 100% Claude-focused architecture
 * Simplified installation with automatic detection
 *
 * @version 0.5.0
 */

const installer = require('../core/infrastructure/command-installer')

async function main() {
  // Dynamic import for ESM-only @clack/prompts
  const p = await import('@clack/prompts')

  try {
    p.intro('⚡ prjct-cli installer')

    const s = p.spinner()
    s.start('Detecting Claude installation...')

    // Detect Claude
    const claudeDetected = await installer.detectClaude()

    if (!claudeDetected) {
      s.stop('Claude not detected')
      p.note(
        [
          'prjct-cli requires Claude Code or Claude Desktop.',
          '',
          'Please install Claude and try again:',
          '  • Claude Code: https://claude.ai/code',
          '  • Claude Desktop: https://claude.ai/download',
        ].join('\n'),
        'Not found'
      )
      p.outro('Installation aborted.')
      process.exit(1)
    }

    s.stop('Claude detected')

    // Show confirmation
    const proceed = await p.confirm({
      message: 'Install prjct commands to Claude?',
      initialValue: true,
    })

    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Installation cancelled.')
      process.exit(0)
    }

    const installSpinner = p.spinner()
    installSpinner.start('Installing commands to Claude...')

    // Install to Claude
    const result = await installer.installCommands()

    if (result.success) {
      installSpinner.stop('Installation successful!')

      const cmdList = result.installed.map((cmd) => `  p. ${cmd}`).join('\n')
      p.note(
        [`Installed ${result.installed.length} commands to:`, `  ${result.path}`, '', cmdList].join(
          '\n'
        ),
        'Commands installed'
      )

      p.outro('Ready to use in Claude Code and Claude Desktop!')
    } else {
      installSpinner.stop('Installation failed')
      p.log.error(result.error)
      process.exit(1)
    }

    // Output result as JSON for bash script to parse
    console.log('__RESULT_START__')
    console.log(JSON.stringify(result, null, 2))
    console.log('__RESULT_END__')

    process.exit(0)
  } catch (error) {
    p.log.error(`Installation failed: ${error.message}`)

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
