/**
 * prjct CLI - Main Entry Point
 *
 * This file is required by bin/prjct after setup verification
 */

const PrjctCommands = require('./commands')
const registry = require('./command-registry')

async function main() {
  const [commandName, ...rawArgs] = process.argv.slice(2)

  // === SPECIAL COMMANDS (version, help) ===

  if (['-v', '--version', 'version'].includes(commandName)) {
    const packageJson = require('../package.json')
    console.log(`prjct-cli v${packageJson.version}`)
    process.exit(0)
  }

  if (['-h', '--help', 'help', undefined].includes(commandName)) {
    displayHelp()
    process.exit(0)
  }

  // === DYNAMIC COMMAND EXECUTION ===

  try {
    // 1. Find command in registry
    const cmd = registry.getByName(commandName)

    if (!cmd) {
      console.error(`Unknown command: ${commandName}`)
      console.error(`\nUse 'prjct --help' to see available commands.`)
      process.exit(1)
    }

    // 2. Check if deprecated
    if (cmd.deprecated) {
      console.error(`Command '${commandName}' is deprecated.`)
      if (cmd.replacedBy) {
        console.error(`Use 'prjct ${cmd.replacedBy}' instead.`)
      }
      process.exit(1)
    }

    // 3. Check if implemented
    if (!cmd.implemented) {
      console.error(`Command '${commandName}' exists but is not yet implemented.`)
      console.error(`Check the roadmap or contribute: https://github.com/jlopezlira/prjct-cli`)
      console.error(`\nUse 'prjct --help' to see available commands.`)
      process.exit(1)
    }

    // 4. Parse arguments
    const { parsedArgs, options } = parseCommandArgs(cmd, rawArgs)

    // 5. Instantiate commands handler
    const commands = new PrjctCommands()

    // 6. Execute command
    let result

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
    } else if (commandName === 'progress') {
      const period = parsedArgs[0] || 'week'
      result = await commands.progress(period)
    } else if (commandName === 'build') {
      const taskOrNumber = parsedArgs.join(' ')
      result = await commands.build(taskOrNumber)
    } else {
      // Standard commands
      const param = parsedArgs.join(' ') || null
      result = await commands[commandName](param)
    }

    // 7. Display result
    if (result && result.message) {
      console.log(result.message)
    }

    process.exit(result && result.success ? 0 : 1)
  } catch (error) {
    console.error('Error:', error.message)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

/**
 * Parse command arguments dynamically
 */
function parseCommandArgs(cmd, rawArgs) {
  const parsedArgs = []
  const options = {}

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
function displayHelp() {
  const categories = registry.getCategories()
  const categorizedCommands = {}

  // Group commands by category (exclude deprecated)
  registry.getTerminalCommands().forEach((cmd) => {
    if (cmd.deprecated) return

    if (!categorizedCommands[cmd.category]) {
      categorizedCommands[cmd.category] = []
    }
    categorizedCommands[cmd.category].push(cmd)
  })

  console.log('prjct - Developer momentum tool for solo builders')
  console.log('\nAvailable commands:\n')

  // Display commands by category
  Object.entries(categorizedCommands).forEach(([categoryKey, cmds]) => {
    const categoryInfo = categories[categoryKey]
    console.log(`  ${categoryInfo.title}:`)

    cmds.forEach((cmd) => {
      const params = cmd.params ? ` ${cmd.params}` : ''
      const spacing = ' '.repeat(Math.max(20 - cmd.name.length - params.length, 1))
      const impl = cmd.implemented ? '' : ' (not implemented)'
      console.log(`    ${cmd.name}${params}${spacing}${cmd.description}${impl}`)
    })

    console.log('')
  })

  const stats = registry.getStats()
  console.log(`Total: ${stats.implemented} implemented / ${stats.total} commands`)
  console.log('\nFor more info: https://prjct.app')
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
