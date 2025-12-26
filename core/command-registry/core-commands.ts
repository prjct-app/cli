/**
 * Core Workflow Commands
 * 14 essential commands for daily development workflow.
 */

import type { Command } from './types'

export const CORE_COMMANDS: Command[] = [
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
    requiresInit: false,
    features: [
      'Architect mode for blank projects',
      'Auto tech stack recommendation',
      'Project structure generation',
      'Initial roadmap creation',
      'Analyzes existing codebases',
    ],
  },

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
    requiresInit: true,
    features: [
      'Simple ideas -> Quick capture',
      'Complex ideas -> Full architecture',
      'Interactive discovery process',
      'Tech stack recommendation',
      'Complete roadmap generation',
      'Database schema design',
      'API specification',
    ],
  },

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
    requiresInit: true,
    features: [
      'Value analysis (impact/effort/timing)',
      'Auto roadmap generation',
      'Task breakdown',
      'Auto-start first task',
      'Timing recommendations',
    ],
  },

  {
    name: 'spec',
    category: 'core',
    description: 'Create detailed specifications for complex features',
    usage: {
      claude: '/p:spec "Dark Mode"',
      terminal: 'prjct spec "Dark Mode"',
    },
    params: '[feature]',
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    features: [
      'Requirements documentation',
      'Design decisions tracking',
      'Tasks broken into 20-30min chunks',
      'User approval workflow',
      'Auto-add tasks to queue on approve',
      'Integrates with /p:feature',
    ],
  },

  {
    name: 'now',
    category: 'core',
    description: 'Set or show current task with session tracking',
    usage: {
      claude: '/p:now ["task"] [estimate]',
      terminal: 'prjct now ["task"] [estimate]',
    },
    params: '[task] [estimate]',
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    features: [
      'No params -> Show current task',
      'With task -> Start new task',
      'Time estimates (2h, 30m, 1d)',
      'Abandoned session detection',
      'Auto agent detection',
      'Session tracking',
    ],
  },

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

  {
    name: 'resume',
    category: 'core',
    description: 'Resume paused task or recover abandoned session',
    usage: {
      claude: '/p:resume [--recover]',
      terminal: 'prjct resume [--recover]',
    },
    params: '[task_id] [--recover]',
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: {
      check: 'Paused tasks or abandoned session exists',
      message: 'No paused tasks to resume',
    },
    features: [
      'Resume last paused',
      'Resume specific task',
      'Calculates active time',
      'Recovery mode for abandoned sessions',
      'Close as partial (metrics)',
      'Save for later reference',
    ],
  },

  {
    name: 'next',
    category: 'core',
    description: 'Show priority queue or roadmap view',
    usage: {
      claude: '/p:next [roadmap]',
      terminal: 'prjct next [roadmap]',
    },
    params: '[roadmap]',
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: {
      check: 'filters blocked tasks',
      message: 'Shows warning if now.md is active',
    },
    features: [
      'Priority queue view (default)',
      'Roadmap view (feature-grouped)',
      'Shows top 5 by priority',
      'Numbered for quick selection',
      'Velocity calculation',
    ],
  },

  {
    name: 'done',
    category: 'core',
    description: 'Mark current task as complete',
    usage: {
      claude: '/p:done',
      terminal: 'prjct done',
    },
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: {
      check: 'now.md must have content',
      message: 'No active task to complete',
    },
  },

  {
    name: 'ship',
    category: 'core',
    description: 'Commit, push, and celebrate shipped feature',
    usage: {
      claude: '/p:ship "user authentication"',
      terminal: 'prjct ship "user authentication"',
    },
    params: '<feature>',
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
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
    requiresInit: true,
    features: [
      'Auto-detect severity (critical/high/medium/low)',
      'Priority placement in next.md',
      'Bug tracking in memory',
      'Quick bug resolution workflow',
    ],
  },

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
    requiresInit: true,
    features: [
      'Project overview',
      'Weekly/monthly progress',
      'Roadmap view',
      'ASCII graphics',
      'Replaces 4 commands',
    ],
  },

  {
    name: 'ask',
    category: 'core',
    description: 'Intent translator - helps understand what command to use',
    usage: {
      claude: '/p:ask "I want to add dark mode"',
      terminal: 'prjct ask "I want to add dark mode"',
    },
    params: '<intent>',
    implemented: true,
    hasTemplate: true,
    requiresInit: false,
    features: [
      'Natural language intent parsing',
      'Command flow recommendations',
      'Troubleshooting guidance',
      'Context-aware suggestions',
    ],
  },

  {
    name: 'sync',
    category: 'core',
    description: 'Sync project state and update workflow agents',
    usage: {
      claude: '/p:sync',
      terminal: 'prjct sync',
    },
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    features: [
      'Syncs project state',
      'Updates dynamic agents',
      'Refreshes context',
    ],
  },

  {
    name: 'suggest',
    category: 'core',
    description: 'Smart recommendations based on project state',
    usage: {
      claude: '/p:suggest',
      terminal: 'prjct suggest',
    },
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    features: [
      'Context-aware recommendations',
      'Momentum-based suggestions',
      'Next action guidance',
      'Pattern detection',
    ],
  },
]
