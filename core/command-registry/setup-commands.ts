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
    implemented: true,
    hasTemplate: false,
    requiresInit: false,
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
  },

  {
    name: 'migrate',
    category: 'setup',
    description: 'Migrate project to UUID format + sync',
    usage: {
      claude: '/p:migrate',
      terminal: null, // Claude-only
    },
    implemented: true,
    hasTemplate: true,
    requiresInit: true,
  },

  {
    name: 'migrate-all',
    category: 'setup',
    description: 'Migrate all legacy projects to UUID format',
    usage: {
      claude: '/p:migrate-all',
      terminal: 'prjct migrate-all [--deep-scan] [--dry-run]',
    },
    params: '[--deep-scan] [--dry-run]',
    implemented: true,
    hasTemplate: true,
    requiresInit: false,
  },

  {
    name: 'auth',
    category: 'setup',
    description: 'Manage cloud authentication',
    usage: {
      claude: '/p:auth [login|logout|status]',
      terminal: 'prjct auth [login|logout|status]',
    },
    params: '[login|logout|status]',
    implemented: true,
    hasTemplate: true,
    requiresInit: false,
  },
]
