/**
 * Incremental change detection — given the working tree + the
 * recorded hash registry, decide what changed since last sync and
 * whether the file-ranking indexes need a rebuild.
 *
 * Pure orchestration over the domain primitives in `core/domain/`.
 * Extracted from `SyncService.sync()` so the orchestrator stays
 * under 500 LOC.
 */

import { affectedDomains, propagateChanges } from '../../domain/change-propagator'
import { detectChanges, hasHashRegistry, saveHashes } from '../../domain/file-hasher'
import { getErrorMessage } from '../../types/fs'
import type { IncrementalInfo } from '../../types/project-sync'
import log from '../../utils/logger'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

export interface IncrementalDetectInput {
  projectId: string
  projectPath: string
  isFullSync: boolean
  changedFilesHint: string[] | undefined
}

export interface IncrementalDetectResult {
  shouldRebuildIndexes: boolean
  changedDomains: Set<string>
  incrementalInfo: IncrementalInfo | undefined
  changedSourceFiles: string[]
  deletedSourceFiles: string[]
}

export async function detectIncrementalChanges(
  args: IncrementalDetectInput
): Promise<IncrementalDetectResult> {
  const { projectId, projectPath, isFullSync, changedFilesHint } = args

  let shouldRebuildIndexes = true
  let changedDomains = new Set<string>()
  let incrementalInfo: IncrementalInfo | undefined
  let changedSourceFiles: string[] = []
  let deletedSourceFiles: string[] = []

  if (!isFullSync && hasHashRegistry(projectId)) {
    try {
      const { diff, currentHashes } = await detectChanges(projectPath, projectId, changedFilesHint)
      const totalChanged = diff.added.length + diff.modified.length + diff.deleted.length

      if (totalChanged === 0 && !changedFilesHint?.length) {
        // Nothing changed — skip expensive rebuilds.
        shouldRebuildIndexes = false
        incrementalInfo = {
          isIncremental: true,
          filesChanged: 0,
          filesUnchanged: diff.unchanged.length,
          indexesRebuilt: false,
          affectedDomains: [],
        }
      } else {
        // Some files changed — propagate through import graph.
        const propagated = propagateChanges(diff, projectId)
        changedDomains = affectedDomains(propagated.allAffected)

        changedSourceFiles = [...diff.added, ...diff.modified].filter(isSourceFile)
        deletedSourceFiles = diff.deleted.filter(isSourceFile)

        // Rebuild ranking indexes when the changed closure touches source files.
        const hasSourceChanges = propagated.allAffected.some(isSourceFile)
        shouldRebuildIndexes = hasSourceChanges

        incrementalInfo = {
          isIncremental: true,
          filesChanged: totalChanged,
          filesUnchanged: diff.unchanged.length,
          indexesRebuilt: shouldRebuildIndexes,
          affectedDomains: Array.from(changedDomains),
        }
      }

      // Commit new hashes AFTER determining diff.
      saveHashes(projectId, currentHashes)
    } catch (error) {
      log.debug('Incremental detection failed, falling back to full sync', {
        error: getErrorMessage(error),
      })
      // Fall through to full sync (shouldRebuildIndexes stays true).
    }
  } else {
    // First sync or --full flag: compute + save hashes for next time.
    try {
      const { currentHashes } = await detectChanges(projectPath, projectId, changedFilesHint)
      saveHashes(projectId, currentHashes)
    } catch (error) {
      log.debug('Hash computation failed (non-critical)', { error: getErrorMessage(error) })
    }
  }

  return {
    shouldRebuildIndexes,
    changedDomains,
    incrementalInfo,
    changedSourceFiles,
    deletedSourceFiles,
  }
}

function isSourceFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.'))
  return SOURCE_EXTENSIONS.has(ext)
}
