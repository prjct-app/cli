/**
 * CodebaseAnalyzer - Provides helpers for project analysis
 *
 * 100% AGENTIC - No predetermined patterns or regex detection.
 * Claude reads the codebase and decides what's relevant.
 *
 * This class only provides I/O helpers. All analysis logic
 * is driven by Claude reading templates/analysis/analyze.md
 *
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { isNotFoundError } from '../types/fs'
import { execAsync } from '../utils/exec'
import { fileExists as fileExistsHelper } from '../utils/file-helper'

interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
  [key: string]: unknown
}

interface ComposerJson {
  name?: string
  require?: Record<string, string>
  'require-dev'?: Record<string, string>
  [key: string]: unknown
}

interface GitStats {
  totalCommits: number
  contributors: number
  age: string
}

interface FileExtensions {
  [extension: string]: number
}

class CodebaseAnalyzer {
  projectPath: string | null = null

  /**
   * Initialize analyzer for a project
   */
  init(projectPath: string = process.cwd()): void {
    this.projectPath = projectPath
  }

  /**
   * Read package.json if it exists
   */
  async readPackageJson(): Promise<PackageJson | null> {
    try {
      const packagePath = path.join(this.projectPath!, 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return null
      }
      throw error
    }
  }

  /**
   * Read Cargo.toml if it exists
   */
  async readCargoToml(): Promise<string | null> {
    try {
      const cargoPath = path.join(this.projectPath!, 'Cargo.toml')
      return await fs.readFile(cargoPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read requirements.txt if it exists
   */
  async readRequirements(): Promise<string | null> {
    try {
      const reqPath = path.join(this.projectPath!, 'requirements.txt')
      return await fs.readFile(reqPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read go.mod if it exists
   */
  async readGoMod(): Promise<string | null> {
    try {
      const goModPath = path.join(this.projectPath!, 'go.mod')
      return await fs.readFile(goModPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read Gemfile if it exists (Ruby)
   */
  async readGemfile(): Promise<string | null> {
    try {
      const gemfilePath = path.join(this.projectPath!, 'Gemfile')
      return await fs.readFile(gemfilePath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read mix.exs if it exists (Elixir)
   */
  async readMixExs(): Promise<string | null> {
    try {
      const mixPath = path.join(this.projectPath!, 'mix.exs')
      return await fs.readFile(mixPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read pom.xml if it exists (Java/Maven)
   */
  async readPomXml(): Promise<string | null> {
    try {
      const pomPath = path.join(this.projectPath!, 'pom.xml')
      return await fs.readFile(pomPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Read composer.json if it exists (PHP)
   */
  async readComposerJson(): Promise<ComposerJson | null> {
    try {
      const composerPath = path.join(this.projectPath!, 'composer.json')
      const content = await fs.readFile(composerPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return null
      }
      throw error
    }
  }

  /**
   * Read pyproject.toml if it exists (Python)
   */
  async readPyprojectToml(): Promise<string | null> {
    try {
      const pyprojectPath = path.join(this.projectPath!, 'pyproject.toml')
      return await fs.readFile(pyprojectPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Get all file extensions in project with counts
   * I/O PURO - Solo cuenta, no interpreta
   */
  async getFileExtensions(): Promise<FileExtensions> {
    try {
      const { stdout } = await execAsync(
        'find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/.next/*" | sed "s/.*\\./\\./" | sort | uniq -c | sort -rn',
        { cwd: this.projectPath! }
      )
      const extensions: FileExtensions = {}
      stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
          const match = line.trim().match(/^\s*(\d+)\s+(\.\w+)$/)
          if (match) {
            extensions[match[2]] = parseInt(match[1], 10)
          }
        })
      return extensions
    } catch (_error) {
      // exec errors (find command not available, etc.) - return empty
      return {}
    }
  }

  /**
   * List all config files in project root
   * I/O PURO - Solo lista, no categoriza
   */
  async listConfigFiles(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.projectPath!)
      const configPatterns = [
        /^package\.json$/,
        /^Cargo\.toml$/,
        /^go\.mod$/,
        /^requirements\.txt$/,
        /^Gemfile$/,
        /^mix\.exs$/,
        /^pom\.xml$/,
        /^composer\.json$/,
        /^pyproject\.toml$/,
        /^tsconfig.*\.json$/,
        /^\..*rc(\.json|\.js|\.cjs)?$/,
        /^Dockerfile$/,
        /^docker-compose.*\.ya?ml$/,
        /^\.env.*$/,
      ]
      return entries.filter((entry) => configPatterns.some((pattern) => pattern.test(entry)))
    } catch (error) {
      if (isNotFoundError(error)) {
        return []
      }
      throw error
    }
  }

  /**
   * List all directories in project root
   */
  async listDirectories(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.projectPath!, { withFileTypes: true })
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    } catch (error) {
      if (isNotFoundError(error)) {
        return []
      }
      throw error
    }
  }

  /**
   * Get git log (last N commits)
   */
  async getGitLog(limit: number = 50): Promise<string> {
    try {
      const { stdout } = await execAsync(`git log -n ${limit} --pretty=format:"%h|%an|%ar|%s"`, {
        cwd: this.projectPath!,
      })
      return stdout
    } catch (_error) {
      // Git errors (not a repo, git not installed) - return empty
      return ''
    }
  }

  /**
   * Get git statistics
   */
  async getGitStats(): Promise<GitStats> {
    try {
      const { stdout: totalCommits } = await execAsync('git rev-list --count HEAD', {
        cwd: this.projectPath!,
      })

      const { stdout: contributors } = await execAsync('git log --format="%an" | sort -u | wc -l', {
        cwd: this.projectPath!,
      })

      const { stdout: firstCommit } = await execAsync(
        'git log --reverse --pretty=format:"%ar" | head -1',
        {
          cwd: this.projectPath!,
        }
      )

      return {
        totalCommits: parseInt(totalCommits.trim(), 10) || 0,
        contributors: parseInt(contributors.trim(), 10) || 0,
        age: firstCommit.trim() || 'unknown',
      }
    } catch (_error) {
      // Git errors (not a repo, git not installed) - return defaults
      return {
        totalCommits: 0,
        contributors: 0,
        age: 'unknown',
      }
    }
  }

  /**
   * Count total files (excluding common ignore patterns)
   */
  async countFiles(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" | wc -l',
        { cwd: this.projectPath! }
      )
      return parseInt(stdout.trim(), 10) || 0
    } catch (_error) {
      // exec errors (find command not available, etc.) - return 0
      return 0
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    return fileExistsHelper(path.join(this.projectPath!, filename))
  }

  /**
   * Read any file in the project
   */
  async readFile(relativePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.projectPath!, relativePath)
      return await fs.readFile(fullPath, 'utf-8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Find files matching a pattern
   */
  async findFiles(pattern: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `find . -type f -name "${pattern}" ! -path "*/node_modules/*" ! -path "*/.git/*"`,
        { cwd: this.projectPath! }
      )
      return stdout.trim().split('\n').filter(Boolean)
    } catch (_error) {
      // exec errors (find command not available, etc.) - return empty
      return []
    }
  }
}

const analyzer = new CodebaseAnalyzer()
export default analyzer
export { CodebaseAnalyzer }
