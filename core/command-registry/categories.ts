/**
 * Category Definitions
 */

import type { Categories } from './types'

export const CATEGORIES: Categories = {
  core: {
    title: 'Core Workflow',
    description: '13 essential commands for daily development workflow',
    order: 1,
  },
  optional: {
    title: 'Optional Commands',
    description: 'Advanced features for specialized workflows',
    order: 2,
  },
  setup: {
    title: 'Setup',
    description: 'Installation and configuration (not for daily use)',
    order: 3,
  },
}
