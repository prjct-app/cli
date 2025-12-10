#!/usr/bin/env bun

/**
 * prjct generate-views - Generate MD views from JSON data
 *
 * Converts JSON source of truth to readable MD files for Claude.
 *
 * Usage:
 *   prjct generate-views --project=<projectId>   Generate views for specific project
 *   prjct generate-views --all                   Generate views for all projects
 *   prjct generate-views --view=<name>           Generate specific view (now, next, ideas, roadmap, shipped)
 */

const path = require('path')
const fs = require('fs/promises')
const os = require('os')

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
}

const GLOBAL_STORAGE = path.join(os.homedir(), '.prjct-cli', 'projects')

// Parse command line arguments
function parseArgs(argv) {
  const args = {
    project: null,
    all: false,
    view: null,
    help: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true
    } else if (arg === '--all') {
      args.all = true
    } else if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1]
    } else if (arg.startsWith('--view=')) {
      args.view = arg.split('=')[1]
    }
  }

  return args
}

// Print help message
function printHelp() {
  console.log(`
${colors.cyan}${colors.bright}prjct generate-views${colors.reset}

Generate MD views from JSON data files.

${colors.bright}Usage:${colors.reset}
  prjct generate-views --project=<projectId>   Generate views for specific project
  prjct generate-views --all                   Generate views for all projects
  prjct generate-views --view=<name>           Generate specific view only

${colors.bright}Options:${colors.reset}
  --project=<id>    Project ID to generate views for
  --all             Generate views for all projects
  --view=<name>     Generate specific view (now, next, ideas, roadmap, shipped)
  --help, -h        Show this help message

${colors.bright}Views:${colors.reset}
  now      Current task status (from state.json)
  next     Priority queue (from queue.json)
  ideas    Idea backlog (from ideas.json)
  roadmap  Feature roadmap (from roadmap.json)
  shipped  Shipped items (from shipped.json)

${colors.bright}Examples:${colors.reset}
  prjct generate-views --project=abc123
  prjct generate-views --all
  prjct generate-views --project=abc123 --view=now
`)
}

// Get list of all project IDs
async function getAllProjects() {
  try {
    const entries = await fs.readdir(GLOBAL_STORAGE, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

// Import and run the view generator
async function generateViews(projectId, viewName = null) {
  // Dynamic import of the TypeScript module
  const generatorPath = path.join(__dirname, '..', 'core', 'view-generator.ts')

  try {
    const generator = await import(generatorPath)

    if (viewName) {
      // Generate specific view
      await generator.generateView(projectId, viewName)
      return { generated: [`${viewName}.md`], errors: [] }
    } else {
      // Generate all views
      return await generator.generateViews(projectId)
    }
  } catch (err) {
    return {
      generated: [],
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    }
  }
}

// Main function
async function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  // Validate arguments
  if (!args.project && !args.all) {
    console.log(`${colors.red}Error: Specify --project=<id> or --all${colors.reset}`)
    console.log(`${colors.dim}Run 'prjct generate-views --help' for usage${colors.reset}`)
    process.exit(1)
  }

  // Validate view name if specified
  const validViews = ['now', 'next', 'ideas', 'roadmap', 'shipped']
  if (args.view && !validViews.includes(args.view)) {
    console.log(`${colors.red}Error: Invalid view '${args.view}'${colors.reset}`)
    console.log(`${colors.dim}Valid views: ${validViews.join(', ')}${colors.reset}`)
    process.exit(1)
  }

  // Get projects to process
  let projects = []
  if (args.all) {
    projects = await getAllProjects()
    if (projects.length === 0) {
      console.log(`${colors.yellow}No projects found in ${GLOBAL_STORAGE}${colors.reset}`)
      process.exit(0)
    }
  } else {
    projects = [args.project]
  }

  console.log(`${colors.cyan}${colors.bright}Generating views...${colors.reset}\n`)

  let totalGenerated = 0
  let totalErrors = 0

  for (const projectId of projects) {
    const projectPath = path.join(GLOBAL_STORAGE, projectId)

    // Check project exists
    try {
      await fs.access(projectPath)
    } catch {
      console.log(`${colors.yellow}⚠ Project not found: ${projectId}${colors.reset}`)
      totalErrors++
      continue
    }

    const result = await generateViews(projectId, args.view)

    if (result.generated.length > 0) {
      console.log(`${colors.green}✓ ${projectId}${colors.reset}`)
      for (const file of result.generated) {
        console.log(`  ${colors.dim}→ ${file}${colors.reset}`)
      }
      totalGenerated += result.generated.length
    }

    if (result.errors.length > 0) {
      console.log(`${colors.red}✗ ${projectId}${colors.reset}`)
      for (const error of result.errors) {
        console.log(`  ${colors.red}→ ${error}${colors.reset}`)
      }
      totalErrors += result.errors.length
    }
  }

  // Summary
  console.log('')
  if (totalGenerated > 0) {
    console.log(`${colors.green}${colors.bright}✓ Generated ${totalGenerated} view(s)${colors.reset}`)
  }
  if (totalErrors > 0) {
    console.log(`${colors.red}✗ ${totalErrors} error(s)${colors.reset}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`)
  process.exit(1)
})
