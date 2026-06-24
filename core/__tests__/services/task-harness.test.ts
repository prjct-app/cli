import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CurrentTask } from '../../schemas/state'
import { buildTaskHarness, evaluateHarnessCompletion } from '../../services/task-harness'
import { execFileAsync } from '../../utils/exec'

let dir: string

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: dir })
}

async function currentTask(description: string): Promise<CurrentTask> {
  return {
    id: 'task-1',
    description,
    startedAt: new Date().toISOString(),
    sessionId: 'session-1',
    harness: buildTaskHarness(description),
  }
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-task-harness-'))
  await git(['init', '-q', '-b', 'main'])
  await git(['config', 'user.email', 'test@example.com'])
  await git(['config', 'user.name', 'Test'])
  await git(['config', 'commit.gpgsign', 'false'])
  await fs.mkdir(path.join(dir, 'src'), { recursive: true })
  await fs.writeFile(path.join(dir, 'src', 'index.ts'), 'export const value = 1\n')
  await git(['add', '.'])
  await git(['commit', '-q', '-m', 'init'])
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

describe('buildTaskHarness', () => {
  test('classifies a Codex install bug as H1 with regression evidence', () => {
    const harness = buildTaskHarness('bug en codex no se instala el statusbar eso es un must')

    expect(harness.level).toBe('H1')
    expect(harness.kind).toBe('bug')
    expect(harness.risk).toBe('high')
    expect(harness.expectedEvidence).toContain('regression-test')
    expect(harness.expectedEvidence).toContain('docs-if-public-behavior')
    expect(harness.gates).toContain('verify-before-done')
  })

  test('classifies a new implementation as H2 with scope-check evidence', () => {
    const harness = buildTaskHarness('implement transparent auto-harness on task start')

    expect(harness.level).toBe('H2')
    expect(harness.kind).toBe('feature')
    expect(harness.expectedEvidence).toContain('scope-check')
    expect(harness.expectedEvidence).toContain('spec-or-design')
  })

  test('keeps docs-only work low friction', () => {
    const harness = buildTaskHarness('docs typo in README')

    expect(harness.level).toBe('H0')
    expect(harness.kind).toBe('docs')
    expect(harness.expectedEvidence).toEqual([])
    expect(harness.gates).toEqual([])
  })
})

describe('evaluateHarnessCompletion', () => {
  test('warns when a bug task changes product code without a regression test', async () => {
    await fs.writeFile(path.join(dir, 'src', 'index.ts'), 'export const value = 2\n')

    const evaluation = await evaluateHarnessCompletion(
      dir,
      await currentTask('fix settings regression')
    )

    expect(evaluation.changedFiles).toContain('src/index.ts')
    expect(evaluation.warnings.join('\n')).toContain('expects a regression test')
  })

  test('does not warn about regression evidence when a test file changed', async () => {
    await fs.mkdir(path.join(dir, 'src', '__tests__'), { recursive: true })
    await fs.writeFile(path.join(dir, 'src', '__tests__', 'index.test.ts'), 'test("x", () => {})\n')

    const evaluation = await evaluateHarnessCompletion(
      dir,
      await currentTask('fix settings regression')
    )

    expect(evaluation.observedEvidence).toContain('tests-changed')
    expect(evaluation.warnings.join('\n')).not.toContain('expects a regression test')
  })
})
