/**
 * Sandbox detection — `sandboxed` was historically hardcoded false; it now
 * derives from CODEX_SANDBOX / PRJCT_SANDBOX so write-error messaging and any
 * future degraded-mode branching can react to a restricted harness (Codex).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { isSandboxed } from '../../infrastructure/agent-detector'

let prevCodex: string | undefined
let prevPrjct: string | undefined

beforeEach(() => {
  prevCodex = process.env.CODEX_SANDBOX
  prevPrjct = process.env.PRJCT_SANDBOX
  delete process.env.CODEX_SANDBOX
  delete process.env.PRJCT_SANDBOX
})

afterEach(() => {
  if (prevCodex === undefined) delete process.env.CODEX_SANDBOX
  else process.env.CODEX_SANDBOX = prevCodex
  if (prevPrjct === undefined) delete process.env.PRJCT_SANDBOX
  else process.env.PRJCT_SANDBOX = prevPrjct
})

describe('isSandboxed', () => {
  it('is false with no sandbox signal', () => {
    expect(isSandboxed()).toBe(false)
  })

  it('is true under CODEX_SANDBOX', () => {
    process.env.CODEX_SANDBOX = 'seatbelt'
    expect(isSandboxed()).toBe(true)
  })

  it('is true under PRJCT_SANDBOX=1', () => {
    process.env.PRJCT_SANDBOX = '1'
    expect(isSandboxed()).toBe(true)
  })
})
