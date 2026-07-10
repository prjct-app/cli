/**
 * Land receipt persistence against real SQLite (tmp project).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectMemory } from '../../memory/project-memory'
import {
  buildJudgmentReceipt,
  countReceiptsWritten,
  latestJudgmentReceipt24h,
  persistJudgmentReceipt,
  RECEIPT_CAPTURE,
  RECEIPT_SOURCE,
  RECEIPT_TOPIC,
} from '../../services/judgment-receipt'
import { prjctDb } from '../../storage/database'

describe('persistJudgmentReceipt (real SQLite path)', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const r of roots) {
      try {
        fs.rmSync(r, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    roots.length = 0
  })

  async function tmpProject(): Promise<{ projectPath: string; projectId: string }> {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-receipt-'))
    roots.push(projectPath)
    const projectId = randomUUID()
    fs.mkdirSync(path.join(projectPath, '.prjct'), { recursive: true })
    fs.writeFileSync(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({
        projectId,
        dataPath: path.join(os.homedir(), '.prjct-cli', 'projects', projectId),
      }),
      'utf-8'
    )
    // Ensure DB exists via a no-op query path
    prjctDb.getDoc(projectId, 'project')
    return { projectPath, projectId }
  }

  test('null builder → nothing-to-receipt', async () => {
    const { projectPath, projectId } = await tmpProject()
    const r = await persistJudgmentReceipt(projectPath, projectId, {})
    expect(r.wrote).toBe(false)
    expect(r.reason).toBe('nothing-to-receipt')
  })

  test('writes context memory with required tags when signal exists', async () => {
    const { projectPath, projectId } = await tmpProject()
    const content = buildJudgmentReceipt({
      cycleDescription: 'test receipt cycle',
      trapsSurfaced: [{ id: 'mem_fixture', type: 'gotcha', title: 'fixture trap for receipt' }],
    })
    expect(content).not.toBeNull()

    const r = await persistJudgmentReceipt(projectPath, projectId, {
      cycleDescription: 'test receipt cycle',
      trapsSurfaced: [{ id: 'mem_fixture', type: 'gotcha', title: 'fixture trap for receipt' }],
    })
    expect(r.wrote).toBe(true)
    expect(r.summary).toContain('trap')
    expect(r.content).toContain('Judgment Receipt')

    // Verify via project memory / SQL tags
    const n = countReceiptsWritten(projectId, 0)
    expect(n).toBeGreaterThanOrEqual(1)

    const latest = latestJudgmentReceipt24h(projectId)
    expect(latest).not.toBeNull()
    expect(latest!.content).toContain('Judgment Receipt')

    // Tag integrity
    const row = prjctDb.get<{ c: number }>(
      projectId,
      `SELECT COUNT(*) AS c
       FROM memory_entries me
       JOIN memory_entry_tags t1 ON t1.entry_id = me.id AND t1.key = 'source' AND t1.value = ?
       JOIN memory_entry_tags t2 ON t2.entry_id = me.id AND t2.key = 'topic' AND t2.value = ?
       JOIN memory_entry_tags t3 ON t3.entry_id = me.id AND t3.key = 'capture' AND t3.value = ?
       WHERE me.deleted_at IS NULL`,
      RECEIPT_SOURCE,
      RECEIPT_TOPIC,
      RECEIPT_CAPTURE
    )
    expect(row?.c ?? 0).toBeGreaterThanOrEqual(1)

    // Also ensure remember path is the real one
    await projectMemory.remember(projectPath, {
      type: 'gotcha',
      content: 'side signal not a receipt',
      projectId,
    })
  })
})
