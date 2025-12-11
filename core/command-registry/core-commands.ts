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
    blockingRules: null,
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
    blockingRules: null,
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
    blockingRules: null,
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
    blockingRules: null,
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
    requiresInit: true,
    blockingRules: null,
    features: [
      'No params -> Show current task',
      'With task -> Start new task',
      'Auto agent assignment',
      'Supports task numbers',
      'Replaces /p:now and /p:build',
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
    description: 'Resume most recently paused task',
    usage: {
      claude: '/p:resume [task_id]',
      terminal: 'prjct resume [task_id]',
    },
    params: '[task_id]',
    implemented: true,
    hasTemplate: true,
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

  {
    name: 'next',
    category: 'core',
    description: 'Show top 5 non-blocking priority tasks',
    usage: {
      claude: '/p:next',
      terminal: 'prjct next',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
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
    blockingRules: null,
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
    blockingRules: null,
    features: [
      'Project overview',
      'Weekly/monthly progress',
      'Roadmap view',
      'ASCII graphics',
      'Replaces 4 commands',
    ],
  },

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
    requiresInit: false,
    blockingRules: null,
    features: [
      'Context-aware suggestions',
      'Intent to action translator',
      'Problem solving guidance',
      'Absorbs ask/suggest/stuck',
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
    params: null,
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: null,
    features: [
      'Syncs project state',
      'Updates dynamic agents',
      'Refreshes context',
    ],
  },

  {
    name: 'recover',
    category: 'core',
    description: 'Recover abandoned session with context restoration',
    usage: {
      claude: '/p:recover',
      terminal: 'prjct recover',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: {
      check: 'Session exists in current.json',
      message: 'No session to recover',
    },
    features: [
      'Detect abandoned sessions',
      'Show original prompt context',
      'Resume with preserved context',
      'Close as partial (counts in metrics)',
      'Save for later reference',
      'Discard without logging',
    ],
  },
]
