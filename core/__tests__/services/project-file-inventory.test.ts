import { afterEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildFileInventory,
  inventoryPathWeight,
  languagesFromExtensions,
  loadFileInventory,
  pathMatchesInventory,
  refreshFileInventory,
  saveFileInventory,
} from '../../services/project-file-inventory'
import { prjctDb } from '../../storage/database'

describe('project-file-inventory — dynamic extensions', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const r of roots) {
      try {
        fs.rmSync(r, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    roots.length = 0
  })

  function tmpProject(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-inv-'))
    roots.push(root)
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(root, rel)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, body, 'utf-8')
    }
    return root
  }

  test('discovers whatever extensions exist (vue, rb, sql) — not a ts-only list', async () => {
    const root = tmpProject({
      'src/App.vue': '<template></template>',
      'app/models/user.rb': 'class User; end',
      'queries/report.sql': 'SELECT 1',
      'core/main.ts': 'export {}',
      'package-lock.json': '{}',
    })
    const inv = await buildFileInventory(root)
    expect(inv.extensions['.vue']).toBeGreaterThanOrEqual(1)
    expect(inv.extensions['.rb']).toBeGreaterThanOrEqual(1)
    expect(inv.extensions['.sql']).toBeGreaterThanOrEqual(1)
    expect(inv.extensions['.ts']).toBeGreaterThanOrEqual(1)
    // lockfile noise excluded
    expect(inv.extensions['.json']).toBeUndefined()
    expect(inv.languages).toContain('Vue')
    expect(inv.languages).toContain('Ruby')
    expect(inv.languages).toContain('TypeScript')
  })

  test('pathMatchesInventory never drops unknown ext; weight downranks', async () => {
    const projectId = randomUUID()
    const root = tmpProject({
      'web/Widget.svelte': '<script></script>',
      'lib/util.go': 'package lib',
    })
    await refreshFileInventory(projectId, root)
    const loaded = loadFileInventory(projectId)
    expect(loaded).not.toBeNull()
    expect(pathMatchesInventory(projectId, 'web/Widget.svelte')).toBe(true)
    expect(pathMatchesInventory(projectId, 'lib/util.go')).toBe(true)
    // Unknown ext still accepted (P0-4) but softer weight until next sync
    expect(pathMatchesInventory(projectId, 'pkg/Main.java')).toBe(true)
    expect(inventoryPathWeight(projectId, 'lib/util.go')).toBe(1)
    expect(inventoryPathWeight(projectId, 'pkg/Main.java')).toBe(0.45)
  })

  test('without inventory, non-noise paths are not hard-rejected', () => {
    const projectId = randomUUID()
    // Never saved inventory for this id
    expect(pathMatchesInventory(projectId, 'src/Foo.vue')).toBe(true)
  })

  test('languagesFromExtensions is soft hint only', () => {
    expect(languagesFromExtensions({ '.vue': 3, '.ts': 10 })).toEqual(
      expect.arrayContaining(['Vue', 'TypeScript'])
    )
  })

  test('save/load roundtrip', () => {
    const projectId = randomUUID()
    // Touch DB
    prjctDb.getDoc(projectId, 'project')
    saveFileInventory(projectId, {
      extensions: { '.dart': 5 },
      languages: ['Dart'],
      fileCount: 5,
      builtAt: new Date().toISOString(),
    })
    expect(loadFileInventory(projectId)?.extensions['.dart']).toBe(5)
  })
})
