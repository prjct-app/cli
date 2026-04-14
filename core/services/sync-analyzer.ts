/**
 * Sync Analyzer — Analysis/stats functions extracted from SyncService.
 *
 * Standalone exported functions for:
 * - Git analysis
 * - Project stats gathering
 * - Command detection
 * - Source citation building
 * - Stack detection
 *
 * @version 1.0.0
 */

import path from 'node:path'
import { getErrorMessage } from '../errors'
import type { ContextSources, SourceInfo } from '../types/citations'
import type { GitData, ProjectCommands, ProjectStats } from '../types/project-sync'
import type { StackDetection } from '../types/stack'
import { defaultSources } from '../utils/citations'
import { execAsync } from '../utils/exec'
import { fileExists, readJson } from '../utils/file-helper'
import log from '../utils/logger'
import { StackDetector } from './stack-detector'

// ============================================================================
// GIT ANALYSIS
// ============================================================================

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

  try {
    // Branch
    const { stdout: branch } = await execAsync('git branch --show-current', {
      cwd: projectPath,
    })
    data.branch = branch.trim() || 'main'

    // Total commits
    const { stdout: commits } = await execAsync('git rev-list --count HEAD', {
      cwd: projectPath,
    })
    data.commits = parseInt(commits.trim(), 10) || 0

    // Contributors
    const { stdout: contributors } = await execAsync('git shortlog -sn --all | wc -l', {
      cwd: projectPath,
    })
    data.contributors = parseInt(contributors.trim(), 10) || 0

    // Status
    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd: projectPath,
    })
    const lines = status.trim().split('\n').filter(Boolean)
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

    // Recent commits
    const { stdout: gitLog } = await execAsync(
      'git log --oneline -20 --pretty=format:"%h|%s|%ad" --date=short',
      { cwd: projectPath }
    )
    data.recentCommits = gitLog
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date] = line.split('|')
        return { hash, message, date }
      })

    // Weekly commits
    const { stdout: weekly } = await execAsync('git log --oneline --since="1 week ago" | wc -l', {
      cwd: projectPath,
    })
    data.weeklyCommits = parseInt(weekly.trim(), 10) || 0
  } catch (error) {
    log.debug('Git analysis failed (not a git repo?)', { error: getErrorMessage(error) })
  }

  return data
}

// ============================================================================
// PROJECT STATS
// ============================================================================

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

  // Count files
  try {
    const { stdout } = await execAsync(
      'find . -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \\) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l',
      { cwd: projectPath }
    )
    stats.fileCount = parseInt(stdout.trim(), 10) || 0
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

// ============================================================================
// COMMAND DETECTION
// ============================================================================

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

// ============================================================================
// SOURCE CITATIONS
// ============================================================================

export function buildSources(stats: ProjectStats, commands: ProjectCommands): ContextSources {
  const sources = defaultSources()

  // Determine ecosystem source file
  const ecosystemFiles: Record<string, string> = {
    JavaScript: 'package.json',
    Rust: 'Cargo.toml',
    Go: 'go.mod',
    Python: 'pyproject.toml',
  }
  const ecosystemFile = ecosystemFiles[stats.ecosystem] || 'filesystem'
  const detected = (file: string): SourceInfo => ({ file, type: 'detected' })
  const inferred = (file: string): SourceInfo => ({ file, type: 'inferred' })

  sources.ecosystem = detected(ecosystemFile)
  sources.name = detected(ecosystemFile)
  sources.version = detected(ecosystemFile)
  sources.languages = detected(ecosystemFile)
  sources.frameworks = detected(ecosystemFile)

  // Commands source is the lock file or ecosystem file
  if (commands.install.startsWith('bun')) {
    sources.commands = detected('bun.lockb')
  } else if (commands.install.startsWith('pnpm')) {
    sources.commands = detected('pnpm-lock.yaml')
  } else if (commands.install === 'yarn') {
    sources.commands = detected('yarn.lock')
  } else if (commands.install.startsWith('cargo')) {
    sources.commands = detected('Cargo.toml')
  } else if (commands.install.startsWith('go')) {
    sources.commands = detected('go.mod')
  } else {
    sources.commands = detected('package.json')
  }

  // Project type is inferred from file count + framework count
  sources.projectType = inferred('file count + frameworks')

  // Git is always from git
  sources.git = detected('git')

  return sources
}

// ============================================================================
// STACK DETECTION
// ============================================================================

export async function detectStack(projectPath: string): Promise<StackDetection> {
  const detector = new StackDetector(projectPath)
  return detector.detect()
}
