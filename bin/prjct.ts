/**
 * prjct CLI entry point
 *
 * Auto-setup on first use (like Astro, Vite, etc.)
 * Supports both Bun and Node.js runtimes.
 */

import { VERSION } from '../core/utils/version'
import editorsConfig from '../core/infrastructure/editors-config'
import { startServer, DEFAULT_PORT } from '../core/server/server'
import configManager from '../core/infrastructure/config-manager'

// Check for special subcommands that bypass normal CLI
const args = process.argv.slice(2)

if (args[0] === 'dev') {
  // Dev mode - placeholder for future development server
  console.log('Dev mode is not yet implemented.')
  console.log('Use "prjct serve" to start the web server.')
  process.exitCode = 0
} else if (args[0] === 'web' || args[0] === 'serve') {
  // Launch prjct web server
  try {
    const projectPath = process.cwd()
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      console.error('No prjct project found. Run "prjct init" first.')
      process.exitCode = 1
    } else {
      const port = parseInt(args[1]) || DEFAULT_PORT
      await startServer(projectId, projectPath, port)
    }
  } catch (error) {
    console.error('Server error:', (error as Error).message)
    process.exitCode = 1
  }
} else {
  // Ensure setup has run for this version
  try {
    const lastVersion = await editorsConfig.getLastVersion()

    if (!lastVersion || lastVersion !== VERSION) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔧 One-time setup (v' + VERSION + ')...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      const { default: setup } = await import('../core/infrastructure/setup')
      await setup.run()

      console.log('✓ Setup complete!\n')
    }
  } catch (error) {
    console.error('\n⚠️  Setup warning:', (error as Error).message)
    console.error('You can run setup manually: prjct setup\n')
  }

  // Continue to main CLI logic
  await import('../core/index')
}
