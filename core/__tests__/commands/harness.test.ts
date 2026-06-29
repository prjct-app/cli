/**
 * `prjct harness` — the two Body-creation paths wired through the command.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { HarnessCommands } from '../../commands/harness'

describe('prjct harness command', () => {
  const cmd = new HarnessCommands()
  let logSpy: ReturnType<typeof spyOn>
  let errSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
    errSpy = spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  const logged = (): string => logSpy.mock.calls.flat().join('\n')

  it('list prints the stealable rigs', async () => {
    const r = await cmd.list()
    expect(r.success).toBe(true)
    expect(logged()).toContain('safe-agentic-workflow')
  })

  it('use <known> emits the adoption plan', async () => {
    const r = await cmd.use('safe-agentic-workflow')
    expect(r.success).toBe(true)
    expect(logged()).toContain('adopt rig')
  })

  it('use <unknown> fails loudly', async () => {
    const r = await cmd.use('does-not-exist')
    expect(r.success).toBe(false)
  })

  it('learn-from emits the induction dispatch even with no project', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-harness-'))
    const r = await cmd.learnFrom(dir)
    expect(r.success).toBe(true)
    expect(logged()).toContain('induction')
    await fs.rm(dir, { recursive: true, force: true })
  })
})
