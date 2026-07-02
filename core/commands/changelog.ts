/**
 * `prjct changelog [days]` — release notes from the typed delivery record.
 *
 * Assembles what actually shipped (shipped_features) and what was completed
 * (typed task history) in the window into ready-to-paste markdown, grouped by
 * version. Zero LLM: the data plane already knows what happened; this just
 * renders it.
 */

import { prjctDb } from '../storage/database'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

interface ShipRow {
  name: string
  version: string
  shipped_at: string
}

interface DoneRow {
  description: string
  type: string | null
  completed_at: string
}

export class ChangelogCommands extends PrjctCommandsBase {
  async changelog(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result

    const days = Number((input ?? '').trim()) || 14
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

    const ships = prjctDb.query<ShipRow>(
      proj.value,
      'SELECT name, version, shipped_at FROM shipped_features WHERE shipped_at >= ? ORDER BY shipped_at DESC',
      sinceIso
    )
    const done = prjctDb.query<DoneRow>(
      proj.value,
      `SELECT description, type, completed_at FROM tasks
       WHERE status = 'completed' AND completed_at >= ?
       ORDER BY completed_at DESC LIMIT 40`,
      sinceIso
    )

    if (ships.length === 0 && done.length === 0) {
      const msg = `Nothing shipped or completed in the last ${days} day(s).`
      if (options.md) console.log(`> ${msg}`)
      else out.info(msg)
      return { success: true, ships: 0, completed: 0 }
    }

    const lines = [`# Changelog — last ${days} day(s)`, '']
    if (ships.length > 0) {
      // Group ships by version; 'unversioned' entries render under their date.
      const byVersion = new Map<string, ShipRow[]>()
      for (const s of ships) {
        const key =
          s.version && s.version !== 'unversioned' ? `v${s.version}` : s.shipped_at.slice(0, 10)
        const bucket = byVersion.get(key) ?? []
        bucket.push(s)
        byVersion.set(key, bucket)
      }
      lines.push('## Shipped')
      for (const [version, rows] of byVersion) {
        lines.push('', `### ${version} — ${rows[0].shipped_at.slice(0, 10)}`)
        for (const r of rows) lines.push(`- ${r.name}`)
      }
      lines.push('')
    }
    if (done.length > 0) {
      lines.push('## Completed work cycles', '')
      for (const d of done) {
        const tag = d.type ? ` \`${d.type}\`` : ''
        lines.push(`- ${d.description}${tag} (${d.completed_at.slice(0, 10)})`)
      }
    }

    console.log(lines.join('\n'))
    return { success: true, ships: ships.length, completed: done.length }
  }
}
