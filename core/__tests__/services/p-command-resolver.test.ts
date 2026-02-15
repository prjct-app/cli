import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pCommandResolver, { isPCommandResolveError } from '../../services/p-command-resolver'

const ENV_KEYS = [
  'PRJCT_P_RESOLVER_PACKAGE_ROOT',
  'PRJCT_P_RESOLVER_NPM_ROOT',
  'PRJCT_P_RESOLVER_LOCAL_ROOT',
  'PRJCT_P_RESOLVER_DISABLE_BUNDLE',
]

let tmpRoot: string | null = null
let previousEnv: Record<string, string | undefined> = {}

async function writeTemplate(baseRoot: string, command: string): Promise<void> {
  const commandsDir = path.join(baseRoot, 'templates', 'commands')
  await fs.mkdir(commandsDir, { recursive: true })
  await fs.writeFile(path.join(commandsDir, `${command}.md`), `# p. ${command}\n`, 'utf-8')
}

describe('pCommandResolver', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-p-resolver-'))
    previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
    // Disable bundle lookup so tests exercise filesystem resolution paths
    process.env.PRJCT_P_RESOLVER_DISABLE_BUNDLE = '1'
  })

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousEnv[key]
      }
    }

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  it('resolves from package-resolve first', async () => {
    const packageRoot = path.join(tmpRoot!, 'pkg')
    const npmRoot = path.join(tmpRoot!, 'npm')
    const localRoot = path.join(tmpRoot!, 'local')

    await writeTemplate(packageRoot, 'sync')
    await writeTemplate(path.join(npmRoot, 'prjct-cli'), 'sync')
    await writeTemplate(localRoot, 'sync')

    process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT = packageRoot
    process.env.PRJCT_P_RESOLVER_NPM_ROOT = npmRoot
    process.env.PRJCT_P_RESOLVER_LOCAL_ROOT = localRoot

    const resolved = await pCommandResolver.resolvePCommandTemplate('sync')
    expect(resolved.source).toBe('package-resolve')
    expect(resolved.templatePath).toContain(path.join('pkg', 'templates', 'commands', 'sync.md'))
  })

  it('falls back to npm-root-g when package-resolve is unavailable', async () => {
    const packageRoot = path.join(tmpRoot!, 'pkg-empty')
    const npmRoot = path.join(tmpRoot!, 'npm')
    const localRoot = path.join(tmpRoot!, 'local')

    await fs.mkdir(packageRoot, { recursive: true })
    await writeTemplate(path.join(npmRoot, 'prjct-cli'), 'sync')
    await writeTemplate(localRoot, 'sync')

    process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT = packageRoot
    process.env.PRJCT_P_RESOLVER_NPM_ROOT = npmRoot
    process.env.PRJCT_P_RESOLVER_LOCAL_ROOT = localRoot

    const resolved = await pCommandResolver.resolvePCommandTemplate('sync')
    expect(resolved.source).toBe('npm-root-g')
    expect(resolved.templatePath).toContain(
      path.join('npm', 'prjct-cli', 'templates', 'commands', 'sync.md')
    )
  })

  it('falls back to local-dev when package and npm roots have no template', async () => {
    const packageRoot = path.join(tmpRoot!, 'pkg-empty')
    const npmRoot = path.join(tmpRoot!, 'npm-empty')
    const localRoot = path.join(tmpRoot!, 'local')

    await fs.mkdir(packageRoot, { recursive: true })
    await fs.mkdir(npmRoot, { recursive: true })
    await writeTemplate(localRoot, 'sync')

    process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT = packageRoot
    process.env.PRJCT_P_RESOLVER_NPM_ROOT = npmRoot
    process.env.PRJCT_P_RESOLVER_LOCAL_ROOT = localRoot

    const resolved = await pCommandResolver.resolvePCommandTemplate('sync')
    expect(resolved.source).toBe('local-dev')
    expect(resolved.templatePath).toContain(path.join('local', 'templates', 'commands', 'sync.md'))
  })

  it('returns UNKNOWN_COMMAND for invalid commands', async () => {
    try {
      await pCommandResolver.resolvePCommandTemplate('does-not-exist')
      expect.unreachable('expected resolver to throw UNKNOWN_COMMAND')
    } catch (error) {
      expect(isPCommandResolveError(error)).toBe(true)
      expect((error as { code?: string }).code).toBe('UNKNOWN_COMMAND')
    }
  })

  it('returns TEMPLATE_NOT_FOUND when command is valid but template is missing', async () => {
    const packageRoot = path.join(tmpRoot!, 'pkg-empty')
    const npmRoot = path.join(tmpRoot!, 'npm-empty')
    const localRoot = path.join(tmpRoot!, 'local-empty')

    await fs.mkdir(packageRoot, { recursive: true })
    await fs.mkdir(path.join(npmRoot, 'prjct-cli'), { recursive: true })
    await fs.mkdir(localRoot, { recursive: true })

    process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT = packageRoot
    process.env.PRJCT_P_RESOLVER_NPM_ROOT = npmRoot
    process.env.PRJCT_P_RESOLVER_LOCAL_ROOT = localRoot

    try {
      await pCommandResolver.resolvePCommandTemplate('sync')
      expect.unreachable('expected resolver to throw TEMPLATE_NOT_FOUND')
    } catch (error) {
      expect(isPCommandResolveError(error)).toBe(true)
      expect((error as { code?: string }).code).toBe('TEMPLATE_NOT_FOUND')
    }
  })

  it('resolves from template bundle when filesystem roots are empty', async () => {
    const emptyRoot = path.join(tmpRoot!, 'empty')
    await fs.mkdir(emptyRoot, { recursive: true })

    process.env.PRJCT_P_RESOLVER_PACKAGE_ROOT = emptyRoot
    process.env.PRJCT_P_RESOLVER_NPM_ROOT = emptyRoot
    process.env.PRJCT_P_RESOLVER_LOCAL_ROOT = emptyRoot
    delete process.env.PRJCT_P_RESOLVER_DISABLE_BUNDLE

    const resolved = await pCommandResolver.resolvePCommandTemplate('sync')
    expect(resolved.source).toBe('bundle')
    expect(resolved.templatePath).toBe('commands/sync.md')
  })
})
