/**
 * Cheap input-state fingerprint. Single SQL query + one stat call.
 * Bumping `REGEN_SCHEMA_VERSION` invalidates every project's cache —
 * the intended escape hatch when the output format changes.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { prjctDb } from '../../storage/database'
import { VERSION } from '../../utils/version'

export const FINGERPRINT_FILE = '.regen-fingerprint'

// v2: workflows visible in vault (M1b). Bumping invalidates v1
// fingerprints so existing users get the new workflows/ subtree on
// next regen.
export const REGEN_SCHEMA_VERSION = 2

export async function computeRegenFingerprint(
  projectPath: string,
  projectId: string
): Promise<string> {
  type FpRow = {
    max_event_id: number
    max_analysis_id: number
    ship_count: number
    last_ship: string | null
    workflow_count: number
    max_workflow_id: number
  }
  let row: FpRow | null = null
  try {
    row = prjctDb.get<FpRow>(
      projectId,
      `SELECT
         (SELECT COALESCE(MAX(id), 0) FROM events) AS max_event_id,
         (SELECT COALESCE(MAX(id), 0) FROM llm_analysis) AS max_analysis_id,
         (SELECT COUNT(*) FROM shipped_features) AS ship_count,
         (SELECT MAX(shipped_at) FROM shipped_features) AS last_ship,
         (SELECT COUNT(*) FROM workflow_rules) AS workflow_count,
         (SELECT COALESCE(MAX(id), 0) FROM workflow_rules) AS max_workflow_id`
    )
  } catch {
    // DB might not be initialised yet — use sentinel that triggers a real regen.
  }
  const e = row?.max_event_id ?? 0
  const a = row?.max_analysis_id ?? 0
  const s = row?.ship_count ?? 0
  const ls = row?.last_ship ?? ''
  const wc = row?.workflow_count ?? 0
  const wmax = row?.max_workflow_id ?? 0
  const changelogMtime = await fs
    .stat(path.join(projectPath, 'CHANGELOG.md'))
    .then((st) => Math.floor(st.mtimeMs))
    .catch(() => 0)
  // CLI VERSION is part of the fingerprint: any upgrade forces ONE full
  // regen per project (~50-80ms) and in exchange a builder change can
  // never serve a stale vault — the bug class where an installed old
  // version stamped the fingerprint and the new format never rendered
  // until unrelated inputs changed. REGEN_SCHEMA_VERSION stays as the
  // manual escape hatch for same-version invalidation (dev builds).
  return `v${REGEN_SCHEMA_VERSION}|cli${VERSION}|e${e}|a${a}|s${s}|ls${ls}|c${changelogMtime}|w${wc}/${wmax}`
}
