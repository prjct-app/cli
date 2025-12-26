import path from 'path'

import * as fileHelper from './file-helper'

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'
type DetectedStack = 'js' | 'python' | 'go' | 'rust' | 'dotnet' | 'java' | 'unknown'

interface DetectedCommand {
  /**
   * Shell command to execute from the repo root.
   */
  command: string
  /**
   * Human-readable tool name for messaging/logging.
   */
  tool: string
}

export interface DetectedProjectCommands {
  stack: DetectedStack
  packageManager?: PackageManager
  lint?: DetectedCommand
  typecheck?: DetectedCommand
  test?: DetectedCommand
}

interface PackageJson {
  scripts?: Record<string, string>
  packageManager?: string
}

/**
 * Detect the most likely JS package manager for a project.
 *
 * Reason: installed users may not have Bun, and many projects use pnpm/yarn.
 */
async function detectPackageManager(projectPath: string, pkg: PackageJson | null): Promise<PackageManager> {
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

/**
 * Detect the appropriate lint/typecheck/test commands for a given project.
 *
 * - JS/TS projects: uses the project package manager + scripts when present
 * - Python: prefers pytest when config is present
 * - Go/Rust/.NET/Java: uses conventional defaults
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

    return result
  }

  // Python
  if (await fileHelper.fileExists(path.join(projectPath, 'pytest.ini'))) {
    return { stack: 'python', test: { tool: 'pytest', command: 'pytest' } }
  }

  const pyproject = await fileHelper.readFile(path.join(projectPath, 'pyproject.toml'), '')
  if (pyproject.includes('[tool.pytest') || pyproject.includes('pytest')) {
    return { stack: 'python', test: { tool: 'pytest', command: 'pytest' } }
  }

  // Rust
  if (await fileHelper.fileExists(path.join(projectPath, 'Cargo.toml'))) {
    return { stack: 'rust', test: { tool: 'cargo', command: 'cargo test' } }
  }

  // Go
  if (await fileHelper.fileExists(path.join(projectPath, 'go.mod'))) {
    return { stack: 'go', test: { tool: 'go', command: 'go test ./...' } }
  }

  // .NET
  const files = await fileHelper.listFiles(projectPath)
  if (files.some((f) => f.endsWith('.sln') || f.endsWith('.csproj') || f.endsWith('.fsproj'))) {
    return { stack: 'dotnet', test: { tool: 'dotnet', command: 'dotnet test' } }
  }

  // Java
  if (await fileHelper.fileExists(path.join(projectPath, 'pom.xml'))) {
    return { stack: 'java', test: { tool: 'maven', command: 'mvn test' } }
  }
  if (
    (await fileHelper.fileExists(path.join(projectPath, 'gradlew'))) &&
    ((await fileHelper.fileExists(path.join(projectPath, 'build.gradle'))) ||
      (await fileHelper.fileExists(path.join(projectPath, 'build.gradle.kts'))))
  ) {
    return { stack: 'java', test: { tool: 'gradle', command: './gradlew test' } }
  }

  return { stack: 'unknown' }
}


