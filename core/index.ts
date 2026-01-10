/**
 * prjct CLI - Main Entry Point
 *
 * This file is required by bin/prjct after setup verification
 */

import { PrjctCommands } from './commands/index'
import { commandRegistry } from './commands/registry'
import './commands/register' // Ensure commands are registered
import out from './utils/output'
import type { CommandMeta } from './commands/registry'

interface ParsedCommandArgs {
  parsedArgs: string[]
  options: Record<string, string | boolean>
}

interface CommandResult {
  success?: boolean
  message?: string
}

async function main(): Promise<void> {
  const [commandName, ...rawArgs] = process.argv.slice(2)

  // === SPECIAL COMMANDS (version, help) ===

  if (['-v', '--version', 'version'].includes(commandName)) {
    const packageJson = await import('../package.json')
    console.log(`prjct-cli v${packageJson.version}`)
    process.exit(0)
  }

  if (['-h', '--help', undefined].includes(commandName)) {
    displayHelp()
    process.exit(0)
  }

  // === DYNAMIC COMMAND EXECUTION ===

  // Show branding header
  out.start()

  try {
    // 1. Find command in registry
    const cmd = commandRegistry.getByName(commandName)

    if (!cmd) {
      console.error(`Unknown command: ${commandName}`)
      console.error(`\nUse 'prjct --help' to see available commands.`)
      out.end()
      process.exit(1)
    }

    // 2. Check if deprecated
    if (cmd.deprecated) {
      console.error(`Command '${commandName}' is deprecated.`)
      if (cmd.replacedBy) {
        console.error(`Use 'prjct ${cmd.replacedBy}' instead.`)
      }
      out.end()
      process.exit(1)
    }

    // 3. Check if implemented
    if (!cmd.implemented) {
      console.error(`Command '${commandName}' exists but is not yet implemented.`)
      console.error(`Check the roadmap or contribute: https://github.com/jlopezlira/prjct-cli`)
      console.error(`\nUse 'prjct --help' to see available commands.`)
      out.end()
      process.exit(1)
    }

    // 4. Parse arguments
    const { parsedArgs, options } = parseCommandArgs(cmd, rawArgs)

    // 5. Instantiate commands handler
    const commands = new PrjctCommands()

    // 6. Execute command
    let result: CommandResult | undefined

    // Commands with special option handling
    if (commandName === 'design') {
      const target = parsedArgs.join(' ')
      result = await commands.design(target, options)
    } else if (commandName === 'analyze') {
      result = await commands.analyze(options)
    } else if (commandName === 'cleanup') {
      result = await commands.cleanup(options)
    } else if (commandName === 'setup') {
      result = await commands.setup(options)
    } else if (commandName === 'migrate-all') {
      result = await commands.migrateAll(options)
    } else {
      // Standard commands - type-safe invocation
      const param = parsedArgs.join(' ') || null
      const standardCommands: Record<string, (p: string | null) => Promise<CommandResult>> = {
        // Core workflow
        done: () => commands.done(),
        next: () => commands.next(),
        pause: (p) => commands.pause(p || ''),
        resume: (p) => commands.resume(p),
        // Planning
        init: (p) => commands.init(p),
        bug: (p) => commands.bug(p || ''),
        idea: (p) => commands.idea(p || ''),
        spec: (p) => commands.spec(p),
        ship: (p) => commands.ship(p),
        // Analytics
        dash: (p) => commands.dash(p || 'default'),
        help: (p) => commands.help(p || ''),
        // Maintenance
        recover: () => commands.recover(),
        undo: () => commands.undo(),
        redo: () => commands.redo(),
        history: () => commands.history(),
        // Setup
        sync: () => commands.sync(),
        start: () => commands.start(),
      }

      const handler = standardCommands[commandName]
      if (handler) {
        result = await handler(param)
      } else {
        throw new Error(`Command '${commandName}' has no handler`)
      }
    }

    // 7. Display result
    if (result && result.message) {
      console.log(result.message)
    }

    // Show branding footer
    out.end()
    process.exit(result && result.success ? 0 : 1)
  } catch (error) {
    console.error('Error:', (error as Error).message)
    if (process.env.DEBUG) {
      console.error((error as Error).stack)
    }
    // Show branding footer even on error
    out.end()
    process.exit(1)
  }
}

/**
 * Parse command arguments dynamically
 */
function parseCommandArgs(cmd: CommandMeta, rawArgs: string[]): ParsedCommandArgs {
  const parsedArgs: string[] = []
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]

    if (arg.startsWith('--')) {
      // Handle flags
      const flagName = arg.slice(2)

      // Check if next arg is a value
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        options[flagName] = rawArgs[++i]
      } else {
        options[flagName] = true
      }
    } else {
      parsedArgs.push(arg)
    }
  }

  return { parsedArgs, options }
}

/**
 * Display help using registry
 */
function displayHelp(): void {
  const categories = commandRegistry.getAllCategories()
  const categorizedCommands: Record<string, CommandMeta[]> = {}

  // Group commands by category (exclude deprecated)
  commandRegistry.getTerminalCommands().forEach((cmd) => {
    if (cmd.deprecated) return

    if (!categorizedCommands[cmd.group]) {
      categorizedCommands[cmd.group] = []
    }
    categorizedCommands[cmd.group].push(cmd)
  })

  console.log('prjct - Developer momentum tool for solo builders')
  console.log('\nAvailable commands:\n')

  // Display commands by category
  Object.entries(categorizedCommands).forEach(([categoryKey, cmds]) => {
    const categoryInfo = categories.get(categoryKey)
    console.log(`  ${categoryInfo?.title || categoryKey}:`)

    cmds.forEach((cmd) => {
      const params = cmd.params ? ` ${cmd.params}` : ''
      const spacing = ' '.repeat(Math.max(20 - cmd.name.length - params.length, 1))
      const impl = cmd.implemented ? '' : ' (not implemented)'
      console.log(`    ${cmd.name}${params}${spacing}${cmd.description}${impl}`)
    })

    console.log('')
  })

  const stats = commandRegistry.getStats()
  console.log(`Total: ${stats.implemented} implemented / ${stats.total} commands`)
  console.log('\nFor more info: https://prjct.app')
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', (error as Error).message)
  if (process.env.DEBUG) {
    console.error((error as Error).stack)
  }
  process.exit(1)
})
