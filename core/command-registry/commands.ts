/**
 * Command Definitions
 * All prjct commands combined from category modules.
 */

import type { Command } from './types'
import { CORE_COMMANDS } from './core-commands'
import { OPTIONAL_COMMANDS } from './optional-commands'
import { SETUP_COMMANDS } from './setup-commands'

export const COMMANDS: Command[] = [
  ...CORE_COMMANDS,
  ...OPTIONAL_COMMANDS,
  ...SETUP_COMMANDS,
]
