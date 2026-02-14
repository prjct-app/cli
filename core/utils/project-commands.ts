import path from 'node:path'
import type { DetectedProjectCommands } from '../types'
import * as fileHelper from './file-helper'

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

interface PackageJson {
  scripts?: Record<string, string>
  packageManager?: string
}

/**
 * Detect the most likely JS package manager for a project.
 *
 * Reason: installed users may not have Bun, and many projects use pnpm/yarn.
 */
async function detectPackageManager(
  projectPath: string,
  pkg: PackageJson | null
): Promise<PackageManager> {
  const declared = pkg?.packageManager?.trim().toLowerCase()
  if (declared?.startsWith('pnpm@')) return 'pnpm'
  if (declared?.startsWith('yarn@')) return 'yarn'
  if (declared?.startsWith('bun@')) return 'bun'
  if (declared?.startsWith('npm@')) return 'npm'

  // Lockfile heuristics
  if (await fileHelper.fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await fileHelper.fileExists(path.join(projectPath, 'yarn.lock'))) return 'yarn'
  if (await fileHelper.fileExists(path.join(projectPath, 'bun.lockb'))) return 'bun'
  if (await fileHelper.fileExists(path.join(projectPath, 'bun.lock'))) return 'bun'
  if (await fileHelper.fileExists(path.join(projectPath, 'package-lock.json'))) return 'npm'

  return 'npm'
}

function pmRun(pm: PackageManager, scriptName: string): string {
  if (pm === 'yarn') return `yarn ${scriptName}`
  if (pm === 'pnpm') return `pnpm run ${scriptName}`
  if (pm === 'bun') return `bun run ${scriptName}`
  return `npm run ${scriptName}`
}

function pmTest(pm: PackageManager): string {
  if (pm === 'yarn') return 'yarn test'
  if (pm === 'pnpm') return 'pnpm test'
  if (pm === 'bun') return 'bun test'
  return 'npm test'
}

/** Version source files, ordered by priority per stack convention. */
const VERSION_FILES = [
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'VERSION',
  'version.txt',
] as const

// .csproj files are detected via listFiles (glob pattern)
const CSPROJ_EXT = '.csproj'

/** Changelog files, ordered by convention popularity. */
const CHANGELOG_FILES = ['CHANGELOG.md', 'HISTORY.md', 'NEWS.md', 'CHANGES.md'] as const

/**
 * Find the first existing version source file in the project.
 */
async function detectVersionFile(
  projectPath: string,
  files?: string[]
): Promise<string | undefined> {
  for (const name of VERSION_FILES) {
    if (await fileHelper.fileExists(path.join(projectPath, name))) return name
  }
  // Check for .csproj files
  const listing = files ?? (await fileHelper.listFiles(projectPath))
  const csproj = listing.find((f) => f.endsWith(CSPROJ_EXT))
  if (csproj) return csproj
  return undefined
}

/**
 * Find the first existing changelog file in the project.
 */
async function detectChangelogFile(projectPath: string): Promise<string | undefined> {
  for (const name of CHANGELOG_FILES) {
    if (await fileHelper.fileExists(path.join(projectPath, name))) return name
  }
  return undefined
}

/**
 * Detect the appropriate lint/typecheck/test commands for a given project.
 *
 * - JS/TS projects: uses the project package manager + scripts when present
 * - Python: prefers pytest when config is present
 * - Go/Rust/.NET/Java: uses conventional defaults
 *
 * Also detects version source files and changelog files for workflow seeding.
 *
 * @param {string} projectPath - Repository root.
 * @returns {Promise<DetectedProjectCommands>} detected commands (missing when not applicable).
 */
export async function detectProjectCommands(projectPath: string): Promise<DetectedProjectCommands> {
  const pkgPath = path.join(projectPath, 'package.json')
  const pkg = await fileHelper.readJson<PackageJson | null>(pkgPath, null)

  // JS/TS (prefer explicit scripts)
  if (pkg) {
    const pm = await detectPackageManager(projectPath, pkg)
    const scripts = pkg.scripts || {}

    const result: DetectedProjectCommands = { stack: 'js', packageManager: pm }

    if (scripts.lint) {
      result.lint = { tool: pm, command: pmRun(pm, 'lint') }
    }

    if (scripts.typecheck) {
      result.typecheck = { tool: pm, command: pmRun(pm, 'typecheck') }
    }

    if (scripts.test) {
      result.test = { tool: pm, command: pmTest(pm) }
    }

    result.versionFile = await detectVersionFile(projectPath)
    result.changelogFile = await detectChangelogFile(projectPath)

    return result
  }

  // Python
  if (await fileHelper.fileExists(path.join(projectPath, 'pytest.ini'))) {
    const versionFile = await detectVersionFile(projectPath)
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'python',
      test: { tool: 'pytest', command: 'pytest' },
      versionFile,
      changelogFile,
    }
  }

  const pyproject = await fileHelper.readFile(path.join(projectPath, 'pyproject.toml'), '')
  if (pyproject.includes('[tool.pytest') || pyproject.includes('pytest')) {
    const versionFile = await detectVersionFile(projectPath)
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'python',
      test: { tool: 'pytest', command: 'pytest' },
      versionFile,
      changelogFile,
    }
  }

  // Rust
  if (await fileHelper.fileExists(path.join(projectPath, 'Cargo.toml'))) {
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'rust',
      test: { tool: 'cargo', command: 'cargo test' },
      versionFile: 'Cargo.toml',
      changelogFile,
    }
  }

  // Go
  if (await fileHelper.fileExists(path.join(projectPath, 'go.mod'))) {
    const versionFile = await detectVersionFile(projectPath)
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'go',
      test: { tool: 'go', command: 'go test ./...' },
      versionFile,
      changelogFile,
    }
  }

  // .NET
  const files = await fileHelper.listFiles(projectPath)
  if (files.some((f) => f.endsWith('.sln') || f.endsWith('.csproj') || f.endsWith('.fsproj'))) {
    const versionFile = await detectVersionFile(projectPath, files)
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'dotnet',
      test: { tool: 'dotnet', command: 'dotnet test' },
      versionFile,
      changelogFile,
    }
  }

  // Java
  if (await fileHelper.fileExists(path.join(projectPath, 'pom.xml'))) {
    const changelogFile = await detectChangelogFile(projectPath)
    return {
      stack: 'java',
      test: { tool: 'maven', command: 'mvn test' },
      versionFile: 'pom.xml',
      changelogFile,
    }
  }
  if (
    (await fileHelper.fileExists(path.join(projectPath, 'gradlew'))) &&
    ((await fileHelper.fileExists(path.join(projectPath, 'build.gradle'))) ||
      (await fileHelper.fileExists(path.join(projectPath, 'build.gradle.kts'))))
  ) {
    const changelogFile = await detectChangelogFile(projectPath)
    return { stack: 'java', test: { tool: 'gradle', command: './gradlew test' }, changelogFile }
  }

  // Unknown stack - still detect version/changelog files
  const versionFile = await detectVersionFile(projectPath)
  const changelogFile = await detectChangelogFile(projectPath)
  return { stack: 'unknown', versionFile, changelogFile }
}
