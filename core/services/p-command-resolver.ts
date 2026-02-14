import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { listTemplates } from '../agentic/template-loader'
import type {
  PCommandResolveError,
  PCommandResolveErrorCode,
  PCommandTemplateSource,
  ResolvedPTemplate,
} from '../types/services'
import { PACKAGE_ROOT } from '../utils/version'

export interface PCommandValidationResult {
  valid: boolean
  command: string
  code?: PCommandResolveErrorCode
  message?: string
}

interface CandidateRoot {
  source: PCommandTemplateSource
  root: string
}

class PCommandResolverError extends Error implements PCommandResolveError {
  code: PCommandResolveErrorCode
  fix?: string[]

  constructor(code: PCommandResolveErrorCode, message: string, fix?: string[]) {
    super(message)
    this.name = 'PCommandResolverError'
    this.code = code
    this.fix = fix
  }
}

function normalizeCommand(command: string): string {
  return command.trim().toLowerCase()
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function getPackageResolveRoot(): string | null {
  const override = process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT
  if (override) return override

  try {
    const packageJsonPath = require.resolve('prjct-cli/package.json')
    return path.dirname(packageJsonPath)
  } catch {
    return null
  }
}

function getNpmGlobalRoot(): string | null {
  const override = process.env.PRJCT_P_RESOLVER_NPM_ROOT
  if (override) return override

  if (process.env.PRJCT_P_RESOLVER_DISABLE_NPM_ROOT === '1') return null

  try {
    const npmRoot = execSync('npm root -g', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .trim()
      .replace(/\r?\n/g, '')
    return npmRoot
  } catch {
    return null
  }
}

function getLocalDevRoot(): string {
  return process.env.PRJCT_P_RESOLVER_LOCAL_ROOT || PACKAGE_ROOT
}

function getCandidateRoots(): CandidateRoot[] {
  const roots: CandidateRoot[] = []
  const packageRoot = getPackageResolveRoot()
  if (packageRoot) {
    roots.push({ source: 'package-resolve', root: packageRoot })
  }

  const npmRoot = getNpmGlobalRoot()
  if (npmRoot) {
    roots.push({ source: 'npm-root-g', root: path.join(npmRoot, 'prjct-cli') })
  }

  roots.push({ source: 'local-dev', root: getLocalDevRoot() })
  return roots
}

function getCatalogFromTemplates(): string[] {
  const templates = listTemplates('commands/')
  const commands = templates
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => path.basename(entry, '.md'))
    .filter((name) => name !== 'p')

  return Array.from(new Set(commands)).sort()
}

class PCommandResolver {
  getPCommandCatalog(): string[] {
    return getCatalogFromTemplates()
  }

  validatePCommand(command: string): PCommandValidationResult {
    const normalized = normalizeCommand(command)
    if (!/^[a-z][a-z0-9-]*$/.test(normalized)) {
      return {
        valid: false,
        command: normalized,
        code: 'UNKNOWN_COMMAND',
        message: `Invalid p. command "${command}"`,
      }
    }

    const catalog = this.getPCommandCatalog()
    if (!catalog.includes(normalized)) {
      return {
        valid: false,
        command: normalized,
        code: 'UNKNOWN_COMMAND',
        message: `Unknown command: p. ${normalized}`,
      }
    }

    return { valid: true, command: normalized }
  }

  async resolvePCommandTemplate(command: string): Promise<ResolvedPTemplate> {
    if (this.getPCommandCatalog().length === 0) {
      throw new PCommandResolverError('ROUTER_NOT_READY', 'p. router command catalog is empty', [
        'Run `prjct setup` to reinstall command templates',
      ])
    }

    const validation = this.validatePCommand(command)
    if (!validation.valid) {
      throw new PCommandResolverError(
        validation.code || 'UNKNOWN_COMMAND',
        validation.message || `Unknown command: p. ${validation.command}`,
        [
          `Use one of: ${this.getPCommandCatalog().join(', ')}`,
          'Run `prjct setup` to refresh command templates',
        ]
      )
    }

    for (const candidate of getCandidateRoots()) {
      const templatePath = path.join(
        candidate.root,
        'templates',
        'commands',
        `${validation.command}.md`
      )
      if (await fileExists(templatePath)) {
        return {
          command: validation.command,
          templatePath,
          source: candidate.source,
        }
      }
    }

    throw new PCommandResolverError(
      'TEMPLATE_NOT_FOUND',
      `Template not found for p. ${validation.command}`,
      [
        'Run `prjct start` to repair Codex skill and command templates',
        'Run `prjct setup` to refresh installation',
      ]
    )
  }
}

export function isPCommandResolveError(error: unknown): error is PCommandResolveError {
  return (
    error instanceof Error &&
    typeof (error as Partial<PCommandResolveError>).code === 'string' &&
    typeof (error as Partial<PCommandResolveError>).message === 'string'
  )
}

export const pCommandResolver = new PCommandResolver()
export default pCommandResolver
