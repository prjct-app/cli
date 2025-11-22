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
 * @version 0.9.0 - Simplified commands with pause/resume and intelligent idea development
 */

const COMMANDS = [
  // ===== CORE WORKFLOW COMMANDS (13 essential) =====

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

  // 2. Idea Development - Transform ideas into complete architectures
  {
    name: 'idea',
    category: 'core',
    description: 'Transform ideas into complete technical architectures',
    usage: {
      claude: '/p:idea "build a CRM with AI"',
      terminal: 'prjct idea "build a CRM with AI"',
    },
    params: '<description>',
    implemented: true,
    hasTemplate: true,
    icon: 'Lightbulb',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Simple ideas → Quick capture',
      'Complex ideas → Full architecture',
      'Interactive discovery process',
      'Tech stack recommendation',
      'Complete roadmap generation',
      'Database schema design',
      'API specification',
    ],
  },

  // 3. Feature with Roadmap
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

  // 4. Work - Unified task management (replaces now + build)
  {
    name: 'work',
    category: 'core',
    description: 'Show current or start new task',
    usage: {
      claude: '/p:work ["task"]',
      terminal: 'prjct work ["task"]',
    },
    params: '[task]',
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
    requiresInit: true,
    blockingRules: null,
    features: [
      'No params → Show current task',
      'With task → Start new task',
      'Auto agent assignment',
      'Supports task numbers',
      'Replaces /p:now and /p:build',
    ],
  },

  // 5. Pause - Pause active task
  {
    name: 'pause',
    category: 'core',
    description: 'Pause active task to handle interruption',
    usage: {
      claude: '/p:pause ["reason"]',
      terminal: 'prjct pause ["reason"]',
    },
    params: '[reason]',
    implemented: true,
    hasTemplate: true,
    icon: 'Pause',
    requiresInit: true,
    blockingRules: {
      check: 'Active task exists',
      message: 'No active task to pause',
    },
    features: [
      'Preserves task context',
      'Optional pause reason',
      'Tracks paused duration',
      'Allows multiple paused tasks',
    ],
  },

  // 6. Resume - Resume paused task
  {
    name: 'resume',
    category: 'core',
    description: 'Resume most recently paused task',
    usage: {
      claude: '/p:resume [task_id]',
      terminal: 'prjct resume [task_id]',
    },
    params: '[task_id]',
    implemented: true,
    hasTemplate: true,
    icon: 'Play',
    requiresInit: true,
    blockingRules: {
      check: 'Paused tasks exist',
      message: 'No paused tasks to resume',
    },
    features: [
      'Resume last paused',
      'Resume specific task',
      'Resume by number',
      'Calculates active time',
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

  // 11. Dashboard - Unified project view (replaces status, recap, progress, roadmap)
  {
    name: 'dash',
    category: 'core',
    description: 'Unified dashboard - status, progress, and roadmap',
    usage: {
      claude: '/p:dash [view]',
      terminal: 'prjct dash [view]',
    },
    params: '[week|month|roadmap|compact]',
    implemented: true,
    hasTemplate: true,
    icon: 'BarChart3',
    requiresInit: true,
    blockingRules: null,
    features: [
      'Project overview',
      'Weekly/monthly progress',
      'Roadmap view',
      'ASCII graphics',
      'Replaces 4 commands',
    ],
  },

  // 12. Help - Enhanced contextual help (absorbs ask, suggest, stuck)
  {
    name: 'help',
    category: 'core',
    description: 'Contextual help and guidance',
    usage: {
      claude: '/p:help [topic]',
      terminal: 'prjct help [topic]',
    },
    params: '[topic]',
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
    requiresInit: false,
    blockingRules: null,
    features: [
      'Context-aware suggestions',
      'Intent to action translator',
      'Problem solving guidance',
      'Absorbs ask/suggest/stuck',
    ],
  },

  // 13. Sync - Sync project state
  {
    name: 'sync',
    category: 'core',
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
    features: [
      'Syncs project state',
      'Updates dynamic agents',
      'Refreshes context',
    ],
  },

  // ===== OPTIONAL COMMANDS (Advanced features) =====

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
      claude: '/p:setup',
      terminal: 'prjct setup [--force] [--editor <name>]',
    },
    params: '[--force] [--editor <name>]',
    implemented: true,
    hasTemplate: true,
    icon: 'Settings',
    requiresInit: false,
    blockingRules: null,
  },
  {
    name: 'migrate-all',
    category: 'setup',
    description: 'Migrate all legacy projects',
    usage: {
      claude: '/p:migrate-all',
      terminal: 'prjct migrate-all [--deep-scan] [--remove-legacy] [--dry-run]',
    },
    params: '[--deep-scan] [--remove-legacy] [--dry-run]',
    implemented: true,
    hasTemplate: true,
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
    description: '13 essential commands for daily development workflow (simplified)',
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
