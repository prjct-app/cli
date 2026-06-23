import { describe, expect, test } from 'bun:test'
import { getPostCheckoutScript, getPostCommitScript } from '../../services/hooks-service/scripts'

describe('git hook scripts are platform tolerant', () => {
  test('post-commit delegates rate limit and spawn to Node', () => {
    const script = getPostCommitScript()
    expect(script).toContain('#!/bin/sh')
    expect(script).toContain('# prjct:auto-sync:start')
    expect(script).toContain('# prjct:auto-sync:end')
    expect(script).toContain("process.platform === 'win32' ? 'prjct.cmd' : 'prjct'")
    expect(script).toContain("['sync', '--quiet', '--yes']")
    expect(script).toContain('detached: true')
    expect(script).not.toContain('md5sum')
    expect(script).not.toContain('md5 -q')
    expect(script).not.toContain('stat -f')
    expect(script).not.toContain('stat -c')
    expect(script).not.toContain('date +%s')
    expect(script).not.toContain(' >/dev/null 2>&1 &')
  })

  test('post-checkout keeps branch-change guard inside removable prjct block', () => {
    const script = getPostCheckoutScript()
    const start = script.indexOf('# prjct:auto-sync:start')
    const end = script.indexOf('# prjct:auto-sync:end')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const managedBlock = script.slice(start, end)
    expect(managedBlock).toContain('if [ "$3" != "1" ]; then')
    expect(managedBlock).toContain('if [ "$1" = "$2" ]; then')
    expect(managedBlock).toContain("['sync', '--quiet', '--yes']")
  })
})
