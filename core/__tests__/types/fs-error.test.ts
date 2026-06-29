/**
 * fs write-error translation — the sandboxed-agent (Codex read-only home) path.
 * Pins that read-only / permission failures become one actionable line and
 * that unrelated errors are reported verbatim.
 */

import { describe, expect, it } from 'bun:test'
import { describeFsWriteError, isReadonlyError } from '../../types/fs'

function nodeError(code: string, message = code): NodeJS.ErrnoException {
  const err = new Error(message) as NodeJS.ErrnoException
  err.code = code
  return err
}

describe('isReadonlyError', () => {
  it('detects EROFS and SQLITE_READONLY codes', () => {
    expect(isReadonlyError(nodeError('EROFS'))).toBe(true)
    expect(isReadonlyError(nodeError('SQLITE_READONLY'))).toBe(true)
  })

  it('detects the SQLite readonly message without a code', () => {
    expect(isReadonlyError(new Error('attempt to write a readonly database'))).toBe(true)
  })

  it('is false for unrelated errors', () => {
    expect(isReadonlyError(nodeError('ENOSPC'))).toBe(false)
    expect(isReadonlyError(new Error('boom'))).toBe(false)
  })
})

describe('describeFsWriteError', () => {
  it('gives an actionable sandbox hint for read-only failures', () => {
    const msg = describeFsWriteError(nodeError('EROFS'), '/home/x/.prjct-cli/db', 'database')
    expect(msg).toContain('/home/x/.prjct-cli/db')
    expect(msg).toContain('database')
    expect(msg).toMatch(/sandbox|read-only/i)
    expect(msg).toContain('approve')
  })

  it('treats EPERM/EACCES as sandbox-class failures', () => {
    expect(describeFsWriteError(nodeError('EPERM'), '/p', 'config')).toMatch(/sandbox|read-only/i)
    expect(describeFsWriteError(nodeError('EACCES'), '/p', 'config')).toMatch(/sandbox|read-only/i)
  })

  it('reports unrelated errors verbatim', () => {
    const msg = describeFsWriteError(nodeError('ENOSPC', 'no space left'), '/p', 'file')
    expect(msg).toContain('no space left')
    expect(msg).not.toMatch(/approve/)
  })
})
