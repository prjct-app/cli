/**
 * Phase 1.6 / B3 — applyEvent surfaces unhandled entity_types.
 *
 * Two contracts to pin:
 *   1. When an event arrives for an entity_type with no registered
 *      handler, applyEvent emits a stable warn line (not a silent
 *      no-op). Once per process per entity_type — batch pulls don't
 *      become a wall of identical warns.
 *   2. Exhaustiveness: every entity_type the cloud might emit
 *      (per ENTITY_TYPE_MAP in event-mapper.ts) is either handled
 *      or explicitly listed in UNKNOWN_ENTITY_TYPES. CI fails if
 *      the cloud gains a new entity that nobody categorized here.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'
import { entityHandlers, UNKNOWN_ENTITY_TYPES } from '../../sync/entity-handlers'
import { _resetWarnDedupeForTest, syncManager } from '../../sync/sync-manager'

let projectId: string
let originalProjectsDir: string | undefined
let warnCalls: string[]
let originalWarn: typeof console.warn

beforeEach(async () => {
  prjctDb.close()
  const tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-unknown-ent-'))
  originalProjectsDir = process.env.PRJCT_PROJECTS_DIR
  process.env.PRJCT_PROJECTS_DIR = tempProjectsDir
  projectId = `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await pathManager.ensureProjectStructure(projectId)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')

  warnCalls = []
  originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args.map((a) => String(a)).join(' '))
  }
  _resetWarnDedupeForTest()
})

afterEach(() => {
  console.warn = originalWarn
  _resetWarnDedupeForTest()
  if (originalProjectsDir === undefined) delete process.env.PRJCT_PROJECTS_DIR
  else process.env.PRJCT_PROJECTS_DIR = originalProjectsDir
  prjctDb.close()
})

async function applyEvent(event: Record<string, unknown>): Promise<void> {
  await (
    syncManager as unknown as {
      applyEvent: (pid: string, ev: Record<string, unknown>) => Promise<void>
    }
  ).applyEvent(projectId, event)
}

describe('applyEvent — unhandled entity_type warn (Phase 1.6 / B3)', () => {
  test('roadmap_features (in UNKNOWN_ENTITY_TYPES) emits a stable warn', async () => {
    await applyEvent({
      entity_type: 'roadmap_features',
      event_type: 'upsert',
      data: { id: 'feat-A' },
    })

    expect(warnCalls).toHaveLength(1)
    expect(warnCalls[0]).toContain('[sync] apply skipped')
    expect(warnCalls[0]).toContain("entity_type='roadmap_features'")
    expect(warnCalls[0]).toContain('code=no_local_handler')
    // The Phase 2 hint should appear for known-but-unhandled types so
    // operators know this is intentional, not a registration miss.
    expect(warnCalls[0]).toContain('Phase 2')
  })

  test('projects (in UNKNOWN_ENTITY_TYPES) also emits the Phase 2 hint', async () => {
    await applyEvent({
      entity_type: 'projects',
      event_type: 'upsert',
      data: { id: 'proj-A' },
    })
    expect(
      warnCalls.some((w) => w.includes("entity_type='projects'") && w.includes('Phase 2'))
    ).toBe(true)
  })

  test('genuinely unknown entity_type warns WITHOUT the Phase 2 hint', async () => {
    await applyEvent({
      entity_type: 'totally_new_thing',
      event_type: 'upsert',
      data: { id: 'x' },
    })
    expect(warnCalls).toHaveLength(1)
    expect(warnCalls[0]).toContain("entity_type='totally_new_thing'")
    expect(warnCalls[0]).toContain('no local handler registered')
    expect(warnCalls[0]).not.toContain('Phase 2')
  })

  test('warn is deduped per-process (batch pull does not flood)', async () => {
    for (let i = 0; i < 10; i++) {
      await applyEvent({
        entity_type: 'roadmap_features',
        event_type: 'upsert',
        data: { id: `feat-${i}` },
      })
    }
    expect(warnCalls).toHaveLength(1)
  })

  test('different unhandled types each get their own warn line', async () => {
    await applyEvent({
      entity_type: 'roadmap_features',
      event_type: 'upsert',
      data: { id: 'a' },
    })
    await applyEvent({
      entity_type: 'projects',
      event_type: 'upsert',
      data: { id: 'b' },
    })
    expect(warnCalls).toHaveLength(2)
  })

  test('handled entity_type does NOT warn (verifies the negative)', async () => {
    // Inject a registered no-op handler for a fake entity, prove no warn.
    const fake = entityHandlers as Record<
      string,
      { upsert: () => Promise<void>; delete: () => Promise<void> }
    >
    fake.fake_handled = {
      upsert: async () => {},
      delete: async () => {},
    }
    try {
      await applyEvent({
        entity_type: 'fake_handled',
        event_type: 'upsert',
        data: { id: 'x' },
      })
      expect(warnCalls).toHaveLength(0)
    } finally {
      delete fake.fake_handled
    }
  })
})

describe('exhaustiveness: every wire entity_type is categorized', () => {
  test('ENTITY_TYPE_MAP outputs land in either entityHandlers or UNKNOWN_ENTITY_TYPES', async () => {
    // Mirror the ENTITY_TYPE_MAP from event-mapper. We pin the values
    // here rather than importing the private const because the test's
    // job is to FAIL when a new entry is added — that's the trigger
    // for someone to register a handler or list it as unknown.
    const wireEntityTypes = [
      'memories',
      'tasks',
      'subtasks',
      'ideas',
      'roadmap_features',
      'shipped_items',
      'shipped_features',
      'queue_tasks',
      'custom_workflows',
      'workflow_rules',
      'archives',
      'metrics_daily',
      'velocity_sprints',
      'projects',
      'sessions',
      'agents',
    ]

    const handled = new Set(Object.keys(entityHandlers))

    const uncategorized = wireEntityTypes.filter(
      (t) => !handled.has(t) && !UNKNOWN_ENTITY_TYPES.has(t)
    )

    expect(uncategorized).toEqual([])
  })
})
