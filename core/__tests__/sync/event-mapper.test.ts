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
