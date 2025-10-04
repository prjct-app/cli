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
      claude: '/p:init "[idea]"',
      terminal: 'prjct init "[idea]"',
    },
    params: '[idea]',
    implemented: true,
    hasTemplate: true,
    icon: 'Zap',
    requiresInit: false,
    blockingRules: null,
    features: [
      'Architect mode for blank projects',
      'Auto tech stack recommendation',
      'Project structure generation',
      'Initial roadmap creation',
      'Analyzes existing codebases',
    ],
  },

  // 2. Feature with Roadmap (NEW - replaces idea)
  {
    name: 'feature',
    category: 'core',
    description: 'Add feature with value analysis, roadmap, and task breakdown',
    usage: {
      claude: '/p:feature "add unit testing"',
      terminal: 'prjct feature "add unit testing"',
    },
    params: '<description>',
    implemented: true,
    hasTemplate: true,
    icon: 'Package',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Value analysis (impact/effort/timing)',
      'Auto roadmap generation',
      'Task breakdown',
      'Auto-start first task',
      'Timing recommendations',
    ],
  },

  // DEPRECATED: Use /p:feature instead
  {
    name: 'idea',
    category: 'deprecated',
    description: '[DEPRECATED] Use /p:feature instead',
    usage: {
      claude: null,
      terminal: null,
    },
    params: '<text>',
    implemented: false,
    hasTemplate: true,
    icon: 'Lightbulb',
    requiresInit: true,
    blockingRules: null,
    deprecated: true,
    replacedBy: 'feature',
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true, // Complete automated workflow
    hasTemplate: true,
    icon: 'Rocket',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Lint checks (non-blocking)',
      'Run tests (non-blocking)',
      'Update docs',
      'Update version',
      'Update CHANGELOG',
      'Git commit + push',
      'Recommend compact',
    ],
  },

  // 10. Bug Tracking
  {
    name: 'bug',
    category: 'core',
    description: 'Report and track bugs with priority',
    usage: {
      claude: '/p:bug "login button not working"',
      terminal: 'prjct bug "login button not working"',
    },
    params: '<description>',
    implemented: true,
    hasTemplate: true,
    icon: 'Bug',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Auto-detect severity (critical/high/medium/low)',
      'Priority placement in next.md',
      'Bug tracking in memory',
      'Quick bug resolution workflow',
    ],
  },

  // 11. Architect Execute
  {
    name: 'architect',
    category: 'core',
    description: 'Execute architect plan and generate code',
    usage: {
      claude: '/p:architect execute',
      terminal: 'prjct architect execute',
    },
    params: 'execute',
    implemented: true,
    hasTemplate: false,
    icon: 'Hammer',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Reads architect-session.md plan',
      'Generates code structure',
      'Uses Context7 for documentation',
      'Language-agnostic implementation',
    ],
  },

  // ===== OPTIONAL COMMANDS (Advanced features) =====

  // DEPRECATED: Workflow is now automatic in /p:ship
  {
    name: 'workflow',
    category: 'deprecated',
    description: '[DEPRECATED] Workflow is now automatic in /p:ship',
    usage: {
      claude: null,
      terminal: null,
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'GitBranch',
    requiresInit: true,
    blockingRules: null,
    deprecated: true,
    replacedBy: 'ship',
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
        `Commands with templates but not implemented: ${notImplemented.map((c) => c.name).join(', ')}`
      )
    }

    // Check for invalid categories
    const validCategories = Object.keys(CATEGORIES)
    const invalidCategories = COMMANDS.filter((c) => !validCategories.includes(c.category))
    if (invalidCategories.length > 0) {
      issues.push(
        `Invalid categories: ${invalidCategories.map((c) => `${c.name}:${c.category}`).join(', ')}`
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
   * NOTE: Blocking rules are now handled by Claude reading templates, not deterministic code
   */
  getWithBlockingRules: () => COMMANDS.filter((c) => c.blockingRules !== null),

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
      {}
    ),
  }),
}

module.exports = registry
