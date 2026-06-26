/**
 * Post-write vault regeneration.
 *
 * The generated vault is a derived read model over SQLite. Any durable write
 * that agents may read back must request a regen immediately after the DB
 * mutation completes; otherwise `.prjct/wiki/_generated/` becomes stale.
 */

import configManager from '../infrastructure/config-manager'

export async function requestVaultRegeneration(
  projectPath: string,
  projectId?: string
): Promise<void> {
  const pid = projectId ?? (await configManager.getProjectId(projectPath))
  if (!pid) return
  const { regenerateWikiDeferred } = await import('./wiki-generator')
  await regenerateWikiDeferred(projectPath, pid)
}
