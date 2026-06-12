/**
 * Canonical pathManager patch for tests that sandbox project storage.
 *
 * Eight test files used to hand-copy the same capture/patch/restore
 * triple — a half-copied restore block is exactly how state leaks
 * across tests in this isolation hot zone (see the vault-pollution and
 * async-connection-leak gotchas). Import these instead:
 *
 *   beforeEach: patchPathManager(tmpRoot)
 *   afterEach:  restorePathManager()
 *
 * NOT preloaded on purpose — only tests that sandbox storage should
 * touch pathManager.
 */

import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'

const orig = {
  global: pathManager.getGlobalProjectPath.bind(pathManager),
  storage: pathManager.getStoragePath.bind(pathManager),
  file: pathManager.getFilePath.bind(pathManager),
}

/** Route all per-project paths under `root` (created by the test). */
export function patchPathManager(root: string): void {
  pathManager.getGlobalProjectPath = (id: string) => path.join(root, id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(root, id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(root, id, layer, filename)
}

export function restorePathManager(): void {
  pathManager.getGlobalProjectPath = orig.global
  pathManager.getStoragePath = orig.storage
  pathManager.getFilePath = orig.file
}
