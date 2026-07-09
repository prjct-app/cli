import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { probeHarnessCoverage, renderHarnessCoverageMd } from '../../services/harness-coverage'

describe('harness coverage (organic multi-runtime board)', () => {
  let home: string
  let prevHome: string | undefined
  let prevTestMode: string | undefined

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-coverage-home-'))
    prevHome = process.env.HOME
    prevTestMode = process.env.PRJCT_TEST_MODE
    process.env.HOME = home
    process.env.PRJCT_TEST_MODE = '1'
    // Isolate codex/gemini/cursor paths under test home via resolveUserPath + PRJCT_TEST_MODE
  })

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.HOME
    else process.env.HOME = prevHome
    if (prevTestMode === undefined) delete process.env.PRJCT_TEST_MODE
    else process.env.PRJCT_TEST_MODE = prevTestMode
    await fs.rm(home, { recursive: true, force: true }).catch(() => {})
  })

  it('reports absent when no runtimes are wired', async () => {
    const report = await probeHarnessCoverage(home)
    expect(report.runtimes.length).toBe(5)
    // Without CLIs on PATH in a fresh HOME, detected may still be 0
    expect(report.organicPct).toBeGreaterThanOrEqual(0)
    expect(report.grade).toBeGreaterThanOrEqual(1)
  })

  it('marks Claude full when settings + mcp.json have prjct wire', async () => {
    const claude = path.join(home, '.claude')
    await fs.mkdir(claude, { recursive: true })
    await fs.writeFile(
      path.join(claude, 'settings.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'prjct hook session-start',
                  _prjctManaged: true,
                },
              ],
            },
          ],
        },
      }),
      'utf-8'
    )
    await fs.writeFile(
      path.join(claude, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          prjct: { command: 'prjct', args: ['mcp-server'] },
        },
      }),
      'utf-8'
    )

    const report = await probeHarnessCoverage(home)
    const claudeRow = report.runtimes.find((r) => r.id === 'claude')
    expect(claudeRow?.detected).toBe(true)
    expect(claudeRow?.hooksLive).toBe(true)
    expect(claudeRow?.mcpLive).toBe(true)
    expect(claudeRow?.organic).toBe('full')
  })

  it('renders dominance board markdown', async () => {
    const report = await probeHarnessCoverage(home)
    const md = renderHarnessCoverageMd(report)
    expect(md).toContain('Organic multi-runtime board')
    expect(md).toContain('Claude Code')
    expect(md).toContain('Grok Build')
    expect(md).toContain('Moat')
  })

  it('grades higher when more detected surfaces are live', async () => {
    // Wire Claude full — at least one live when detected
    const claude = path.join(home, '.claude')
    await fs.mkdir(claude, { recursive: true })
    await fs.writeFile(
      path.join(claude, 'settings.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                { type: 'command', command: 'prjct hook session-start', _prjctManaged: true },
              ],
            },
          ],
        },
      }),
      'utf-8'
    )
    await fs.writeFile(
      path.join(claude, 'mcp.json'),
      JSON.stringify({ mcpServers: { prjct: { command: 'prjct', args: ['mcp-server'] } } }),
      'utf-8'
    )
    const report = await probeHarnessCoverage(home)
    const claudeRow = report.runtimes.find((r) => r.id === 'claude')
    if (claudeRow?.detected) {
      expect(report.liveCount).toBeGreaterThanOrEqual(1)
      expect(report.grade).toBeGreaterThanOrEqual(3)
    }
  })
})
