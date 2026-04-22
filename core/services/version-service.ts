/**
 * VersionService - Stack-aware version detection and bumping
 *
 * Detects version source files in priority order:
 * 1. package.json (Node.js)
 * 2. Cargo.toml (Rust)
 * 3. pyproject.toml (Python)
 * 4. *.csproj (C#/.NET)
 * 5. VERSION file
 * 6. version.txt file
 * 7. Git tags (v*.*.*)
 * 8. Fallback: create VERSION file with 0.1.0
 *
 * Uses file-based detection (no stack assumptions).
 * No external parsing libraries - uses regex for TOML/XML.
 */

import path from 'node:path'
import type { VersionInfo } from '../types/services.js'
import { execAsync, execFileAsync } from '../utils/exec'
import * as fileHelper from '../utils/file-helper'

// =============================================================================
// VersionService
// =============================================================================

export class VersionService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Detect the current version and compute the next patch bump.
   */
  async detect(): Promise<VersionInfo> {
    // Try each source in priority order
    const sources: Array<() => Promise<VersionInfo | null>> = [
      () => this.fromPackageJson(),
      () => this.fromCargoToml(),
      () => this.fromPyprojectToml(),
      () => this.fromCsproj(),
      () => this.fromVersionFile('VERSION'),
      () => this.fromVersionFile('version.txt'),
      () => this.fromGitTag(),
    ]

    for (const source of sources) {
      const result = await source()
      if (result) return result
    }

    // Fallback: create VERSION file with 0.1.0
    return this.createFallbackVersion()
  }

  /**
   * Bump the version in the detected source file.
   * Returns the new version string.
   */
  async bump(): Promise<string> {
    const info = await this.detect()
    await this.writeVersion(info)
    return info.next
  }

  // ===========================================================================
  // Source Detectors
  // ===========================================================================

  private async fromPackageJson(): Promise<VersionInfo | null> {
    const filePath = path.join(this.projectPath, 'package.json')
    const pkg = await fileHelper.readJson<{ version?: string }>(filePath, null)
    if (!pkg?.version) return null

    return {
      current: pkg.version,
      next: bumpPatch(pkg.version),
      file: filePath,
      format: 'json',
    }
  }

  private async fromCargoToml(): Promise<VersionInfo | null> {
    const filePath = path.join(this.projectPath, 'Cargo.toml')
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return null

    const version = parseTomlVersion(content)
    if (!version) return null

    return {
      current: version,
      next: bumpPatch(version),
      file: filePath,
      format: 'toml',
    }
  }

  private async fromPyprojectToml(): Promise<VersionInfo | null> {
    const filePath = path.join(this.projectPath, 'pyproject.toml')
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return null

    const version = parsePyprojectVersion(content)
    if (!version) return null

    return {
      current: version,
      next: bumpPatch(version),
      file: filePath,
      format: 'toml',
    }
  }

  private async fromCsproj(): Promise<VersionInfo | null> {
    const files = await fileHelper.listFiles(this.projectPath, { extension: '.csproj' })
    if (files.length === 0) return null

    const filePath = path.join(this.projectPath, files[0])
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return null

    const version = parseCsprojVersion(content)
    if (!version) return null

    return {
      current: version,
      next: bumpPatch(version),
      file: filePath,
      format: 'xml',
    }
  }

  private async fromVersionFile(filename: string): Promise<VersionInfo | null> {
    const filePath = path.join(this.projectPath, filename)
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return null

    const version = content.trim()
    if (!isSemver(version)) return null

    return {
      current: version,
      next: bumpPatch(version),
      file: filePath,
      format: 'plaintext',
    }
  }

  private async fromGitTag(): Promise<VersionInfo | null> {
    try {
      const { stdout } = await execAsync('git tag --sort=-v:refname', {
        cwd: this.projectPath,
      })

      const tags = stdout.trim().split('\n')
      for (const tag of tags) {
        const cleaned = tag.trim().replace(/^v/, '')
        if (isSemver(cleaned)) {
          return {
            current: cleaned,
            next: bumpPatch(cleaned),
            file: null,
            format: 'git-tag',
          }
        }
      }
    } catch {
      // Not a git repo or git not available
    }

    return null
  }

  // ===========================================================================
  // Fallback
  // ===========================================================================

  private async createFallbackVersion(): Promise<VersionInfo> {
    const filePath = path.join(this.projectPath, 'VERSION')
    await fileHelper.writeFile(filePath, '0.1.0\n')

    return {
      current: '0.1.0',
      next: '0.1.1',
      file: filePath,
      format: 'plaintext',
    }
  }

  // ===========================================================================
  // Write version back to source
  // ===========================================================================

  private async writeVersion(info: VersionInfo): Promise<void> {
    if (!info.file) {
      // git-tag: create a new tag
      if (info.format === 'git-tag') {
        await execFileAsync('git', ['tag', `v${info.next}`], { cwd: this.projectPath })
      }
      return
    }

    switch (info.format) {
      case 'json':
        await this.writeJsonVersion(info.file, info.next)
        break
      case 'toml':
        await this.writeTomlVersion(info.file, info.next)
        break
      case 'xml':
        await this.writeXmlVersion(info.file, info.next)
        break
      case 'plaintext':
        await fileHelper.writeFile(info.file, `${info.next}\n`)
        break
    }
  }

  private async writeJsonVersion(filePath: string, version: string): Promise<void> {
    const pkg = await fileHelper.readJson<Record<string, unknown>>(filePath, {})
    if (pkg) {
      pkg.version = version
      await fileHelper.writeJson(filePath, pkg)
    }
  }

  private async writeTomlVersion(filePath: string, version: string): Promise<void> {
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return

    // Replace version = "x.y.z" with new version
    const updated = content.replace(/^(\s*version\s*=\s*")([^"]+)(")/m, `$1${version}$3`)
    await fileHelper.writeFile(filePath, updated)
  }

  private async writeXmlVersion(filePath: string, version: string): Promise<void> {
    const content = await fileHelper.readFile(filePath, '')
    if (!content) return

    // Replace <Version>x.y.z</Version>
    const updated = content.replace(/(<Version>)([^<]+)(<\/Version>)/, `$1${version}$3`)
    await fileHelper.writeFile(filePath, updated)
  }
}

// =============================================================================
// Helpers (pure functions)
// =============================================================================

/**
 * Validate that a string looks like a semver version (major.minor.patch).
 * Allows optional pre-release suffix.
 */
function isSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version)
}

/**
 * Bump a semantic version.
 * - Stable: "1.2.3" -> "1.2.4"
 * - Prerelease with numeric tail: "2.0.0-alpha.12" -> "2.0.0-alpha.13"
 * - Prerelease without numeric tail: "0.1.0-beta" -> "0.1.0-beta.1"
 * - Unknown format: returned unchanged.
 * Build metadata (+xyz) is dropped, matching npm/semver tooling behavior.
 */
export function bumpPatch(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return version

  const [, major, minor, patch, pre] = match

  if (pre) {
    const parts = pre.split('.')
    const lastIdx = parts.length - 1
    if (/^\d+$/.test(parts[lastIdx])) {
      parts[lastIdx] = String(Number(parts[lastIdx]) + 1)
      return `${major}.${minor}.${patch}-${parts.join('.')}`
    }
    return `${major}.${minor}.${patch}-${pre}.1`
  }

  return `${major}.${minor}.${Number(patch) + 1}`
}

/**
 * Parse version from a Cargo.toml [package] section.
 * Looks for: version = "x.y.z" under [package].
 */
function parseTomlVersion(content: string): string | null {
  // Find [package] section and extract version
  const packageSection = content.match(/\[package\]([\s\S]*?)(?=\n\[|\n*$)/)
  if (!packageSection) return null

  const versionMatch = packageSection[1].match(/^\s*version\s*=\s*"([^"]+)"/m)
  return versionMatch?.[1] ?? null
}

/**
 * Parse version from pyproject.toml.
 * Checks multiple locations:
 * - [project] version = "x.y.z"
 * - [tool.poetry] version = "x.y.z"
 */
function parsePyprojectVersion(content: string): string | null {
  // Try [project] section first (PEP 621)
  const projectSection = content.match(/\[project\]([\s\S]*?)(?=\n\[|\n*$)/)
  if (projectSection) {
    const versionMatch = projectSection[1].match(/^\s*version\s*=\s*"([^"]+)"/m)
    if (versionMatch) return versionMatch[1]
  }

  // Try [tool.poetry] section
  const poetrySection = content.match(/\[tool\.poetry\]([\s\S]*?)(?=\n\[|\n*$)/)
  if (poetrySection) {
    const versionMatch = poetrySection[1].match(/^\s*version\s*=\s*"([^"]+)"/m)
    if (versionMatch) return versionMatch[1]
  }

  return null
}

/**
 * Parse version from a .csproj XML file.
 * Looks for <Version>x.y.z</Version>.
 */
function parseCsprojVersion(content: string): string | null {
  const match = content.match(/<Version>([^<]+)<\/Version>/)
  return match?.[1]?.trim() ?? null
}

export default VersionService
