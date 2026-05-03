/**
 * Setup Commands — thin façade over the modules in ./setup/.
 * The class shape is preserved for backward compatibility with
 * `commands.ts` and `register.ts`; everything substantive lives in:
 *   - setup/auth-flow.ts       — auth(), login(), logout()
 *   - setup/wizard.ts          — start(), setup(), showAsciiArt()
 *   - setup/install-status-line.ts
 *   - setup/mcp.ts             — MCP server wiring
 *   - setup/oauth-pages.ts     — branded HTML for the OAuth callback
 */

import type { CommandResult, SetupOptions } from '../types/commands'
import { PrjctCommandsBase } from './base'
import { auth, login, logout } from './setup/auth-flow'
import { installStatusLine } from './setup/install-status-line'
import { setup, showAsciiArt, start } from './setup/wizard'

export class SetupCommands extends PrjctCommandsBase {
  auth(action: string | null = null, options: { md?: boolean } = {}): Promise<CommandResult> {
    return auth(action, options)
  }

  login(options: { md?: boolean; url?: string } = {}): Promise<CommandResult> {
    return login(options)
  }

  logout(): Promise<CommandResult> {
    return logout()
  }

  start(): Promise<CommandResult> {
    return start()
  }

  setup(options: SetupOptions = {}): Promise<CommandResult> {
    return setup(options)
  }

  installStatusLine(): Promise<{ success: boolean; error?: string }> {
    return installStatusLine()
  }

  showAsciiArt(): void {
    showAsciiArt()
  }
}
