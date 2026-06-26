/**
 * Deterministic project identity — the SAME repo must derive the SAME cloud id
 * on every machine, so linking from two machines never duplicates the project.
 */

import { describe, expect, it } from 'bun:test'
import { uuidv5 } from '../../services/sync/project-identity'

describe('uuidv5 (deterministic project id)', () => {
  it('is stable for the same key', () => {
    const a = uuidv5('github:jlopezlira/prjct-cli-app')
    const b = uuidv5('github:jlopezlira/prjct-cli-app')
    expect(a).toBe(b)
  })

  it('differs for different repos', () => {
    expect(uuidv5('github:jlopezlira/prjct-cli-app')).not.toBe(
      uuidv5('github:jlopezlira/prjct-cli-api')
    )
  })

  it('produces a valid RFC 4122 v5 UUID', () => {
    const id = uuidv5('github:jlopezlira/prjct-cli-app')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
