/**
 * Command Registry - Single Source of Truth
 *
 * All prjct commands are defined here with metadata.
 * This registry is used by:
 * - bin/prjct (terminal CLI)
 * - website/Commands.tsx (documentation site)
 * - CLAUDE.md (AI assistant instructions)
 * - scripts/validate-commands.js (validation)
 *
 * @version 0.6.0 - Simplified workflow with 9 core commands
 */

const COMMANDS = [
  // ===== CORE WORKFLOW COMMANDS (9 essential) =====

  // 1. Initialize
  {
    name: 'init',
    category: 'core',
    description: 'Deep project analysis and initialization',
    usage: {
      claude: '/p:init',
      terminal: 'prjct init',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Zap',
    requiresInit: false,
    blockingRules: null,
    features: [
      'Analyzes codebase structure',
      'Reviews docs and GitHub',
      'Generates project summary',
      'Creates initial roadmap',
    ],
  },

  // 2. Agentic Idea Evaluation
  {
    name: 'idea',
    category: 'core',
    description: 'AI-powered idea evaluation with risk assessment',
    usage: {
      claude: '/p:idea "add dark mode"',
      terminal: 'prjct idea "add dark mode"',
    },
    params: '<text>',
    implemented: false, // Needs agentic enhancement
    hasTemplate: true,
    icon: 'Lightbulb',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Risk assessment (low/medium/high)',
      'Time estimation',
      'Task breakdown',
      'Optimal timing recommendation',
      'ASCII decision tree',
      'Interactive keep/discard',
    ],
  },

  // 3. Strategic Roadmap
  {
    name: 'roadmap',
    category: 'core',
    description: 'Strategic planning with ASCII logic maps',
    usage: {
      claude: '/p:roadmap',
      terminal: 'prjct roadmap',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'Map',
    requiresInit: true,
    blockingRules: null,
    features: [
      'ASCII logic maps (not mermaid)',
      'Shows approved ideas',
      'Implementation status',
      'Dependencies visualization',
    ],
  },

  // 4. Status Dashboard
  {
    name: 'status',
    category: 'core',
    description: 'KPI dashboard with ASCII graphics',
    usage: {
      claude: '/p:status',
      terminal: 'prjct status',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'BarChart3',
    requiresInit: true,
    blockingRules: null,
    features: [
      'ASCII progress bars',
      'Task completion metrics',
      'Current focus display',
      'Time tracking',
      'Visual KPI dashboard',
    ],
  },

  // 5. Current Task
  {
    name: 'now',
    category: 'core',
    description: 'Show current working task',
    usage: {
      claude: '/p:now',
      terminal: 'prjct now',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
    requiresInit: true,
    blockingRules: null,
  },

  // 6. Build (Start Task)
  {
    name: 'build',
    category: 'core',
    description: 'Start task with agent assignment and tracking',
    usage: {
      claude: '/p:build "implement auth"',
      terminal: 'prjct build "implement auth"',
    },
    params: '<task> | [1-5]',
    implemented: false,
    hasTemplate: true,
    icon: 'Play',
    requiresInit: true,
    blockingRules: {
      check: 'now.md must be empty',
      message: 'Complete current task with /p:done first',
    },
    features: [
      'Agent assignment (auto or manual)',
      'GitHub dev tracking',
      'Time estimation by complexity',
      'Start time tracking',
      'Moves to now.md with metadata',
    ],
  },

  // 7. Next Tasks
  {
    name: 'next',
    category: 'core',
    description: 'Show top 5 non-blocking priority tasks',
    usage: {
      claude: '/p:next',
      terminal: 'prjct next',
    },
    params: null,
    implemented: true, // Needs blocking logic
    hasTemplate: true,
    icon: 'List',
    requiresInit: true,
    blockingRules: {
      check: 'filters blocked tasks',
      message: 'Shows warning if now.md is active',
    },
    features: [
      'Filters out blocked tasks',
      'Shows top 5 by priority',
      'Numbered 1-5 for quick selection',
      'Warns if active task exists',
    ],
  },

  // 8. Complete Task
  {
    name: 'done',
    category: 'core',
    description: 'Mark current task as complete',
    usage: {
      claude: '/p:done',
      terminal: 'prjct done',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'CheckCircle',
    requiresInit: true,
    blockingRules: {
      check: 'now.md must have content',
      message: 'No active task to complete',
    },
  },

  // 9. Ship Feature
  {
    name: 'ship',
    category: 'core',
    description: 'Commit, push, and celebrate shipped feature',
    usage: {
      claude: '/p:ship "user authentication"',
      terminal: 'prjct ship "user authentication"',
    },
    params: '<feature>',
    implemented: false, // Needs Git integration
    hasTemplate: true,
    icon: 'Rocket',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Auto-generates commit message',
      'Adds "Generated-by: prjct/cli" footer',
      'Interactive push confirmation',
      'Moves to shipped.md',
      'Completion metadata tracking',
    ],
  },

  // ===== OPTIONAL COMMANDS (Advanced features) =====
  {
    name: 'workflow',
    category: 'optional',
    description: 'Cascading agentic workflow for complex tasks',
    usage: {
      claude: '/p:workflow',
      terminal: 'prjct workflow',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'GitBranch',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },
  {
    name: 'design',
    category: 'optional',
    description: 'Design system architecture, APIs, and components',
    usage: {
      claude: '/p:design authentication --type architecture',
      terminal: 'prjct design authentication --type architecture',
    },
    params: '[target] --type architecture|api|component|database|flow',
    implemented: true,
    hasTemplate: true,
    icon: 'Palette',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },
  {
    name: 'cleanup',
    category: 'optional',
    description: 'Clean up temp files and old entries',
    usage: {
      claude: '/p:cleanup',
      terminal: 'prjct cleanup',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Zap',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },
  {
    name: 'stuck',
    category: 'optional',
    description: 'Get contextual help with problems',
    usage: {
      claude: '/p:stuck "CORS error in API calls"',
      terminal: 'prjct stuck "CORS error in API calls"',
    },
    params: '<issue description>',
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },
  {
    name: 'analyze',
    category: 'optional',
    description: 'Analyze repository and sync tasks',
    usage: {
      claude: '/p:analyze',
      terminal: 'prjct analyze',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Search',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },
  {
    name: 'sync',
    category: 'optional',
    description: 'Sync project state and update workflow agents',
    usage: {
      claude: '/p:sync',
      terminal: 'prjct sync',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'RefreshCw',
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },

  // ===== SETUP COMMANDS (Not part of daily workflow) =====
  {
    name: 'start',
    category: 'setup',
    description: 'First-time setup (install commands to editors)',
    usage: {
      claude: null,
      terminal: 'prjct start',
    },
    params: null,
    implemented: true,
    hasTemplate: false,
    icon: 'Terminal',
    requiresInit: false,
    blockingRules: null,
  },
  {
    name: 'setup',
    category: 'setup',
    description: 'Reconfigure editor installations',
    usage: {
      claude: null,
      terminal: 'prjct setup [--force] [--editor <name>]',
    },
    params: '[--force] [--editor <name>]',
    implemented: true,
    hasTemplate: false,
    icon: 'Settings',
    requiresInit: false,
    blockingRules: null,
  },
  {
    name: 'migrate-all',
    category: 'setup',
    description: 'Migrate all legacy projects',
    usage: {
      claude: null,
      terminal: 'prjct migrate-all [--deep-scan] [--remove-legacy] [--dry-run]',
    },
    params: '[--deep-scan] [--remove-legacy] [--dry-run]',
    implemented: true,
    hasTemplate: false,
    icon: 'Database',
    requiresInit: false,
    blockingRules: null,
  },
]

/**
 * Category metadata
 */
const CATEGORIES = {
  core: {
    title: 'Core Workflow',
    icon: 'Zap',
    description: '9 essential commands for daily development workflow',
    order: 1,
  },
  optional: {
    title: 'Optional Commands',
    icon: 'Package',
    description: 'Advanced features for specialized workflows',
    order: 2,
  },
  setup: {
    title: 'Setup',
    icon: 'Terminal',
    description: 'Installation and configuration (not for daily use)',
    order: 3,
  },
}

/**
 * Helper functions
 */
const registry = {
  /**
   * Get all commands
   */
  getAll: () => COMMANDS,

  /**
   * Get command by name
   */
  getByName: (name) => COMMANDS.find((c) => c.name === name),

  /**
   * Get commands by category
   */
  getByCategory: (category) => COMMANDS.filter((c) => c.category === category),

  /**
   * Get all implemented commands
   */
  getAllImplemented: () => COMMANDS.filter((c) => c.implemented),

  /**
   * Get all commands with templates
   */
  getAllWithTemplates: () => COMMANDS.filter((c) => c.hasTemplate),

  /**
   * Get commands available in Claude Code
   */
  getClaudeCommands: () => COMMANDS.filter((c) => c.usage.claude !== null),

  /**
   * Get commands available in terminal
   */
  getTerminalCommands: () => COMMANDS.filter((c) => c.usage.terminal !== null),

  /**
   * Get all categories
   */
  getCategories: () => CATEGORIES,

  /**
   * Get category metadata
   */
  getCategory: (category) => CATEGORIES[category],

  /**
   * Validate command registry
   */
  validate: () => {
    const issues = []

    // Check for duplicate names
    const names = COMMANDS.map((c) => c.name)
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      issues.push(`Duplicate command names: ${duplicates.join(', ')}`)
    }

    // Check for commands with templates but not implemented
    const notImplemented = COMMANDS.filter((c) => c.hasTemplate && !c.implemented)
    if (notImplemented.length > 0) {
      issues.push(
        `Commands with templates but not implemented: ${notImplemented.map((c) => c.name).join(', ')}`,
      )
    }

    // Check for invalid categories
    const validCategories = Object.keys(CATEGORIES)
    const invalidCategories = COMMANDS.filter((c) => !validCategories.includes(c.category))
    if (invalidCategories.length > 0) {
      issues.push(
        `Invalid categories: ${invalidCategories.map((c) => `${c.name}:${c.category}`).join(', ')}`,
      )
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  },

  /**
   * Get core commands only (9 essential)
   */
  getCoreCommands: () => COMMANDS.filter((c) => c.category === 'core'),

  /**
   * Get optional commands
   */
  getOptionalCommands: () => COMMANDS.filter((c) => c.category === 'optional'),

  /**
   * Get commands that require initialization
   */
  getRequiresInit: () => COMMANDS.filter((c) => c.requiresInit),

  /**
   * Get commands with blocking rules
   */
  getWithBlockingRules: () => COMMANDS.filter((c) => c.blockingRules !== null),

  /**
   * Check if command can execute based on blocking rules
   */
  canExecute: (commandName, context = {}) => {
    const command = COMMANDS.find((c) => c.name === commandName)
    if (!command) return { allowed: false, message: 'Command not found' }
    if (!command.blockingRules) return { allowed: true }

    // Example context checks - should be implemented per command
    const { hasActiveTask, hasContent } = context

    if (commandName === 'build' && hasActiveTask) {
      return { allowed: false, message: command.blockingRules.message }
    }
    if (commandName === 'done' && !hasContent) {
      return { allowed: false, message: command.blockingRules.message }
    }
    if (commandName === 'next' && hasActiveTask) {
      return {
        allowed: true,
        warning: 'You have an active task. Complete it with /p:done first.',
      }
    }

    return { allowed: true }
  },

  /**
   * Get statistics
   */
  getStats: () => ({
    total: COMMANDS.length,
    core: COMMANDS.filter((c) => c.category === 'core').length,
    optional: COMMANDS.filter((c) => c.category === 'optional').length,
    setup: COMMANDS.filter((c) => c.category === 'setup').length,
    implemented: COMMANDS.filter((c) => c.implemented).length,
    withTemplates: COMMANDS.filter((c) => c.hasTemplate).length,
    claudeOnly: COMMANDS.filter((c) => c.usage.claude && !c.usage.terminal).length,
    terminalOnly: COMMANDS.filter((c) => !c.usage.claude && c.usage.terminal).length,
    both: COMMANDS.filter((c) => c.usage.claude && c.usage.terminal).length,
    requiresInit: COMMANDS.filter((c) => c.requiresInit).length,
    withBlockingRules: COMMANDS.filter((c) => c.blockingRules !== null).length,
    byCategory: Object.keys(CATEGORIES).reduce(
      (acc, cat) => ({
        ...acc,
        [cat]: COMMANDS.filter((c) => c.category === cat).length,
      }),
      {},
    ),
  }),
}

module.exports = registry
