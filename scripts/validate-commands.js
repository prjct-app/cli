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
 * @version 0.5.0
 */

const fs = require('fs').promises
const path = require('path')
const registry = require('../core/command-registry')

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

async function validateTemplates() {
  console.log('\n' + colorize('='.repeat(60), 'cyan'))
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
  const allCommands = registry.getAll()

  // Check: Commands with hasTemplate=true should have template files
  allCommands.forEach((cmd) => {
    if (cmd.hasTemplate && !templateFiles.includes(cmd.name)) {
      errors.push(
        `Command '${cmd.name}' has hasTemplate=true but no template file exists at templates/commands/${cmd.name}.md`
      )
    }
  })

  // Check: Template files should have corresponding registry entries
  templateFiles.forEach((filename) => {
    const cmd = registry.getByName(filename)
    if (!cmd) {
      errors.push(`Template file '${filename}.md' exists but has no entry in command registry`)
    } else if (!cmd.hasTemplate) {
      errors.push(
        `Template file '${filename}.md' exists but command has hasTemplate=false in registry`
      )
    }
  })

  if (errors.length > 0) {
    console.log(colorize(`\n✗ Found ${errors.length} template validation errors:\n`, 'red'))
    errors.forEach((err) => console.log(colorize(`  - ${err}`, 'red')))
    return { valid: false, errors }
  } else {
    console.log(colorize('\n✓ All template files are consistent with registry', 'green'))
    return { valid: true, errors: [] }
  }
}

async function validateImplementation() {
  console.log('\n' + colorize('='.repeat(60), 'cyan'))
  console.log(colorize('VALIDATING IMPLEMENTATION', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const commandsFile = path.join(__dirname, '..', 'core', 'commands.js')
  const binFile = path.join(__dirname, '..', 'bin', 'prjct')

  let commandsContent, binContent

  try {
    commandsContent = await fs.readFile(commandsFile, 'utf-8')
    binContent = await fs.readFile(binFile, 'utf-8')
  } catch (error) {
    console.error(colorize(`✗ Cannot read implementation files: ${error.message}`, 'red'))
    return { valid: false, errors: [error.message] }
  }

  const errors = []
  const warnings = []
  const allCommands = registry.getAll()

  // Check: Commands with implemented=true should have methods in commands.js
  allCommands.forEach((cmd) => {
    if (cmd.implemented) {
      // Convert kebab-case to camelCase for method names
      const methodName = cmd.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      const methodPattern = new RegExp(`async\\s+${methodName}\\s*\\(`, 'i')
      if (!commandsContent.match(methodPattern)) {
        errors.push(
          `Command '${cmd.name}' has implemented=true but no method found in core/commands.js (expected: ${methodName})`
        )
      }
    }
  })

  // Check: Terminal commands should have switch cases in bin/prjct
  allCommands.forEach((cmd) => {
    if (cmd.usage.terminal && cmd.implemented) {
      const switchPattern = new RegExp(`case\\s+['"\`]${cmd.name}['"\`]:`, 'i')
      if (!binContent.match(switchPattern)) {
        errors.push(`Command '${cmd.name}' is implemented but missing switch case in bin/prjct`)
      }
    }
  })

  // Check: Commands marked as not implemented should warn
  allCommands.forEach((cmd) => {
    if (!cmd.implemented && cmd.hasTemplate) {
      warnings.push(
        `Command '${cmd.name}' has template but is not yet implemented (this is OK for future features)`
      )
    }
  })

  if (errors.length > 0) {
    console.log(colorize(`\n✗ Found ${errors.length} implementation errors:\n`, 'red'))
    errors.forEach((err) => console.log(colorize(`  - ${err}`, 'red')))
  } else {
    console.log(colorize('\n✓ All implemented commands are consistent', 'green'))
  }

  if (warnings.length > 0) {
    console.log(colorize(`\n⚠ Found ${warnings.length} warnings:\n`, 'yellow'))
    warnings.forEach((warn) => console.log(colorize(`  - ${warn}`, 'yellow')))
  }

  return { valid: errors.length === 0, errors, warnings }
}

async function validateRegistry() {
  console.log('\n' + colorize('='.repeat(60), 'cyan'))
  console.log(colorize('VALIDATING REGISTRY STRUCTURE', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const validation = registry.validate()

  // Separate warnings from errors
  const errors = validation.issues.filter(
    (issue) => !issue.includes('Commands with templates but not implemented')
  )
  const warnings = validation.issues.filter((issue) =>
    issue.includes('Commands with templates but not implemented')
  )

  if (errors.length === 0) {
    console.log(colorize('\n✓ Registry structure is valid', 'green'))
  } else {
    console.log(colorize(`\n✗ Found ${errors.length} registry structure errors:\n`, 'red'))
    errors.forEach((issue) => console.log(colorize(`  - ${issue}`, 'red')))
  }

  if (warnings.length > 0) {
    console.log(colorize(`\n⚠ Found ${warnings.length} registry warnings:\n`, 'yellow'))
    warnings.forEach((issue) => console.log(colorize(`  - ${issue}`, 'yellow')))
  }

  return { valid: errors.length === 0, issues: errors, warnings }
}

function displayStatistics() {
  console.log('\n' + colorize('='.repeat(60), 'cyan'))
  console.log(colorize('COMMAND STATISTICS', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const stats = registry.getStats()

  console.log(`\n${colorize('Total Commands:', 'blue')} ${stats.total}`)
  console.log(`${colorize('Implemented:', 'green')} ${stats.implemented}`)
  console.log(`${colorize('With Templates:', 'blue')} ${stats.withTemplates}`)
  console.log(`${colorize('Claude & Terminal:', 'magenta')} ${stats.both}`)
  console.log(`${colorize('Claude Only:', 'yellow')} ${stats.claudeOnly}`)
  console.log(`${colorize('Terminal Only:', 'yellow')} ${stats.terminalOnly}`)

  console.log(`\n${colorize('By Category:', 'blue')}`)
  Object.entries(stats.byCategory).forEach(([category, count]) => {
    const categoryInfo = registry.getCategory(category)
    console.log(`  ${categoryInfo.title}: ${count}`)
  })
}

async function main() {
  console.log(colorize('\n╔════════════════════════════════════════════════════════════╗', 'cyan'))
  console.log(colorize('║         PRJCT COMMAND REGISTRY VALIDATION TOOL             ║', 'cyan'))
  console.log(colorize('╚════════════════════════════════════════════════════════════╝', 'cyan'))

  const results = {
    registry: await validateRegistry(),
    templates: await validateTemplates(),
    implementation: await validateImplementation(),
  }

  displayStatistics()

  console.log('\n' + colorize('='.repeat(60), 'cyan'))
  console.log(colorize('VALIDATION SUMMARY', 'cyan'))
  console.log(colorize('='.repeat(60), 'cyan'))

  const allValid = results.registry.valid && results.templates.valid && results.implementation.valid

  if (allValid) {
    console.log(colorize('\n✓✓✓ ALL VALIDATIONS PASSED ✓✓✓', 'green'))
    console.log(colorize('\nCommand registry is consistent across all systems!\n', 'green'))
    process.exit(0)
  } else {
    console.log(colorize('\n✗✗✗ VALIDATION FAILED ✗✗✗', 'red'))

    const totalErrors =
      (results.registry.issues?.length || 0) +
      (results.templates.errors?.length || 0) +
      (results.implementation.errors?.length || 0)

    console.log(colorize(`\nFound ${totalErrors} total errors that need fixing.\n`, 'red'))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(colorize(`\n✗ Validation script crashed: ${error.message}`, 'red'))
  console.error(error.stack)
  process.exit(1)
})
