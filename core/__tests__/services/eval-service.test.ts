import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  compareEvalRuns,
  formatEvalRunMarkdown,
  loadLatestEvalComparison,
  loadLatestEvalRun,
  publishEvalComparison,
  publishEvalRun,
  runEval,
} from '../../services/eval-service'
import { execFileAsync } from '../../utils/exec'

let tmpRoot = ''
let projectPath = ''
let originalCliHome: string | undefined

async function writeFile(relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectPath, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

async function setupGitProject(): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: projectPath })
  await execFileAsync('git', ['config', 'user.email', 'eval@example.com'], { cwd: projectPath })
  await execFileAsync('git', ['config', 'user.name', 'Eval Runner'], { cwd: projectPath })
  await execFileAsync('git', ['remote', 'add', 'origin', 'git@github.com:acme/prjct-evals.git'], {
    cwd: projectPath,
  })
}

async function createHealthyProject(): Promise<void> {
  await writeFile('AGENTS.md', '# Agent contract\n')
  await writeFile('.prjct/prjct.config.json', '{"projectId":"eval-test"}\n')
  await writeFile(
    'package.json',
    JSON.stringify(
      { name: 'eval-test', version: '1.0.0', scripts: { test: 'bun test', lint: 'biome check .' } },
      null,
      2
    )
  )
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-eval-test-'))
  projectPath = path.join(tmpRoot, 'repo')
  await fs.mkdir(projectPath, { recursive: true })
  originalCliHome = process.env.PRJCT_CLI_HOME
  process.env.PRJCT_CLI_HOME = path.join(tmpRoot, 'home')
  await setupGitProject()
})

afterEach(async () => {
  if (originalCliHome === undefined) delete process.env.PRJCT_CLI_HOME
  else process.env.PRJCT_CLI_HOME = originalCliHome
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined)
})

describe('eval-service', () => {
  // CI core-b: this suite does real git + multi-scenario eval; 5s default is tight on busy runners.
  test('runs deterministic evals and stores portable artifacts', async () => {
    await createHealthyProject()

    const run = await runEval(projectPath, { candidate: 'candidate-a', source: 'agent' })
    const latest = await loadLatestEvalRun(projectPath)

    expect(run.schemaVersion).toBe(1)
    expect(run.runner.source).toBe('agent')
    expect(run.project.repo).toBe('acme/prjct-evals')
    expect(run.summary.score).toBeGreaterThan(0)
    expect(run.scenarios.length).toBeGreaterThanOrEqual(5)
    expect(run.scenarios.every((scenario) => scenario.actionables.length > 0)).toBe(true)
    expect(latest?.runId).toBe(run.runId)
    expect(run.artifacts?.jsonPath).toBeTruthy()
    expect(run.artifacts?.reportPath).toBeTruthy()

    const json = await fs.readFile(run.artifacts?.jsonPath ?? '', 'utf-8')
    const report = await fs.readFile(run.artifacts?.reportPath ?? '', 'utf-8')
    expect(json).toContain(run.runId)
    expect(report).toContain('## Actionables')
  }, 20_000)

  test('detects stale user-facing command guidance with concrete files', async () => {
    await createHealthyProject()
    await writeFile('docs/usage.md', 'Run /p: sync before shipping.\n')

    const run = await runEval(projectPath, { candidate: 'stale-guidance' })
    const staleScenario = run.scenarios.find((scenario) => scenario.id === 'stale-command-guidance')

    expect(staleScenario?.status).toBe('warn')
    expect(staleScenario?.metrics.staleHits).toBe(1)
    expect(staleScenario?.actionables[0]?.files).toContain('docs/usage.md')
  })

  test('compares baseline and candidate runs with actionable version deltas', async () => {
    await writeFile('package.json', JSON.stringify({ scripts: {} }, null, 2))
    const baseline = await runEval(projectPath, { candidate: 'baseline-version' })

    await createHealthyProject()
    const candidate = await runEval(projectPath, { candidate: 'candidate-version' })
    const comparison = await compareEvalRuns(projectPath, {
      baseline: 'baseline-version',
      candidate: 'candidate-version',
    })

    const latestComparison = await loadLatestEvalComparison(projectPath)

    expect(comparison.comparisonId).toContain('baseline-version_to_candidate-version')
    expect(comparison.baselineRunId).toBe(baseline.runId)
    expect(comparison.candidateRunId).toBe(candidate.runId)
    expect(comparison.baselineVersion).toBe('baseline-version')
    expect(comparison.candidateVersion).toBe('candidate-version')
    expect(comparison.summary.delta ?? 0).toBeGreaterThan(0)
    expect(comparison.summary.improvements).toBeGreaterThan(0)
    expect(comparison.scenarios.some((scenario) => scenario.status === 'improved')).toBe(true)
    expect(comparison.scenarios.every((scenario) => scenario.actionables.length > 0)).toBe(true)
    expect(latestComparison?.comparisonId).toBe(comparison.comparisonId)
    expect(comparison.artifacts?.jsonPath).toBeTruthy()
    expect(comparison.artifacts?.reportPath).toBeTruthy()
  })

  test('prepares cloud benchmark publication without network writes in dry run', async () => {
    await createHealthyProject()
    const run = await runEval(projectPath, { candidate: 'publishable' })

    const result = await publishEvalRun(projectPath, { dryRun: true })

    expect(result.dryRun).toBe(true)
    expect(result.target).toBe('cloud')
    expect(result.projectId).toBe('eval-test')
    expect(result.repo).toBe('acme/prjct-evals')
    expect(result.runId).toBe(run.runId)
    expect(result.endpoint).toBe('https://api.prjct.app/benchmarks/evals')
    expect(result.payloadBytes).toBeGreaterThan(0)
    expect(result.url).toBeUndefined()
  })

  test('prepares cloud comparison publication without network writes in dry run', async () => {
    await writeFile('package.json', JSON.stringify({ scripts: {} }, null, 2))
    await runEval(projectPath, { candidate: 'baseline-publish' })
    await createHealthyProject()
    await runEval(projectPath, { candidate: 'candidate-publish' })
    const comparison = await compareEvalRuns(projectPath, {
      baseline: 'baseline-publish',
      candidate: 'candidate-publish',
    })

    const result = await publishEvalComparison(projectPath, comparison, { dryRun: true })

    expect(result.dryRun).toBe(true)
    expect(result.artifactType).toBe('comparison')
    expect(result.comparisonId).toBe(comparison.comparisonId)
    expect(result.target).toBe('cloud')
    expect(result.projectId).toBe('eval-test')
    expect(result.endpoint).toBe('https://api.prjct.app/benchmarks/evals')
    expect(result.payloadBytes).toBeGreaterThan(0)
  })

  test('formats markdown reports with scenario metrics and actionables', async () => {
    await createHealthyProject()
    const run = await runEval(projectPath, { candidate: 'markdown' })

    const markdown = formatEvalRunMarkdown(run)

    expect(markdown).toContain('# prjct eval run')
    expect(markdown).toContain('| Scenario | Status | Score | Actionables |')
    expect(markdown).toContain('## Actionables')
  })

  test('rejects removed GitHub publication target with an actionable migration', async () => {
    await createHealthyProject()
    await runEval(projectPath, { candidate: 'removed-github' })

    await expect(publishEvalRun(projectPath, { target: 'github', dryRun: true })).rejects.toThrow(
      'GitHub eval publishing was removed'
    )
  })
})
