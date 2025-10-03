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
 * @version 0.5.0
 */

const COMMANDS = [
  // ===== WORK COMMANDS =====
  {
    name: 'now',
    category: 'work',
    description: 'Set or show current task',
    usage: {
      claude: '/p:now "implement authentication system"',
      terminal: 'prjct now "implement authentication system"',
    },
    params: '[task]',
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
  },
  {
    name: 'next',
    category: 'work',
    description: 'Show priority queue',
    usage: {
      claude: '/p:next',
      terminal: 'prjct next',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
  },
  {
    name: 'done',
    category: 'work',
    description: 'Complete current task',
    usage: {
      claude: '/p:done',
      terminal: 'prjct done',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
  },
  {
    name: 'ship',
    category: 'work',
    description: 'Ship and celebrate a feature',
    usage: {
      claude: '/p:ship "user authentication system"',
      terminal: 'prjct ship "user authentication system"',
    },
    params: '<feature>',
    implemented: true,
    hasTemplate: true,
    icon: 'Target',
  },

  // ===== PLANNING COMMANDS =====
  {
    name: 'idea',
    category: 'planning',
    description: 'Capture ideas quickly',
    usage: {
      claude: '/p:idea "add dark mode"',
      terminal: 'prjct idea "add dark mode"',
    },
    params: '<text>',
    implemented: true,
    hasTemplate: true,
    icon: 'Lightbulb',
  },
  {
    name: 'roadmap',
    category: 'planning',
    description: 'Show or update strategic roadmap',
    usage: {
      claude: '/p:roadmap',
      terminal: 'prjct roadmap',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'Lightbulb',
  },
  {
    name: 'task',
    category: 'planning',
    description: 'Break down and execute complex tasks',
    usage: {
      claude: '/p:task "implement authentication"',
      terminal: 'prjct task "implement authentication"',
    },
    params: '<description>',
    implemented: false,
    hasTemplate: true,
    icon: 'Lightbulb',
  },
  {
    name: 'workflow',
    category: 'planning',
    description: 'Show workflow status and progress',
    usage: {
      claude: '/p:workflow',
      terminal: 'prjct workflow',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Lightbulb',
  },

  // ===== DESIGN & ARCHITECTURE =====
  {
    name: 'design',
    category: 'design',
    description: 'Design system architecture, APIs, and component interfaces',
    usage: {
      claude: '/p:design authentication --type architecture',
      terminal: 'prjct design authentication --type architecture',
    },
    params: '[target] --type architecture|api|component|database|flow',
    implemented: true,
    hasTemplate: true,
    icon: 'Palette',
  },

  // ===== CODE QUALITY =====
  {
    name: 'cleanup',
    category: 'quality',
    description: 'Clean up temp files and old entries',
    usage: {
      claude: '/p:cleanup',
      terminal: 'prjct cleanup',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'Zap',
  },
  {
    name: 'cleanup-advanced',
    category: 'quality',
    description: 'Remove dead code and unused imports',
    usage: {
      claude: '/p:cleanup --type code',
      terminal: 'prjct cleanup --type code',
    },
    params: '--type code|imports|files|deps|all',
    implemented: true,
    hasTemplate: false,
    icon: 'Zap',
  },

  // ===== PROGRESS COMMANDS =====
  {
    name: 'recap',
    category: 'progress',
    description: 'Show project overview with progress',
    usage: {
      claude: '/p:recap',
      terminal: 'prjct recap',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'BarChart3',
  },
  {
    name: 'progress',
    category: 'progress',
    description: 'Show progress metrics for specified period',
    usage: {
      claude: '/p:progress week',
      terminal: 'prjct progress week',
    },
    params: '[period]',
    implemented: true,
    hasTemplate: true,
    icon: 'BarChart3',
  },
  {
    name: 'context',
    category: 'progress',
    description: 'Show project context and recent activity',
    usage: {
      claude: '/p:context',
      terminal: 'prjct context',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'BarChart3',
  },

  // ===== HELP COMMANDS =====
  {
    name: 'init',
    category: 'help',
    description: 'Initialize prjct in current project',
    usage: {
      claude: '/p:init',
      terminal: 'prjct init',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
  },
  {
    name: 'stuck',
    category: 'help',
    description: 'Get contextual help with problems',
    usage: {
      claude: '/p:stuck "CORS error in API calls"',
      terminal: 'prjct stuck "CORS error in API calls"',
    },
    params: '<issue description>',
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
  },
  {
    name: 'fix',
    category: 'help',
    description: 'Quick troubleshooting and automatic fixes',
    usage: {
      claude: '/p:fix "undefined is not a function"',
      terminal: 'prjct fix "undefined is not a function"',
    },
    params: '[error]',
    implemented: false,
    hasTemplate: true,
    icon: 'HelpCircle',
  },
  {
    name: 'analyze',
    category: 'help',
    description: 'Analyze repository and sync tasks',
    usage: {
      claude: '/p:analyze',
      terminal: 'prjct analyze',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
  },
  {
    name: 'sync',
    category: 'help',
    description: 'Sync project state and update workflow agents',
    usage: {
      claude: '/p:sync',
      terminal: 'prjct sync',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    icon: 'HelpCircle',
  },
  {
    name: 'help',
    category: 'help',
    description: 'Interactive guide - talk naturally, no memorization needed',
    usage: {
      claude: '/p:help',
      terminal: 'prjct help',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'HelpCircle',
  },

  // ===== VERSION CONTROL =====
  {
    name: 'git',
    category: 'git',
    description: 'Smart git operations with context',
    usage: {
      claude: '/p:git',
      terminal: 'prjct git',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'Github',
  },

  // ===== TESTING =====
  {
    name: 'test',
    category: 'testing',
    description: 'Run tests and auto-fix simple failures',
    usage: {
      claude: '/p:test',
      terminal: 'prjct test',
    },
    params: null,
    implemented: false,
    hasTemplate: true,
    icon: 'Rocket',
  },

  // ===== SETUP COMMANDS =====
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
    icon: 'Terminal',
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
    icon: 'Terminal',
  },
]

/**
 * Category metadata
 */
const CATEGORIES = {
  work: {
    title: 'Work Commands',
    icon: 'Target',
    description: 'Core workflow commands for task management',
  },
  planning: {
    title: 'Planning Commands',
    icon: 'Lightbulb',
    description: 'Strategic planning and task organization',
  },
  design: {
    title: 'Design & Architecture',
    icon: 'Palette',
    description: 'System design and architecture planning',
  },
  quality: {
    title: 'Code Quality',
    icon: 'Zap',
    description: 'Code cleanup and quality improvements',
  },
  progress: {
    title: 'Progress Commands',
    icon: 'BarChart3',
    description: 'Track progress and view metrics',
  },
  help: {
    title: 'Help Commands',
    icon: 'HelpCircle',
    description: 'Setup, troubleshooting, and assistance',
  },
  git: {
    title: 'Version Control',
    icon: 'Github',
    description: 'Git operations and version control',
  },
  testing: {
    title: 'Testing',
    icon: 'Rocket',
    description: 'Test execution and validation',
  },
  setup: {
    title: 'Setup',
    icon: 'Terminal',
    description: 'Installation and configuration',
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
  getByName: (name: string) => COMMANDS.find((c) => c.name === name),

  /**
   * Get commands by category
   */
  getByCategory: (category: string) => COMMANDS.filter((c) => c.category === category),

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
  getCategory: (category: string) => CATEGORIES[category as keyof typeof CATEGORIES],

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
   * Get statistics
   */
  getStats: () => ({
    total: COMMANDS.length,
    implemented: COMMANDS.filter((c) => c.implemented).length,
    withTemplates: COMMANDS.filter((c) => c.hasTemplate).length,
    claudeOnly: COMMANDS.filter((c) => c.usage.claude && !c.usage.terminal).length,
    terminalOnly: COMMANDS.filter((c) => !c.usage.claude && c.usage.terminal).length,
    both: COMMANDS.filter((c) => c.usage.claude && c.usage.terminal).length,
    byCategory: Object.keys(CATEGORIES).reduce(
      (acc, cat) => ({
        ...acc,
        [cat]: COMMANDS.filter((c) => c.category === cat).length,
      }),
      {},
    ),
  }),
}

export default registry
