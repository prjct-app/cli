/**
 * One-time notice: the Obsidian/markdown vault feature has been removed
 * entirely (wiki-generator, `prjct vault`, and the whole export pipeline).
 * Shown only to a project whose config still carries a historical
 * `vault: { mode: 'export' }` field (the field itself was removed from
 * LocalConfig's type, but a config.json written before this change still
 * has it on disk) — i.e. only users who had actually opted in. Never
 * deletes any existing `_generated/` files; shown once (a kv flag).
 */

import prjctDb from '../storage/database'

const NOTICE_FLAG_KEY = 'vault-retire-notice-shown'

/**
 * Returns the notice string the first time conditions hold, then null forever.
 * Best-effort: any failure returns null (a notice is never load-bearing).
 *
 * Takes the already-parsed config rather than a projectPath — the sole
 * caller (buildSessionContext) already has it in scope on every SessionStart
 * and cwd-changed invocation; re-reading + re-parsing prjct.config.json here
 * was a second disk read for a check that's a no-op for ~99%+ of projects.
 */
export async function vaultRetirementNotice(
  config: unknown,
  projectId: string
): Promise<string | null> {
  try {
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
