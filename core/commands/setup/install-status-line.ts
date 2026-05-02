/**
 * Thin wrapper around the canonical statusline installer in
 * `core/infrastructure/setup.ts`. The infrastructure copy is the real
 * implementation — it copies the modular statusline (lib/, components/,
 * themes/, config.json) from the package's `assets/statusline/`, sets
 * up the symlink at `~/.claude/prjct-statusline.sh`, and rewrites
 * `CLI_VERSION` in-place on upgrade.
 *
 * This wrapper exists only to give the `setup`-command callers
 * (`commands/setup.ts`, `commands/setup/wizard.ts`) the
 * `{ success, error }` result shape they were already using; the
 * infrastructure function returns void and logs warnings internally.
 */

import { installStatusLine as installFromInfra } from '../../infrastructure/setup'
import { getErrorMessage } from '../../types/fs'

export async function installStatusLine(): Promise<{ success: boolean; error?: string }> {
  try {
    await installFromInfra()
    return { success: true }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}
