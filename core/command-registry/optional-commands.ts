/**
 * Optional Commands
 * Advanced features for specialized workflows.
 */

import type { Command } from './types'

export const OPTIONAL_COMMANDS: Command[] = [
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
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
  },

  {
    name: 'undo',
    category: 'optional',
    description: 'Revert to previous snapshot',
    usage: {
      claude: '/p:undo',
      terminal: 'prjct undo',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
    features: [
      'Git-based snapshots',
      'Preserves redo history',
      'Non-destructive',
    ],
  },

  {
    name: 'redo',
    category: 'optional',
    description: 'Redo previously undone changes',
    usage: {
      claude: '/p:redo',
      terminal: 'prjct redo',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
    features: [
      'Only available after undo',
      'Restores undone state',
      'Clears on new snapshot',
    ],
  },

  {
    name: 'history',
    category: 'optional',
    description: 'View snapshot history',
    usage: {
      claude: '/p:history',
      terminal: 'prjct history',
    },
    params: null,
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
    blockingRules: null,
    isOptional: true,
    features: [
      'Shows all snapshots',
      'Current position indicator',
      'Redo availability count',
    ],
  },
]
