import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ChangelogService } from '../../services/changelog-service'

// Idempotency guards against the "double changelog entry on ship retry"
// failure mode where a partial ship leaves CHANGELOG.md modified, then
// the retry stacks another entry on top instead of reusing the existing
// one.

describe('ChangelogService.addFeature (idempotency)', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-changelog-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  async function readChangelog(): Promise<string> {
    return fs.readFile(path.join(dir, 'CHANGELOG.md'), 'utf-8')
  }

  it('appends a new entry on first call', async () => {
    const svc = new ChangelogService(dir)
    await svc.addFeature('1.2.4', 'first feature')
    expect(await readChangelog()).toContain('## [1.2.4]')
    expect(await readChangelog()).toContain('first feature')
  })

  it('does NOT add a duplicate entry when version already exists', async () => {
    const svc = new ChangelogService(dir)
    await svc.addFeature('1.2.4', 'first feature')
    const before = await readChangelog()

    // Retry with same version — should be a no-op.
    await svc.addFeature('1.2.4', 'spurious second call')
    const after = await readChangelog()
    expect(after).toBe(before)
    expect((after.match(/^## \[1\.2\.4\]/gm) ?? []).length).toBe(1)
    expect(after).not.toContain('spurious second call')
  })

  it('still adds entries for new versions after an existing entry', async () => {
    const svc = new ChangelogService(dir)
    await svc.addFeature('1.2.4', 'patch')
    await svc.addFeature('1.3.0', 'feature')
    const content = await readChangelog()
    expect(content).toContain('## [1.2.4]')
    expect(content).toContain('## [1.3.0]')
  })

  it('handles generic markdown format (no Keep a Changelog markers)', async () => {
    const file = path.join(dir, 'CHANGELOG.md')
    await fs.writeFile(file, '# Changelog\n\n## 1.2.3 - 2025-01-01\n\n- old entry\n')
    const svc = new ChangelogService(dir)
    await svc.addFeature('1.2.4', 'new feature')
    const content = await readChangelog()
    expect(content).toContain('## 1.2.4')

    // Idempotent retry.
    await svc.addFeature('1.2.4', 'spurious')
    expect((content.match(/^## 1\.2\.4/gm) ?? []).length).toBe(1)
  })
})
