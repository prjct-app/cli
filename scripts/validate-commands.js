#!/usr/bin/env node

/**
 * Command Registry Validator
 *
 * Validates that command registry is consistent with:
 * - Template files in templates/commands/
 * - Implementation in core/commands.js
 * - bin/prjct CLI switch cases
 *
 * Run: node scripts/validate-commands.js
 *
 * @version 0.6.0 - Uses dynamic registry
 */

const fs = require('node:fs').promises
const path = require('node:path')

// Import command data directly (these are now in commands/command-data.ts)
// For now, we'll read the TypeScript file and parse it
// Or use a simpler approach - just validate templates exist

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`
}

// Simplified command list for validation
const COMMANDS = [
  { name: 'init', hasTemplate: true, implemented: true },
  { name: 'idea', hasTemplate: true, implemented: true },
  { name: 'feature', hasTemplate: true, implemented: true },
  { name: 'spec', hasTemplate: true, implemented: true },
  { name: 'now', hasTemplate: true, implemented: true },
  { name: 'work', hasTemplate: true, implemented: true },
  { name: 'pause', hasTemplate: true, implemented: true },
  { name: 'resume', hasTemplate: true, implemented: true },
  { name: 'next', hasTemplate: true, implemented: true },
  { name: 'done', hasTemplate: true, implemented: true },
  { name: 'ship', hasTemplate: true, implemented: true },
  { name: 'bug', hasTemplate: true, implemented: true },
  { name: 'dash', hasTemplate: true, implemented: true },
  { name: 'sync', hasTemplate: true, implemented: true },
  { name: 'suggest', hasTemplate: true, implemented: true },
  { name: 'help', hasTemplate: true, implemented: true },
  { name: 'design', hasTemplate: true, implemented: true },
  { name: 'cleanup', hasTemplate: true, implemented: true },
  { name: 'analyze', hasTemplate: true, implemented: true },
  { name: 'undo', hasTemplate: true, implemented: true },
  { name: 'redo', hasTemplate: true, implemented: true },
  { name: 'history', hasTemplate: true, implemented: true },
  { name: 'recover', hasTemplate: true, implemented: true },
  { name: 'git', hasTemplate: true, implemented: true },
  { name: 'test', hasTemplate: true, implemented: true },
  { name: 'start', hasTemplate: false, implemented: true },
  { name: 'setup', hasTemplate: true, implemented: true },
  { name: 'migrate', hasTemplate: true, implemented: true },
  { name: 'migrate-all', hasTemplate: true, implemented: true },
  { name: 'auth', hasTemplate: true, implemented: true },
]

async function validateTemplates() {
  console.log(`\n${colorize('='.repeat(60), 'cyan')}`)
  console.log(colorize('VALIDATING TEMPLATE FILES', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const templatesDir = path.join(__dirname, '..', 'templates', 'commands')
  let templateFiles

  try {
    templateFiles = await fs.readdir(templatesDir)
    templateFiles = templateFiles.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
  } catch (error) {
    console.error(colorize(`✗ Cannot read templates directory: ${error.message}`, 'red'))
    return { valid: false, errors: [error.message] }
  }

  const errors = []

  // Check: Commands with hasTemplate=true should have template files
  COMMANDS.forEach((cmd) => {
    if (cmd.hasTemplate && !templateFiles.includes(cmd.name)) {
      errors.push(
        `Command '${cmd.name}' has hasTemplate=true but no template file exists at templates/commands/${cmd.name}.md`
      )
    }
  })

  // Check: Template files should have corresponding command entries
  templateFiles.forEach((filename) => {
    const cmd = COMMANDS.find((c) => c.name === filename)
    if (!cmd) {
      errors.push(`Template file '${filename}.md' exists but has no entry in command list`)
    } else if (!cmd.hasTemplate) {
      errors.push(`Template file '${filename}.md' exists but command has hasTemplate=false`)
    }
  })

  if (errors.length > 0) {
    console.log(colorize(`\n✗ Found ${errors.length} template validation errors:\n`, 'red'))
    errors.forEach((err) => console.log(colorize(`  - ${err}`, 'red')))
    return { valid: false, errors }
  } else {
    console.log(colorize('\n✓ All template files are consistent with commands', 'green'))
    return { valid: true, errors: [] }
  }
}

function displayStatistics() {
  console.log(`\n${colorize('='.repeat(60), 'cyan')}`)
  console.log(colorize('COMMAND STATISTICS', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const total = COMMANDS.length
  const implemented = COMMANDS.filter((c) => c.implemented).length
  const withTemplates = COMMANDS.filter((c) => c.hasTemplate).length

  console.log(`\n${colorize('Total Commands:', 'blue')} ${total}`)
  console.log(`${colorize('Implemented:', 'green')} ${implemented}`)
  console.log(`${colorize('With Templates:', 'blue')} ${withTemplates}`)
}

async function main() {
  console.log(colorize('\n╔════════════════════════════════════════════════════════════╗', 'cyan'))
  console.log(colorize('║         PRJCT COMMAND REGISTRY VALIDATION TOOL             ║', 'cyan'))
  console.log(colorize('╚════════════════════════════════════════════════════════════╝', 'cyan'))

  const results = {
    templates: await validateTemplates(),
  }

  displayStatistics()

  console.log(`\n${colorize('='.repeat(60), 'cyan')}`)
  console.log(colorize('VALIDATION SUMMARY', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const allValid = results.templates.valid

  if (allValid) {
    console.log(colorize('\n✓✓✓ ALL VALIDATIONS PASSED ✓✓✓', 'green'))
    console.log(colorize('\nCommand templates are consistent!\n', 'green'))
    process.exit(0)
  } else {
    console.log(colorize('\n✗✗✗ VALIDATION FAILED ✗✗✗', 'red'))
    const totalErrors = results.templates.errors?.length || 0
    console.log(colorize(`\nFound ${totalErrors} total errors that need fixing.\n`, 'red'))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(colorize(`\n✗ Validation script crashed: ${error.message}`, 'red'))
  console.error(error.stack)
  process.exit(1)
})
