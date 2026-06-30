/**
 * One-time vault-retirement notice (WS-A). When a project has an existing
 * on-disk `_generated/` vault but generation is now OFF by default, surface a
 * single heads-up so the user knows their files are intact and agents now read
 * through tools. Shown once (a kv flag), never deletes anything.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import configManager from '../infrastructure/config-manager'
import prjctDb from '../storage/database'
import { effectiveVaultMode } from './vault-preferences'
import { resolveVaultRoot } from './wiki-migration'

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
    if (effectiveVaultMode(config) !== 'off') return null

    const already = prjctDb.getDoc<{ shown: boolean }>(projectId, NOTICE_FLAG_KEY)
    if (already?.shown) return null

    const wikiRoot = await resolveVaultRoot(projectPath).catch(() => null)
    if (!wikiRoot || !existsSync(path.join(wikiRoot, '_generated'))) return null

    prjctDb.setDoc(projectId, NOTICE_FLAG_KEY, { shown: true })
    return [
      '> **prjct no longer regenerates the Obsidian/markdown vault by default.**',
      '> Your existing files are untouched. Agents now read project knowledge through',
      '> prjct tools (`prjct search`, `prjct context memory`, `prjct_analysis`, …).',
      '> Run `prjct vault on` to keep regenerating the vault for Obsidian.',
    ].join('\n')
  } catch {
    return null
  }
}
