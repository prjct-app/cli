import { describe, expect, it } from 'bun:test'
import { mapCliEventsToWebFormat, mapCliEventToWebFormat } from '../../sync/event-mapper'
import type { SyncEvent } from '../../types/events'

function makeEvent(type: string, data: Record<string, unknown> = {}): SyncEvent {
  return {
    type,
    path: [],
    data,
    timestamp: '2026-04-10T00:00:00Z',
    projectId: 'proj-1',
  }
}

describe('mapCliEventToWebFormat', () => {
  it('maps task.created → upsert event on tasks table', () => {
    const result = mapCliEventToWebFormat(
      'proj-1',
      makeEvent('task.created', { id: 't1', title: 'hello' })
    )

    expect(result).not.toBeNull()
    expect(result?.event_type).toBe('upsert')
    expect(result?.entity_type).toBe('tasks')
    expect(result?.entity_id).toBe('t1')
    expect(result?.project_id).toBe('proj-1')
    expect(result?.data.project_id).toBe('proj-1')
  })

  it('maps task.deleted → delete event', () => {
    const result = mapCliEventToWebFormat('proj-1', makeEvent('task.deleted', { id: 't1' }))
    expect(result?.event_type).toBe('delete')
  })

  it('maps idea.created → ideas table', () => {
    const result = mapCliEventToWebFormat('proj-1', makeEvent('idea.created', { id: 'i1' }))
    expect(result?.entity_type).toBe('ideas')
  })

  it('maps feature.updated → roadmap_features table', () => {
    const result = mapCliEventToWebFormat('proj-1', makeEvent('feature.updated', { id: 'f1' }))
    expect(result?.entity_type).toBe('roadmap_features')
  })

  it('returns null for unknown entity type', () => {
    const result = mapCliEventToWebFormat('proj-1', makeEvent('unknown.created', { id: 'x1' }))
    expect(result).toBeNull()
  })

  it('converts camelCase keys to snake_case', () => {
    const result = mapCliEventToWebFormat(
      'proj-1',
      makeEvent('task.created', { id: 't1', createdAt: '2026-01-01', fooBar: 'baz' })
    )
    expect(result?.data.created_at).toBe('2026-01-01')
    expect(result?.data.foo_bar).toBe('baz')
    expect(result?.data.createdAt).toBeUndefined()
  })

  it('handles missing id gracefully', () => {
    const result = mapCliEventToWebFormat('proj-1', makeEvent('task.created', {}))
    expect(result?.entity_id).toBe('')
  })

  it('handles undefined data', () => {
    const event: SyncEvent = {
      type: 'task.created',
      path: [],
      data: undefined,
      timestamp: '2026-04-10T00:00:00Z',
      projectId: 'proj-1',
    }
    const result = mapCliEventToWebFormat('proj-1', event)
    expect(result).not.toBeNull()
    expect(result?.data.project_id).toBe('proj-1')
  })
})

describe('mapCliEventsToWebFormat', () => {
  it('maps all valid events and drops unknown ones', () => {
    const events: SyncEvent[] = [
      makeEvent('task.created', { id: 't1' }),
      makeEvent('unknown.x', { id: 'x' }),
      makeEvent('idea.created', { id: 'i1' }),
    ]
    const result = mapCliEventsToWebFormat('proj-1', events)
    expect(result).toHaveLength(2)
    expect(result[0].entity_type).toBe('tasks')
    expect(result[1].entity_type).toBe('ideas')
  })

  it('returns empty array for empty input', () => {
    expect(mapCliEventsToWebFormat('proj-1', [])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Phase 1.6 / B1 — wire passthrough for echo-loop + LWW fields
// ---------------------------------------------------------------------------
// The 3 fields below already exist on the `SyncEvent` type since Phase
// 1.5/B5 but the mapper used to drop them silently. These tests pin the
// new contract: top-level on the wire payload, optional, and backward
// compatible with legacy events that don't populate them.
describe('mapCliEventToWebFormat — Phase 1.6/B1 wire passthrough', () => {
  it('propagates originDeviceId, contentHash, revisionCount, ts as TOP-LEVEL fields', () => {
    const event: SyncEvent = {
      type: 'task.created',
      path: [],
      data: { id: 't1', title: 'hello' },
      timestamp: '2026-05-05T03:14:09Z',
      projectId: 'proj-1',
      originDeviceId: 'dev-uuid-1',
      contentHash: 'sha256:abc123',
      revisionCount: 7,
    }
    const result = mapCliEventToWebFormat('proj-1', event)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.origin_device_id).toBe('dev-uuid-1')
    expect(result.content_hash).toBe('sha256:abc123')
    expect(result.revision_count).toBe(7)
    expect(result.ts).toBe('2026-05-05T03:14:09Z')

    // The 3 dedupe fields must NOT leak into the snake_cased data blob —
    // the server reads them top-level. Mirroring them inside `data` would
    // double-cost serialization and confuse downstream consumers.
    expect(result.data.origin_device_id).toBeUndefined()
    expect(result.data.content_hash).toBeUndefined()
    expect(result.data.revision_count).toBeUndefined()
    expect(result.data.ts).toBeUndefined()
  })

  it('omits the new top-level fields when the producer did not populate them (backward compat)', () => {
    const result = mapCliEventToWebFormat(
      'proj-1',
      makeEvent('task.created', { id: 't1' }) // no originDeviceId/contentHash/revisionCount
    )
    expect(result).not.toBeNull()
    if (!result) return

    // Optional fields elided rather than emitted as undefined or null —
    // the wire payload stays compact and matches what JSON.stringify
    // produces for absent properties.
    expect('origin_device_id' in result).toBe(false)
    expect('content_hash' in result).toBe(false)
    expect('revision_count' in result).toBe(false)

    // ts is always emitted because every SyncEvent carries timestamp.
    expect(result.ts).toBe('2026-04-10T00:00:00Z')

    // Existing-shape invariants must still hold.
    expect(result.event_type).toBe('upsert')
    expect(result.entity_type).toBe('tasks')
    expect(result.entity_id).toBe('t1')
    expect(result.project_id).toBe('proj-1')
  })

  it('preserves project_id duplication (top-level AND inside data) for legacy consumers', () => {
    const event: SyncEvent = {
      type: 'task.created',
      path: [],
      data: { id: 't1' },
      timestamp: '2026-05-05T00:00:00Z',
      projectId: 'proj-1',
      originDeviceId: 'dev-uuid-1',
    }
    const result = mapCliEventToWebFormat('proj-1', event)
    expect(result?.project_id).toBe('proj-1')
    expect(result?.data.project_id).toBe('proj-1')
  })

  it('survives a SyncEvent with revisionCount=0 (falsy but valid value)', () => {
    const event: SyncEvent = {
      type: 'task.created',
      path: [],
      data: { id: 't1' },
      timestamp: '2026-05-05T00:00:00Z',
      projectId: 'proj-1',
      revisionCount: 0,
    }
    const result = mapCliEventToWebFormat('proj-1', event)
    expect(result?.revision_count).toBe(0)
  })

  it('JSON round-trip preserves the 4 fields (server-side parse perspective)', () => {
    const event: SyncEvent = {
      type: 'task.created',
      path: [],
      data: { id: 't1' },
      timestamp: '2026-05-05T03:14:09Z',
      projectId: 'proj-1',
      originDeviceId: 'dev-uuid-1',
      contentHash: 'sha256:abc',
      revisionCount: 3,
    }
    const wire = mapCliEventToWebFormat('proj-1', event)
    const reparsed = JSON.parse(JSON.stringify(wire))

    expect(reparsed.origin_device_id).toBe('dev-uuid-1')
    expect(reparsed.content_hash).toBe('sha256:abc')
    expect(reparsed.revision_count).toBe(3)
    expect(reparsed.ts).toBe('2026-05-05T03:14:09Z')
  })
})
