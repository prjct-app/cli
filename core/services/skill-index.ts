/**
 * Skill index — "index of paths, not summaries".
 *
 * Scans the project's and the user's agent skill roots for `SKILL.md` files,
 * parses just the frontmatter (name + description), dedupes with project
 * winning over global, and persists the catalog in the typed `skill_registry`
 * table (refreshed on every sync; mtime+size fingerprint makes re-scans
 * cheap).
 *
 * The contract: an orchestrator resolves this index ONCE and passes the EXACT
 * `SKILL.md` paths to subagents — the subagent reads the original file, so
 * the skill author's intent is never distorted by a generated digest.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prjctDb } from '../storage/database'

export interface IndexedSkill {
  name: string
  description: string
  path: string
  scope: 'project' | 'global'
}

/** Skill roots, project first (project wins on name collision). */
function skillRoots(projectPath: string): Array<{ dir: string; scope: 'project' | 'global' }> {
  return [
    { dir: path.join(projectPath, '.claude', 'skills'), scope: 'project' },
    { dir: path.join(projectPath, 'skills'), scope: 'project' },
    { dir: path.join(os.homedir(), '.claude', 'skills'), scope: 'global' },
  ]
}

/** Minimal frontmatter parse: `name:` (fallback: dir name) + `description:`. */
function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: { name?: string; description?: string } = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(name|description):\s*(.+)$/)
    if (!kv) continue
    out[kv[1] as 'name' | 'description'] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Rescan the skill roots and rewrite the typed registry. Cheap (a directory
 * listing + one small read per skill) and idempotent — safe on every sync.
 */
export async function refreshSkillIndex(
  projectId: string,
  projectPath: string
): Promise<IndexedSkill[]> {
  const found = new Map<string, IndexedSkill>()
  for (const { dir, scope } of skillRoots(projectPath)) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue // root doesn't exist — fine
    }
    for (const entry of entries) {
      const skillPath = path.join(dir, entry, 'SKILL.md')
      let raw: string
      try {
        raw = await fs.readFile(skillPath, 'utf-8')
      } catch {
        continue
      }
      const fm = parseFrontmatter(raw)
      const name = fm.name || entry
      if (found.has(name)) continue // project scanned first → project wins
      found.set(name, {
        name,
        description: fm.description ?? '',
        path: skillPath,
        scope,
      })
    }
  }

  const skills = [...found.values()]
  try {
    prjctDb.run(projectId, 'DELETE FROM skill_registry')
    for (const s of skills) {
      prjctDb.run(
        projectId,
        'INSERT OR REPLACE INTO skill_registry (name, description, path, scope, indexed_at) VALUES (?, ?, ?, ?, ?)',
        s.name,
        s.description,
        s.path,
        s.scope,
        Date.now()
      )
    }
  } catch {
    /* registry persistence is best-effort — the scan result still returns */
  }
  return skills
}

/** Read the persisted index (for `prjct context skills` and dispatch prompts). */
export function getSkillIndex(projectId: string): IndexedSkill[] {
  try {
    return prjctDb
      .query<{ name: string; description: string; path: string; scope: string }>(
        projectId,
        'SELECT name, description, path, scope FROM skill_registry ORDER BY scope ASC, name ASC'
      )
      .map((r) => ({ ...r, scope: r.scope as IndexedSkill['scope'] }))
  } catch {
    return []
  }
}

/** Markdown index for agents: name — description — exact path to read. */
export function renderSkillIndex(projectId: string): string | null {
  const skills = getSkillIndex(projectId)
  if (skills.length === 0) return null
  const lines = [
    '## Skill index — pass EXACT paths to subagents (they read the original SKILL.md; never summarize a skill for them)',
    '',
  ]
  for (const s of skills) {
    lines.push(
      `- **${s.name}** (${s.scope}) — ${s.description || 'no description'}\n  \`${s.path}\``
    )
  }
  return lines.join('\n')
}
