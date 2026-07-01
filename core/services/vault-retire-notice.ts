/**
 * One-time notice: the Obsidian/markdown vault feature has been removed
 * entirely (wiki-generator, `prjct vault`, and the whole export pipeline).
 * Shown only to a project whose config still carries a historical
 * `vault: { mode: 'export' }` field (the field itself was removed from
 * LocalConfig's type, but a config.json written before this change still
 * has it on disk) — i.e. only users who had actually opted in. Never
 * deletes any existing `_generated/` files; shown once (a kv flag).
 */

import configManager from '../infrastructure/config-manager'
import prjctDb from '../storage/database'

const NOTICE_FLAG_KEY = 'vault-retire-notice-shown'

/**
 * Returns the notice string the first time conditions hold, then null forever.
 * Best-effort: any failure returns null (a notice is never load-bearing).
 */
export async function vaultRetirementNotice(
  projectPath: string,
  projectId: string
): Promise<string | null> {
  try {
    const config = await configManager.readConfig(projectPath).catch(() => null)
    const hadExportOn = (config as { vault?: { mode?: string } } | null)?.vault?.mode === 'export'
    if (!hadExportOn) return null

    const already = prjctDb.getDoc<{ shown: boolean }>(projectId, NOTICE_FLAG_KEY)
    if (already?.shown) return null

    prjctDb.setDoc(projectId, NOTICE_FLAG_KEY, { shown: true })
    return [
      '> **prjct has removed the Obsidian/markdown vault feature.**',
      '> Any files it previously generated are untouched on disk, but prjct no',
      '> longer regenerates them. Agents read project knowledge through prjct',
      '> tools (`prjct search`, `prjct context memory`, `prjct_analysis`, …).',
    ].join('\n')
  } catch {
    return null
  }
}
