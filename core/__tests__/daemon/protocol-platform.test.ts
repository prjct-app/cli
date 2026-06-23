import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { getDaemonRunDir, getDaemonSocketPath, isDaemonNamedPipe } from '../../daemon/protocol'

describe('daemon IPC platform paths', () => {
  test('uses Unix socket paths on POSIX platforms', () => {
    const cliHome = path.join('/tmp', 'prjct-home')
    expect(getDaemonRunDir(cliHome)).toBe(path.join(cliHome, 'run'))
    expect(getDaemonSocketPath('linux', cliHome)).toBe(path.join(cliHome, 'run', 'daemon.sock'))
    expect(getDaemonSocketPath('darwin', cliHome)).toBe(path.join(cliHome, 'run', 'daemon.sock'))
    expect(isDaemonNamedPipe(getDaemonSocketPath('linux', cliHome))).toBe(false)
  })

  test('uses a stable named pipe on Windows', () => {
    const cliHome = 'C:\\Users\\Jane\\.prjct-cli'
    const socketPath = getDaemonSocketPath('win32', cliHome)
    expect(socketPath).toStartWith('\\\\.\\pipe\\prjct-')
    expect(socketPath).toEndWith('-daemon')
    expect(socketPath).not.toContain('daemon.sock')
    expect(isDaemonNamedPipe(socketPath)).toBe(true)
    expect(getDaemonSocketPath('win32', cliHome)).toBe(socketPath)
  })
})
