/**
 * ship() workflow-first dispatcher coverage.
 *
 * Ship used to hardcode version bump + changelog + git commit/push.
 * After the refactor, ship is a dispatcher: it runs configured
 * workflow rules, records the shipped row, and asks the user via
 * `clarification` when the state is ambiguous.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ShippingCommands } from '../../commands/shipping'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { workflowRuleStorage } from '../../storage/workflow-rule-storage'

async function freshProject(): Promise<{ projectPath: string; projectId: string }> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-ship-test-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  const projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  })
  // ensureProjectStructure initialises the DB and seeds the built-in
  // 'ship' workflow row — no need to create a custom_workflows entry.
  await pathManager.ensureProjectStructure(projectId)
  return { projectPath, projectId }
}

function initGit(projectPath: string): void {
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: projectPath })
  execFileSync('git', ['config', 'user.email', 'test@prjct.local'], { cwd: projectPath })
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: projectPath })
}

describe('ship() — workflow-first', () => {
  let projectPath: string
  let projectId: string
  let cmd: ShippingCommands
  let spies: Array<ReturnType<typeof spyOn>> = []

  beforeEach(async () => {
    ;({ projectPath, projectId } = await freshProject())
    // Sandbox vault inside the test temp dir so ship() never writes
    // to the user's real ~/Documents/prjct/.
    const vaultRoot = path.join(projectPath, '.test-vault')
    spies.push(spyOn(pathManager, 'getWikiPath').mockImplementation(async () => vaultRoot))
    cmd = new ShippingCommands()
  })

  afterEach(async () => {
    for (const s of spies) s.mockRestore()
    spies = []
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('non-code project with no rules → returns clarification, does not touch anything', async () => {
    const result = await cmd.ship('release notes', projectPath, { md: true })
    expect(result.success).toBe(false)
    expect(result.clarification).toBeDefined()
    const c = result.clarification as { options: string[] }
    expect(c.options).toContain('register-only')
    expect(c.options).toContain('seed-code-workflow')
    expect(c.options).toContain('abort')
    // No CHANGELOG should have been written.
    const exists = await fs
      .access(path.join(projectPath, 'CHANGELOG.md'))
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })

  test('register-only intent records the shipped row without touching files', async () => {
    const result = await cmd.ship('write blog post', projectPath, {
      md: true,
      intent: 'register-only',
    })

    expect(result.success).toBe(true)
    expect(result.version).toBe('unversioned')
    expect(result.feature).toBe('write blog post')

    const pkgExists = await fs
      .access(path.join(projectPath, 'package.json'))
      .then(() => true)
      .catch(() => false)
    expect(pkgExists).toBe(false)
  })

  test('code project auto-seeds ship rules on first run (migration path)', async () => {
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify({ name: 'codeproj', version: '0.5.0' }, null, 2)
    )
    initGit(projectPath)
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init', '-q'], { cwd: projectPath })

    // No rules pre-seeded — ship should auto-seed then proceed (push will
    // fail for lack of remote, but commit should land).
    await cmd.ship('first ship', projectPath, { md: true })

    const rules = workflowRuleStorage.getRulesForCommand(projectId, 'ship')
    const actions = rules.map((r) => r.action)
    expect(actions).toContain('version:bump')
    expect(actions).toContain('changelog:add')
    expect(actions).toContain('git:commit')
    expect(actions).toContain('git:push')

    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'))
    expect(pkg.version).toBe('0.5.1')
  })

  test('seed-code-workflow on a non-code project returns a helpful error', async () => {
    const result = await cmd.ship(null, projectPath, {
      md: true,
      intent: 'seed-code-workflow',
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/does not look like code/i)
  })
})
