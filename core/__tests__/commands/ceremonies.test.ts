import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { prjctDb } from '../../storage/database'

let tmpHome: string
let prevHome: string | undefined
const pid = 'ceremony-test'

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cer-test-'))
  prevHome = process.env.PRJCT_CLI_HOME
  process.env.PRJCT_CLI_HOME = tmpHome
  prjctDb.get(pid, 'SELECT 1')
})

afterAll(() => {
  if (prevHome) process.env.PRJCT_CLI_HOME = prevHome
  else delete process.env.PRJCT_CLI_HOME
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

describe('ceremonies — journal + brief persistence', () => {
  it('task_log is append-only and ordered', () => {
    const now = new Date().toISOString()
    prjctDb.run(
      pid,
      'INSERT INTO task_log (task_id, content, created_at) VALUES (?, ?, ?)',
      't1',
      'first attempt',
      now
    )
    prjctDb.run(
      pid,
      'INSERT INTO task_log (task_id, content, created_at) VALUES (?, ?, ?)',
      't1',
      'second attempt',
      now
    )
    const rows = prjctDb.query<{ content: string }>(
      pid,
      'SELECT content FROM task_log WHERE task_id = ? ORDER BY id',
      't1'
    )
    expect(rows.map((r) => r.content)).toEqual(['first attempt', 'second attempt'])
  })

  it('task_briefs upserts (one live brief per task)', () => {
    const now = new Date().toISOString()
    const upsert = (c: string) =>
      prjctDb.run(
        pid,
        `INSERT INTO task_briefs (task_id, content, created_at) VALUES (?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`,
        't1',
        c,
        now
      )
    upsert('v1')
    upsert('v2')
    const rows = prjctDb.query<{ content: string }>(
      pid,
      'SELECT content FROM task_briefs WHERE task_id = ?',
      't1'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('v2')
  })
})
