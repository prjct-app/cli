/**
 * Product eval harness.
 *
 * This is deliberately deterministic by default: every run yields structured
 * metrics, actionables, and files that can be compared between versions or
 * published to GitHub without invoking an LLM.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveCliHome } from '../infrastructure/cli-home'
import type { EvalActionable, EvalComparison, EvalRun, EvalScenario } from '../schemas/eval'
import { EvalComparisonSchema, EvalRunSchema } from '../schemas/eval'
import { getErrorMessage } from '../types/fs'
import { execFileAsync } from '../utils/exec'
import { getVersion } from '../utils/version'

export interface EvalRunOptions {
  baseline?: string
  candidate?: string
  source?: 'local' | 'ci' | 'agent'
}

export interface EvalCompareOptions {
  baseline?: string
  candidate?: string
}

export interface EvalPublishOptions {
  target?: string
  file?: string
  dryRun?: boolean
}

export interface EvalPublishResult {
  target: string
  dryRun: boolean
  artifactType: 'run' | 'comparison'
  artifactId: string
  runId?: string
  comparisonId?: string
  repo: string
  branch: string
  files: Array<{ path: string; action: 'create' | 'update' | 'skip' }>
  url?: string
}

interface GitInfo {
  repo: string
  ownerRepo?: string
  branch?: string
  commit?: string
  dirty: boolean
}

interface ScenarioContext {
  projectPath: string
  git: GitInfo
}

const EVAL_SCHEMA_VERSION = 1
const SCORE_REGRESSION_THRESHOLD = -5
const SCORE_IMPROVEMENT_THRESHOLD = 5

export async function runEval(projectPath: string, options: EvalRunOptions = {}): Promise<EvalRun> {
  const createdAt = new Date().toISOString()
  const git = await detectGit(projectPath)
  const context: ScenarioContext = { projectPath, git }
  const scenarios = await runScenarios(context)
  const summary = summarizeScenarios(scenarios)
  const run: EvalRun = {
    schemaVersion: EVAL_SCHEMA_VERSION,
    runId: runId(createdAt),
    createdAt,
    runner: {
      source: options.source ?? detectSource(),
      user: await detectRunnerUser(projectPath),
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      bun: await detectBunVersion(),
    },
    project: {
      repo: git.repo,
      branch: git.branch,
      commit: git.commit,
      dirty: git.dirty,
    },
    versions: {
      current: getVersion(),
      baseline: options.baseline,
      candidate: options.candidate ?? getVersion(),
    },
    scenarios,
    summary,
  }

  return saveEvalRun(run)
}

export async function loadLatestEvalRun(projectPath: string): Promise<EvalRun | null> {
  const latestPath = path.join(evalProjectDir(await detectGit(projectPath)), 'latest.json')
  return readRunFile(latestPath)
}

export async function loadLatestEvalComparison(
  projectPath: string
): Promise<EvalComparison | null> {
  const latestPath = path.join(
    evalProjectDir(await detectGit(projectPath)),
    'latest-comparison.json'
  )
  return readComparisonFile(latestPath)
}

export async function loadEvalRunByVersion(
  projectPath: string,
  version: string | undefined
): Promise<EvalRun | null> {
  if (!version) return loadLatestEvalRun(projectPath)
  const dir = path.join(evalProjectDir(await detectGit(projectPath)), 'runs')
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return null
  }

  const runs = (
    await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readRunFile(path.join(dir, entry)))
    )
  ).filter((run): run is EvalRun => Boolean(run))

  return (
    runs
      .filter((run) => run.versions.current === version || run.versions.candidate === version)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}

export async function compareEvalRuns(
  projectPath: string,
  options: EvalCompareOptions = {}
): Promise<EvalComparison> {
  const baseline = await loadEvalRunByVersion(projectPath, options.baseline)
  const candidate = options.candidate
    ? await loadEvalRunByVersion(projectPath, options.candidate)
    : await loadLatestEvalRun(projectPath)

  const scenarioIds = new Set<string>([
    ...(baseline?.scenarios.map((scenario) => scenario.id) ?? []),
    ...(candidate?.scenarios.map((scenario) => scenario.id) ?? []),
  ])

  const scenarios = [...scenarioIds].sort().map((id) => {
    const b = baseline?.scenarios.find((scenario) => scenario.id === id)
    const c = candidate?.scenarios.find((scenario) => scenario.id === id)
    const delta = b && c ? Math.round((c.score - b.score) * 10) / 10 : undefined
    const actionables: EvalActionable[] = []
    let status: EvalComparison['scenarios'][number]['status'] = 'unchanged'

    if (!b) {
      status = 'missing-baseline'
      actionables.push({
        severity: 'warning',
        title: `No baseline result for ${id}`,
        recommendation:
          'Run `prjct eval run --candidate <baseline-version>` before comparing releases.',
      })
    } else if (!c) {
      status = 'missing-candidate'
      actionables.push({
        severity: 'blocking',
        title: `No candidate result for ${id}`,
        recommendation:
          'Run `prjct eval run` for the candidate version before publishing a comparison.',
      })
    } else if ((delta ?? 0) <= SCORE_REGRESSION_THRESHOLD) {
      status = 'regressed'
      actionables.push({
        severity: 'blocking',
        title: `${id} regressed by ${Math.abs(delta ?? 0)} points`,
        recommendation: regressionRecommendation(id),
      })
    } else if ((delta ?? 0) >= SCORE_IMPROVEMENT_THRESHOLD) {
      status = 'improved'
      actionables.push({
        severity: 'info',
        title: `${id} improved by ${delta} points`,
        recommendation: 'Keep this scenario in PR checks so the improvement is protected.',
      })
    } else if (b && c) {
      actionables.push({
        severity: 'info',
        title: `${id} stayed within the regression threshold`,
        recommendation:
          'Keep collecting this scenario so future optimizations have a stable baseline.',
      })
    }

    return {
      id,
      baselineScore: b?.score,
      candidateScore: c?.score,
      delta,
      status,
      actionables,
    }
  })

  const regressions = scenarios.filter((scenario) => scenario.status === 'regressed').length
  const improvements = scenarios.filter((scenario) => scenario.status === 'improved').length
  const createdAt = new Date().toISOString()
  const baselineVersion =
    baseline?.versions.candidate ?? baseline?.versions.current ?? options.baseline
  const candidateVersion =
    candidate?.versions.candidate ?? candidate?.versions.current ?? options.candidate
  const comparison: EvalComparison = {
    schemaVersion: EVAL_SCHEMA_VERSION,
    comparisonId: comparisonId(createdAt, baselineVersion, candidateVersion),
    createdAt,
    baselineRunId: baseline?.runId,
    candidateRunId: candidate?.runId,
    baselineVersion,
    candidateVersion,
    summary: {
      baselineScore: baseline?.summary.score,
      candidateScore: candidate?.summary.score,
      delta:
        baseline && candidate
          ? Math.round((candidate.summary.score - baseline.summary.score) * 10) / 10
          : undefined,
      regressions,
      improvements,
      actionables: scenarios.reduce((sum, scenario) => sum + scenario.actionables.length, 0),
    },
    scenarios,
  }
  return saveEvalComparison(projectPath, comparison)
}

interface EvalPublishFile {
  path: string
  content: string
  action: 'create' | 'update'
}

export async function publishEvalRun(
  projectPath: string,
  options: EvalPublishOptions = {}
): Promise<EvalPublishResult> {
  const target = options.target ?? 'github'
  if (target !== 'github') {
    throw new Error(`Unsupported eval publish target: ${target}`)
  }

  const run = options.file
    ? await readRequiredRunFile(options.file)
    : await loadLatestRequired(projectPath)
  const report = formatEvalRunMarkdown(run)
  const git = await detectGit(projectPath)
  if (!git.ownerRepo) {
    throw new Error('GitHub publish requires a GitHub remote.')
  }

  const date = run.createdAt.slice(0, 10)
  const files: EvalPublishFile[] = [
    {
      path: `eval-results/runs/${date}/${run.runId}.json`,
      content: `${JSON.stringify(run, null, 2)}\n`,
      action: 'create',
    },
    {
      path: `eval-results/runs/${date}/${run.runId}.md`,
      content: report,
      action: 'create',
    },
    {
      path: 'eval-results/summary/latest.json',
      content: `${JSON.stringify(run, null, 2)}\n`,
      action: 'update',
    },
  ]

  return publishFiles(git.ownerRepo, target, options.dryRun === true, files, {
    artifactType: 'run',
    artifactId: run.runId,
    runId: run.runId,
  })
}

export async function publishEvalComparison(
  projectPath: string,
  comparison: EvalComparison,
  options: EvalPublishOptions = {}
): Promise<EvalPublishResult> {
  const target = options.target ?? 'github'
  if (target !== 'github') {
    throw new Error(`Unsupported eval publish target: ${target}`)
  }

  const git = await detectGit(projectPath)
  if (!git.ownerRepo) {
    throw new Error('GitHub publish requires a GitHub remote.')
  }

  const date = comparison.createdAt.slice(0, 10)
  const files: EvalPublishFile[] = [
    {
      path: `eval-results/comparisons/${date}/${comparison.comparisonId}.json`,
      content: `${JSON.stringify(comparison, null, 2)}\n`,
      action: 'create',
    },
    {
      path: `eval-results/comparisons/${date}/${comparison.comparisonId}.md`,
      content: formatEvalComparisonMarkdown(comparison),
      action: 'create',
    },
    {
      path: 'eval-results/summary/latest-comparison.json',
      content: `${JSON.stringify(comparison, null, 2)}\n`,
      action: 'update',
    },
  ]

  return publishFiles(git.ownerRepo, target, options.dryRun === true, files, {
    artifactType: 'comparison',
    artifactId: comparison.comparisonId,
    comparisonId: comparison.comparisonId,
  })
}

export function formatEvalRunMarkdown(run: EvalRun): string {
  const actionables = run.scenarios.flatMap((scenario) =>
    scenario.actionables.map((actionable) => ({ scenario: scenario.id, actionable }))
  )
  const scenarioRows = run.scenarios
    .map(
      (scenario) =>
        `| \`${scenario.id}\` | ${scenario.status} | ${scenario.score} | ${scenario.actionables.length} |`
    )
    .join('\n')
  const actionableRows =
    actionables.length === 0
      ? '_No actionables._'
      : actionables
          .map(
            ({ scenario, actionable }) =>
              `- **${actionable.severity}** \`${scenario}\`: ${actionable.title}. ${actionable.recommendation}`
          )
          .join('\n')

  return `# prjct eval run

Run: \`${run.runId}\`
Version: \`${run.versions.current}\`
Repo: \`${run.project.repo}\`
Commit: \`${run.project.commit ?? 'unknown'}\`

## Summary

| Metric | Value |
|---|---:|
| Score | ${run.summary.score} |
| Pass | ${run.summary.pass} |
| Warn | ${run.summary.warn} |
| Fail | ${run.summary.fail} |
| Actionables | ${run.summary.actionables} |

## Scenarios

| Scenario | Status | Score | Actionables |
|---|---|---:|---:|
${scenarioRows}

## Actionables

${actionableRows}
`
}

export function formatEvalComparisonMarkdown(comparison: EvalComparison): string {
  const rows = comparison.scenarios
    .map(
      (scenario) =>
        `| \`${scenario.id}\` | ${scenario.status} | ${scenario.baselineScore ?? '-'} | ${scenario.candidateScore ?? '-'} | ${scenario.delta ?? '-'} |`
    )
    .join('\n')
  const actionables = comparison.scenarios.flatMap((scenario) =>
    scenario.actionables.map(
      (actionable) =>
        `- **${actionable.severity}** \`${scenario.id}\`: ${actionable.title}. ${actionable.recommendation}`
    )
  )

  return `# prjct eval comparison

Comparison: \`${comparison.comparisonId}\`
Baseline: \`${comparison.baselineVersion ?? 'missing'}\`
Candidate: \`${comparison.candidateVersion ?? 'missing'}\`

## Summary

| Metric | Value |
|---|---:|
| Baseline score | ${comparison.summary.baselineScore ?? '-'} |
| Candidate score | ${comparison.summary.candidateScore ?? '-'} |
| Delta | ${comparison.summary.delta ?? '-'} |
| Improvements | ${comparison.summary.improvements} |
| Regressions | ${comparison.summary.regressions} |
| Actionables | ${comparison.summary.actionables} |

## Scenarios

| Scenario | Status | Baseline | Candidate | Delta |
|---|---|---:|---:|---:|
${rows || '| _none_ | - | - | - | - |'}

## Actionables

${actionables.length > 0 ? actionables.join('\n') : '_No actionables._'}
`
}

function summarizeScenarios(scenarios: EvalScenario[]): EvalRun['summary'] {
  const score =
    scenarios.length === 0
      ? 0
      : Math.round(scenarios.reduce((sum, scenario) => sum + scenario.score, 0) / scenarios.length)
  return {
    score,
    pass: scenarios.filter((scenario) => scenario.status === 'pass').length,
    warn: scenarios.filter((scenario) => scenario.status === 'warn').length,
    fail: scenarios.filter((scenario) => scenario.status === 'fail').length,
    improvements: 0,
    regressions: scenarios.filter((scenario) => scenario.status === 'fail').length,
    actionables: scenarios.reduce((sum, scenario) => sum + scenario.actionables.length, 0),
  }
}

async function runScenarios(context: ScenarioContext): Promise<EvalScenario[]> {
  return Promise.all([
    scenario('agent-surface-readiness', 'Agent surface readiness', () =>
      evalAgentSurface(context.projectPath)
    ),
    scenario('project-sync-readiness', 'Project sync readiness', () =>
      evalProjectSyncReadiness(context.projectPath)
    ),
    scenario('stale-command-guidance', 'Stale command guidance', () =>
      evalStaleCommandGuidance(context.projectPath)
    ),
    scenario('quality-command-readiness', 'Quality command readiness', () =>
      evalQualityCommandReadiness(context.projectPath)
    ),
    scenario('github-publish-readiness', 'GitHub publish readiness', () =>
      evalGithubPublishReadiness(context.git)
    ),
  ])
}

async function scenario(
  id: string,
  name: string,
  run: () => Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>>
): Promise<EvalScenario> {
  const started = Date.now()
  const result = await run()
  return { id, name, durationMs: Date.now() - started, ...result }
}

async function evalAgentSurface(
  projectPath: string
): Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>> {
  const agents = await exists(path.join(projectPath, 'AGENTS.md'))
  const claude = await exists(path.join(projectPath, 'CLAUDE.md'))
  const score = agents ? 100 : claude ? 70 : 20
  return {
    status: score >= 90 ? 'pass' : 'warn',
    score,
    metrics: { agentsMd: agents, claudeMd: claude },
    actionables:
      score >= 90
        ? [
            {
              severity: 'info',
              title: 'Portable agent surface is present',
              recommendation: 'Keep `prjct agents doctor --fix` in release smoke checks.',
              command: 'prjct agents doctor --fix',
            },
          ]
        : [
            {
              severity: 'warning',
              title: 'Portable AGENTS.md surface is missing',
              recommendation:
                'Run `prjct agents doctor --fix` so future agents start with the same project contract.',
              command: 'prjct agents doctor --fix',
            },
          ],
  }
}

async function evalProjectSyncReadiness(
  projectPath: string
): Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>> {
  const config = await exists(path.join(projectPath, '.prjct', 'prjct.config.json'))
  return {
    status: config ? 'pass' : 'warn',
    score: config ? 100 : 40,
    metrics: { projectConfig: config },
    actionables: [
      config
        ? {
            severity: 'info',
            title: 'Project has a prjct identity',
            recommendation:
              'Use `prjct sync --md` in eval smoke runs to keep generated context measurable.',
            command: 'prjct sync --md',
          }
        : {
            severity: 'warning',
            title: 'Project is not registered with prjct',
            recommendation:
              'Run `prjct sync` before comparing eval runs so metrics map to a stable project id.',
            command: 'prjct sync',
          },
    ],
  }
}

async function evalStaleCommandGuidance(
  projectPath: string
): Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>> {
  const files = await collectTextFiles(projectPath, 250)
  const staleCommandPattern = /\/p:\s*[a-z][a-z0-9-]*/i
  const staleHits: string[] = []
  await Promise.all(
    files.map(async (file) => {
      const text = await fs.readFile(path.join(projectPath, file), 'utf-8').catch(() => '')
      if (staleCommandPattern.test(text)) staleHits.push(file)
    })
  )
  return {
    status: staleHits.length === 0 ? 'pass' : 'warn',
    score: staleHits.length === 0 ? 100 : Math.max(20, 100 - staleHits.length * 10),
    metrics: { scannedFiles: files.length, staleHits: staleHits.length },
    actionables:
      staleHits.length === 0
        ? [
            {
              severity: 'info',
              title: 'No stale `/p:` command guidance found',
              recommendation: 'Keep this scan in evals to prevent user-facing command drift.',
            },
          ]
        : [
            {
              severity: 'warning',
              title: `Found ${staleHits.length} stale command guidance file(s)`,
              recommendation: 'Replace stale `/p:` examples with `p. <verb>` or `prjct <verb>`.',
              files: staleHits.slice(0, 10),
            },
          ],
  }
}

async function evalQualityCommandReadiness(
  projectPath: string
): Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>> {
  const pkgPath = path.join(projectPath, 'package.json')
  let scripts: Record<string, unknown> = {}
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as {
      scripts?: Record<string, unknown>
    }
    scripts = pkg.scripts ?? {}
  } catch {
    // Non-JS projects can still use evals, but this scenario becomes advisory.
  }
  const hasTest = typeof scripts.test === 'string'
  const hasCheck = typeof scripts.check === 'string' || typeof scripts.lint === 'string'
  const score = (hasTest ? 50 : 0) + (hasCheck ? 50 : 0)
  return {
    status: score >= 100 ? 'pass' : 'warn',
    score,
    metrics: { hasTest, hasCheck },
    actionables:
      score >= 100
        ? [
            {
              severity: 'info',
              title: 'Quality commands are discoverable',
              recommendation:
                'Use these commands as eval scenario gates before publishing results.',
            },
          ]
        : [
            {
              severity: 'warning',
              title: 'Quality commands are incomplete',
              recommendation:
                'Expose `test` and `check`/`lint` scripts so eval reports can tie regressions to real verification.',
              files: ['package.json'],
            },
          ],
  }
}

async function evalGithubPublishReadiness(
  git: GitInfo
): Promise<Omit<EvalScenario, 'id' | 'name' | 'durationMs'>> {
  const gh = await commandExists('gh')
  const score = (git.ownerRepo ? 50 : 0) + (gh ? 50 : 0)
  return {
    status: score >= 100 ? 'pass' : 'warn',
    score,
    metrics: { githubRemote: Boolean(git.ownerRepo), gh },
    actionables:
      score >= 100
        ? [
            {
              severity: 'info',
              title: 'GitHub publishing is available',
              recommendation:
                'Run `prjct eval publish --target github` to store this run on the eval-results branch.',
              command: 'prjct eval publish --target github',
            },
          ]
        : [
            {
              severity: 'warning',
              title: 'GitHub publishing is not fully configured',
              recommendation:
                'Configure a GitHub remote and authenticate `gh` before publishing eval history.',
            },
          ],
  }
}

async function saveEvalRun(run: EvalRun): Promise<EvalRun> {
  const projectDir = evalProjectDir({ repo: run.project.repo })
  const runsDir = path.join(projectDir, 'runs')
  await fs.mkdir(runsDir, { recursive: true })
  const jsonPath = path.join(runsDir, `${run.runId}.json`)
  const reportPath = path.join(runsDir, `${run.runId}.md`)
  const withArtifacts: EvalRun = {
    ...run,
    artifacts: { jsonPath, reportPath },
  }
  EvalRunSchema.parse(withArtifacts)
  await fs.writeFile(jsonPath, `${JSON.stringify(withArtifacts, null, 2)}\n`, 'utf-8')
  await fs.writeFile(reportPath, formatEvalRunMarkdown(withArtifacts), 'utf-8')
  await fs.writeFile(
    path.join(projectDir, 'latest.json'),
    `${JSON.stringify(withArtifacts, null, 2)}\n`,
    'utf-8'
  )
  return withArtifacts
}

async function saveEvalComparison(
  projectPath: string,
  comparison: EvalComparison
): Promise<EvalComparison> {
  const projectDir = evalProjectDir(await detectGit(projectPath))
  const comparisonsDir = path.join(projectDir, 'comparisons')
  await fs.mkdir(comparisonsDir, { recursive: true })
  const jsonPath = path.join(comparisonsDir, `${comparison.comparisonId}.json`)
  const reportPath = path.join(comparisonsDir, `${comparison.comparisonId}.md`)
  const withArtifacts: EvalComparison = {
    ...comparison,
    artifacts: { jsonPath, reportPath },
  }
  EvalComparisonSchema.parse(withArtifacts)
  await fs.writeFile(jsonPath, `${JSON.stringify(withArtifacts, null, 2)}\n`, 'utf-8')
  await fs.writeFile(reportPath, formatEvalComparisonMarkdown(withArtifacts), 'utf-8')
  await fs.writeFile(
    path.join(projectDir, 'latest-comparison.json'),
    `${JSON.stringify(withArtifacts, null, 2)}\n`,
    'utf-8'
  )
  return withArtifacts
}

function evalProjectDir(git: Pick<GitInfo, 'repo'>): string {
  const slug = git.repo.replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
  return path.join(resolveCliHome(), 'evals', slug)
}

async function readRunFile(filePath: string): Promise<EvalRun | null> {
  try {
    return EvalRunSchema.parse(JSON.parse(await fs.readFile(filePath, 'utf-8')))
  } catch {
    return null
  }
}

async function readComparisonFile(filePath: string): Promise<EvalComparison | null> {
  try {
    return EvalComparisonSchema.parse(JSON.parse(await fs.readFile(filePath, 'utf-8')))
  } catch {
    return null
  }
}

async function readRequiredRunFile(filePath: string): Promise<EvalRun> {
  const run = await readRunFile(filePath)
  if (!run) throw new Error(`Invalid or missing eval run file: ${filePath}`)
  return run
}

async function loadLatestRequired(projectPath: string): Promise<EvalRun> {
  const latest = await loadLatestEvalRun(projectPath)
  if (!latest) throw new Error('No eval run found. Run `prjct eval run` first.')
  return latest
}

async function detectGit(projectPath: string): Promise<GitInfo> {
  const [branch, commit, remote, status] = await Promise.all([
    git(projectPath, ['branch', '--show-current']),
    git(projectPath, ['rev-parse', 'HEAD']),
    git(projectPath, ['config', '--get', 'remote.origin.url']),
    git(projectPath, ['status', '--porcelain']),
  ])
  const ownerRepo = parseGitHubOwnerRepo(remote)
  return {
    repo: ownerRepo ?? hashedRepo(projectPath),
    ownerRepo,
    branch: branch || undefined,
    commit: commit || undefined,
    dirty: status.trim().length > 0,
  }
}

async function git(projectPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: projectPath })
    return String(stdout).trim()
  } catch {
    return ''
  }
}

function parseGitHubOwnerRepo(remote: string): string | undefined {
  const trimmed = remote.trim()
  const https = trimmed.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/)
  if (!https) return undefined
  return `${https[1]}/${https[2]}`
}

function hashedRepo(projectPath: string): string {
  return `local-${crypto.createHash('sha256').update(path.resolve(projectPath)).digest('hex').slice(0, 12)}`
}

function runId(createdAt: string): string {
  const stamp = createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)
  return `eval_${stamp}_${crypto.randomBytes(4).toString('hex')}`
}

function comparisonId(
  createdAt: string,
  baselineVersion: string | undefined,
  candidateVersion: string | undefined
): string {
  const stamp = createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)
  const baseline = slugPart(baselineVersion ?? 'missing-baseline')
  const candidate = slugPart(candidateVersion ?? 'missing-candidate')
  return `comparison_${stamp}_${baseline}_to_${candidate}`
}

function slugPart(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown'
  )
}

function detectSource(): 'local' | 'ci' | 'agent' {
  if (process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true') return 'ci'
  if (process.env.CODEX_SANDBOX || process.env.CLAUDECODE) return 'agent'
  return 'local'
}

async function detectRunnerUser(projectPath: string): Promise<string | undefined> {
  const gh = await execFileMaybe('gh', ['api', 'user', '--jq', '.login'], projectPath)
  if (gh) return `github:${gh}`
  const email = await git(projectPath, ['config', 'user.email'])
  return email ? `git:${email}` : undefined
}

async function detectBunVersion(): Promise<string | undefined> {
  return execFileMaybe('bun', ['--version'], process.cwd())
}

async function execFileMaybe(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd })
    const value = String(stdout).trim()
    return value || undefined
  } catch {
    return undefined
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  return Boolean(await execFileMaybe('which', [cmd], process.cwd()))
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectTextFiles(projectPath: string, maxFiles: number): Promise<string[]> {
  const result: string[] = []
  const skip = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.prjct',
    '__tests__',
    '__fixtures__',
    'fixtures',
  ])

  async function walk(dir: string): Promise<void> {
    if (result.length >= maxFiles) return
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (result.length >= maxFiles) break
      if (skip.has(entry.name)) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else if (
        entry.isFile() &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.') &&
        /\.(md|mdc|txt|toml|json|ya?ml|sh|ts|tsx|js|jsx)$/.test(entry.name)
      ) {
        result.push(path.relative(projectPath, fullPath))
      }
    }
  }

  await walk(projectPath)
  return result
}

function regressionRecommendation(id: string): string {
  if (id.includes('sync'))
    return 'Inspect sync incrementality and generated context freshness before shipping.'
  if (id.includes('github')) return 'Check GitHub remote/authentication and eval publisher setup.'
  if (id.includes('command'))
    return 'Audit user-facing command copy and generated templates for stale instructions.'
  return 'Open the latest eval report, inspect scenario metrics, and add a focused regression test.'
}

async function publishFiles(
  ownerRepo: string,
  target: string,
  dryRun: boolean,
  files: EvalPublishFile[],
  artifact: Pick<EvalPublishResult, 'artifactType' | 'artifactId' | 'runId' | 'comparisonId'>
): Promise<EvalPublishResult> {
  if (!dryRun) {
    await ensureEvalResultsBranch(ownerRepo)
    for (const file of files) {
      await putGitHubFile(ownerRepo, file.path, file.content, file.action)
    }
  }

  return {
    target,
    dryRun,
    ...artifact,
    repo: ownerRepo,
    branch: 'eval-results',
    files: files.map(({ path: filePath, action }) => ({ path: filePath, action })),
    url: `https://github.com/${ownerRepo}/tree/eval-results/eval-results`,
  }
}

async function ensureEvalResultsBranch(ownerRepo: string): Promise<void> {
  const existsRef = await ghApi(ownerRepo, ['repos/:owner/:repo/git/ref/heads/eval-results'])
  if (existsRef.ok) return

  const repo = await ghApi(ownerRepo, ['repos/:owner/:repo', '--jq', '.default_branch'])
  const defaultBranch = repo.ok ? repo.stdout.trim() || 'main' : 'main'
  const defaultRef = await ghApi(ownerRepo, [`repos/:owner/:repo/git/ref/heads/${defaultBranch}`])
  if (!defaultRef.ok)
    throw new Error(`Cannot resolve ${defaultBranch} branch ref for eval-results branch.`)
  const parsed = JSON.parse(defaultRef.stdout) as { object?: { sha?: string } }
  const sha = parsed.object?.sha
  if (!sha) throw new Error(`Cannot resolve ${defaultBranch} branch sha for eval-results branch.`)
  await ghApi(ownerRepo, [
    'repos/:owner/:repo/git/refs',
    '-X',
    'POST',
    '-f',
    'ref=refs/heads/eval-results',
    '-f',
    `sha=${sha}`,
  ])
}

async function putGitHubFile(
  ownerRepo: string,
  filePath: string,
  content: string,
  action: 'create' | 'update'
): Promise<void> {
  const existing = await ghApi(ownerRepo, [
    `repos/:owner/:repo/contents/${filePath}`,
    '-X',
    'GET',
    '-f',
    'ref=eval-results',
  ])
  let sha: string | undefined
  if (existing.ok) {
    const parsed = JSON.parse(existing.stdout) as { sha?: string }
    sha = parsed.sha
  } else if (action === 'update') {
    // Updating a summary file that does not exist yet is a create.
    sha = undefined
  }

  const args = [
    `repos/:owner/:repo/contents/${filePath}`,
    '-X',
    'PUT',
    '-f',
    `message=chore(eval): publish ${path.basename(filePath)}`,
    '-f',
    `branch=eval-results`,
    '-f',
    `content=${Buffer.from(content, 'utf-8').toString('base64')}`,
  ]
  if (sha) args.push('-f', `sha=${sha}`)
  const result = await ghApi(ownerRepo, args)
  if (!result.ok) throw new Error(result.stderr || `Failed to publish ${filePath}`)
}

async function ghApi(
  ownerRepo: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const [owner, repo] = ownerRepo.split('/')
  const expanded = args.map((arg) => arg.replace(':owner', owner).replace(':repo', repo))
  try {
    const { stdout, stderr } = await execFileAsync('gh', ['api', ...expanded])
    return { ok: true, stdout: String(stdout), stderr: String(stderr) }
  } catch (error) {
    const maybe = error as { stdout?: unknown; stderr?: unknown }
    return {
      ok: false,
      stdout: String(maybe.stdout ?? ''),
      stderr: String(maybe.stderr ?? getErrorMessage(error)),
    }
  }
}
