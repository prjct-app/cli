import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { estimateTaskForStart } from '../../services/task-estimation'

let tmpRoot: string | null = null
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('estimateTaskForStart', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-estimate-'))
    pathManager.getGlobalProjectPath = (projectId: string) => path.join(tmpRoot!, projectId)
  })

  afterEach(async () => {
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  it('uses heuristic estimate when no historical outcomes exist', async () => {
    const estimate = await estimateTaskForStart('project-a', 'fix typo in setup output')

    expect(estimate.source).toBe('heuristic')
    expect(estimate.taskType).toBe('feature')
    expect(estimate.estimatedPoints).toBe(5)
    expect(estimate.estimatedMinutes).toBe(90)
  })

  it('uses history estimate when enough tagged outcomes exist', async () => {
    const projectId = 'project-b'
    const outcomesDir = path.join(tmpRoot!, projectId, 'outcomes')
    await fs.mkdir(outcomesDir, { recursive: true })

    const line = (minutes: string) =>
      JSON.stringify({
        sessionId: `s-${minutes}`,
        command: 'done',
        task: 'historical feature',
        startedAt: '2026-02-10T00:00:00.000Z',
        completedAt: '2026-02-10T01:00:00.000Z',
        estimatedDuration: '2h',
        actualDuration: minutes,
        variance: '+0m',
        completedAsPlanned: true,
        qualityScore: 3,
        tags: ['feature'],
        id: `id-${minutes}`,
      })

    await fs.writeFile(
      path.join(outcomesDir, 'outcomes.jsonl'),
      `${[line('3h'), line('2h 45m'), line('3h 15m')].join('\n')}\n`,
      'utf-8'
    )

    const estimate = await estimateTaskForStart(projectId, 'add oauth login flow')

    expect(estimate.source).toBe('history')
    expect(estimate.taskType).toBe('feature')
    expect(estimate.estimatedPoints).toBe(8)
    expect(estimate.estimatedMinutes).toBe(180)
  })
})
