/**
 * Setup Commands
 * Installation and configuration (not for daily use).
 */

import type { Command } from './types'

export const SETUP_COMMANDS: Command[] = [
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
    requiresInit: false,
    blockingRules: null,
  },
]
