/** Sync Analyzer — git analysis, project stats, command + stack detection for SyncService. */

import path from 'node:path'
import { getErrorMessage } from '../errors'
import type { GitData, ProjectCommands, ProjectStats } from '../types/project-sync'
import type { StackDetection } from '../types/stack'
import { execAsync } from '../utils/exec'
import { fileExists, readJson, walkDir } from '../utils/file-helper'
import log from '../utils/logger'
import { StackDetector } from './stack-detector'

// GIT ANALYSIS

export async function analyzeGit(projectPath: string): Promise<GitData> {
  const data: GitData = {
    branch: 'main',
    commits: 0,
    contributors: 0,
    hasChanges: false,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
    recentCommits: [],
    weeklyCommits: 0,
  }

  // Six independent git invocations — run in parallel. Sequential awaits
  // here previously cost ~6× spawn latency (~500ms on warm caches).
  const opts = { cwd: projectPath }
  const safe = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null)
  const [branchR, commitsR, shortlogR, statusR, gitLogR, weeklyR] = await Promise.all([
    safe(execAsync('git branch --show-current', opts)),
    safe(execAsync('git rev-list --count HEAD', opts)),
    safe(execAsync('git shortlog -sn --all', opts)),
    safe(execAsync('git status --porcelain', opts)),
    safe(execAsync('git log --oneline -20 --pretty=format:"%h|%s|%ad" --date=short', opts)),
    safe(execAsync('git log --oneline --since="1 week ago"', opts)),
  ])

  if (branchR) data.branch = branchR.stdout.trim() || 'main'
  if (commitsR) data.commits = parseInt(commitsR.stdout.trim(), 10) || 0

  // shortlog → count non-empty lines (replaces shell pipe to wc -l)
  if (shortlogR) {
    data.contributors = shortlogR.stdout.split('\n').filter((l) => l.trim()).length
  }

  if (statusR) {
    const lines = statusR.stdout.trim().split('\n').filter(Boolean)
    data.hasChanges = lines.length > 0
    for (const line of lines) {
      const code = line.substring(0, 2)
      const file = line.substring(3)
      if (code.startsWith('A') || code.startsWith('M ')) {
        data.stagedFiles.push(file)
      } else if (code.includes('M')) {
        data.modifiedFiles.push(file)
      } else if (code.startsWith('??')) {
        data.untrackedFiles.push(file)
      }
    }
  }

  if (gitLogR) {
    data.recentCommits = gitLogR.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date] = line.split('|')
        return { hash, message, date }
      })
  }

  // weekly log → count non-empty lines (replaces shell pipe to wc -l)
  if (weeklyR) {
    data.weeklyCommits = weeklyR.stdout.split('\n').filter((l) => l.trim()).length
  }

  if (!branchR && !commitsR && !statusR) {
    log.debug('Git analysis failed (not a git repo?)')
  }

  return data
}

// PROJECT STATS

async function fileExistsInProject(projectPath: string, filename: string): Promise<boolean> {
  const exists = await fileExists(path.join(projectPath, filename))
  if (!exists) {
    log.debug('File not found', { filename })
  }
  return exists
}

export async function gatherStats(projectPath: string): Promise<ProjectStats> {
  const stats: ProjectStats = {
    fileCount: 0,
    version: '0.0.0',
    name: path.basename(projectPath),
    ecosystem: 'unknown',
    projectType: 'simple',
    languages: [],
    frameworks: [],
  }

  // Count source files using native walker (~6ms vs ~230ms for shell find).
  // walkDir already skips node_modules/.git/dist via SKIP_DIRS.
  try {
    const sourceExt = ['.js', '.ts', '.tsx', '.py', '.go', '.rs']
    const files = await walkDir(projectPath, { skipDotfiles: true })
    stats.fileCount = files.filter((f) => sourceExt.some((e) => f.endsWith(e))).length
  } catch (error) {
    log.debug('File count failed', { path: projectPath, error: getErrorMessage(error) })
    stats.fileCount = 0
  }

  // Read package.json
  try {
    const pkgPath = path.join(projectPath, 'package.json')
    const pkg = await readJson<Record<string, unknown>>(pkgPath)
    if (!pkg) throw new Error('No package.json found')
    stats.version = (pkg.version as string) || '0.0.0'
    stats.name = (pkg.name as string) || stats.name
    stats.ecosystem = 'JavaScript'

    // Detect language (factual: tsconfig.json exists or typescript in devDeps)
    // Frameworks are NOT detected here — the LLM analysis provides accurate stack info
    if (
      (pkg.devDependencies as Record<string, unknown>)?.typescript ||
      (await fileExistsInProject(projectPath, 'tsconfig.json'))
    ) {
      stats.languages.push('TypeScript')
    } else {
      stats.languages.push('JavaScript')
    }
  } catch (error) {
    log.debug('No package.json found', { path: projectPath, error: getErrorMessage(error) })
  }

  // Detect primary ecosystem from manifest files (factual, no framework inference)
  if (await fileExistsInProject(projectPath, 'Cargo.toml')) {
    stats.ecosystem = 'Rust'
    stats.languages.push('Rust')
  } else if (await fileExistsInProject(projectPath, 'go.mod')) {
    stats.ecosystem = 'Go'
    stats.languages.push('Go')
  } else if (
    (await fileExistsInProject(projectPath, 'requirements.txt')) ||
    (await fileExistsInProject(projectPath, 'pyproject.toml'))
  ) {
    stats.ecosystem = 'Python'
    stats.languages.push('Python')
  }

  // Determine project type
  if (stats.fileCount > 300 || stats.frameworks.length >= 3) {
    stats.projectType = 'enterprise'
  } else if (stats.fileCount > 50 || stats.frameworks.length >= 2) {
    stats.projectType = 'complex'
  }

  return stats
}

// COMMAND DETECTION

export async function detectCommands(projectPath: string): Promise<ProjectCommands> {
  const commands: ProjectCommands = {
    install: 'npm install',
    run: 'npm run',
    test: 'npm test',
    build: 'npm run build',
    dev: 'npm run dev',
    lint: 'npm run lint',
    format: 'npm run format',
  }

  // Detect package manager
  if (
    (await fileExistsInProject(projectPath, 'bun.lockb')) ||
    (await fileExistsInProject(projectPath, 'bun.lock'))
  ) {
    commands.install = 'bun install'
    commands.run = 'bun run'
    commands.test = 'bun test'
    commands.build = 'bun run build'
    commands.dev = 'bun run dev'
    commands.lint = 'bun run lint'
    commands.format = 'bun run format'
  } else if (await fileExistsInProject(projectPath, 'pnpm-lock.yaml')) {
    commands.install = 'pnpm install'
    commands.run = 'pnpm run'
    commands.test = 'pnpm test'
    commands.build = 'pnpm run build'
    commands.dev = 'pnpm run dev'
    commands.lint = 'pnpm run lint'
    commands.format = 'pnpm run format'
  } else if (await fileExistsInProject(projectPath, 'yarn.lock')) {
    commands.install = 'yarn'
    commands.run = 'yarn'
    commands.test = 'yarn test'
    commands.build = 'yarn build'
    commands.dev = 'yarn dev'
    commands.lint = 'yarn lint'
    commands.format = 'yarn format'
  }

  // Non-JS ecosystems
  if (await fileExistsInProject(projectPath, 'Cargo.toml')) {
    commands.install = 'cargo build'
    commands.run = 'cargo run'
    commands.test = 'cargo test'
    commands.build = 'cargo build --release'
    commands.dev = 'cargo run'
    commands.lint = 'cargo clippy'
    commands.format = 'cargo fmt'
  }

  if (await fileExistsInProject(projectPath, 'go.mod')) {
    commands.install = 'go mod download'
    commands.run = 'go run .'
    commands.test = 'go test ./...'
    commands.build = 'go build'
    commands.dev = 'go run .'
    commands.lint = 'golangci-lint run'
    commands.format = 'go fmt ./...'
  }

  return commands
}

// STACK DETECTION

export async function detectStack(projectPath: string): Promise<StackDetection> {
  const detector = new StackDetector(projectPath)
  return detector.detect()
}
