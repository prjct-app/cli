/**
 * Analysis Storage (PRJ-263)
 *
 * Manages sealable analysis with dual storage:
 * - storage/analysis.json       (current draft)
 * - storage/analysis-sealed.json (locked sealed version)
 *
 * Lifecycle: DRAFT → VERIFIED → SEALED
 * Re-sync creates a new draft WITHOUT destroying the sealed version.
 * Only sealed analysis feeds task context.
 */

import { createHash } from 'node:crypto'
import type { AnalysisSchema } from '../schemas/analysis'
import {
  AnalysisItemSchema,
  type SemanticVerificationReport,
  semanticVerify,
} from '../schemas/analysis'
import { generateAnalysisDiff } from '../services/analysis-diff'
import type { AnalysisDiff } from '../types/services.js'
import { getTimestamp } from '../utils/date-helper'
import { StorageManager } from './storage-manager'

// =============================================================================
// Types
// =============================================================================

interface AnalysisStoreData {
  draft: AnalysisSchema | null
  sealed: AnalysisSchema | null
  previousSealed: AnalysisSchema | null
  lastUpdated: string
}

interface SealResult {
  success: boolean
  signature?: string
  error?: string
}

interface RollbackResult {
  success: boolean
  restoredSignature?: string
  error?: string
}

interface StalenessCheck {
  isStale: boolean
  sealedCommit: string | null
  currentCommit: string | null
  message: string
}

// =============================================================================
// Analysis Storage
// =============================================================================

class AnalysisStorage extends StorageManager<AnalysisStoreData> {
  constructor() {
    super('analysis.json')
  }

  protected getDefault(): AnalysisStoreData {
    return {
      draft: null,
      sealed: null,
      previousSealed: null,
      lastUpdated: '',
    }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `analysis.${action}d`
  }

  // ===========================================================================
  // Domain Methods
  // ===========================================================================

  /**
   * Save a new draft analysis (called by sync-service).
   * Preserves existing sealed analysis.
   */
  async saveDraft(projectId: string, analysis: AnalysisSchema): Promise<void> {
    const draft: AnalysisSchema = {
      ...analysis,
      status: 'draft',
    }

    // Validate with Zod
    AnalysisItemSchema.parse(draft)

    await this.update(projectId, (data) => ({
      ...data,
      draft,
      lastUpdated: getTimestamp(),
    }))

    await this.publishEntityEvent(projectId, 'analysis', 'drafted', {
      commitHash: draft.commitHash,
      fileCount: draft.fileCount,
    })
  }

  /**
   * Seal the current draft analysis.
   * Computes SHA-256 signature and locks the analysis.
   */
  async seal(projectId: string): Promise<SealResult> {
    const data = await this.read(projectId)

    if (!data.draft) {
      return { success: false, error: 'No draft analysis to seal. Run `p. sync` first.' }
    }

    if (data.draft.status === 'sealed') {
      return { success: false, error: 'Draft is already sealed.' }
    }

    // Compute signature
    const signature = this.computeSignature(data.draft)
    const now = getTimestamp()

    const sealed: AnalysisSchema = {
      ...data.draft,
      status: 'sealed',
      signature,
      sealedAt: now,
    }

    // Validate
    AnalysisItemSchema.parse(sealed)

    await this.write(projectId, {
      draft: null, // Clear draft — it's now sealed
      sealed,
      previousSealed: data.sealed, // Preserve previous sealed for rollback
      lastUpdated: now,
    })

    await this.publishEntityEvent(projectId, 'analysis', 'sealed', {
      commitHash: sealed.commitHash,
      signature,
    })

    return { success: true, signature }
  }

  /**
   * Get the sealed analysis (for task context injection).
   * Returns null if no sealed analysis exists.
   */
  async getSealed(projectId: string): Promise<AnalysisSchema | null> {
    const data = await this.read(projectId)
    return data.sealed
  }

  /**
   * Get the current draft analysis.
   */
  async getDraft(projectId: string): Promise<AnalysisSchema | null> {
    const data = await this.read(projectId)
    return data.draft
  }

  /**
   * Get the active analysis (sealed if available, otherwise draft).
   * This is what tasks should consume.
   */
  async getActive(projectId: string): Promise<AnalysisSchema | null> {
    const data = await this.read(projectId)
    return data.sealed ?? data.draft
  }

  /**
   * Get the current analysis status.
   */
  async getStatus(projectId: string): Promise<{
    hasSealed: boolean
    hasDraft: boolean
    hasPreviousSealed: boolean
    sealedCommit: string | null
    draftCommit: string | null
    previousSealedCommit: string | null
    sealedAt: string | null
  }> {
    const data = await this.read(projectId)
    return {
      hasSealed: data.sealed !== null,
      hasDraft: data.draft !== null,
      hasPreviousSealed: data.previousSealed !== null,
      sealedCommit: data.sealed?.commitHash ?? null,
      draftCommit: data.draft?.commitHash ?? null,
      previousSealedCommit: data.previousSealed?.commitHash ?? null,
      sealedAt: data.sealed?.sealedAt ?? null,
    }
  }

  /**
   * Rollback to the previous sealed analysis version.
   * The current sealed becomes a draft, and previousSealed becomes sealed.
   */
  async rollback(projectId: string): Promise<RollbackResult> {
    const data = await this.read(projectId)

    if (!data.previousSealed) {
      return { success: false, error: 'No previous sealed version to rollback to.' }
    }

    const now = getTimestamp()

    await this.write(projectId, {
      draft: data.sealed, // Current sealed becomes draft (recoverable)
      sealed: data.previousSealed,
      previousSealed: null, // Clear — only one level of undo
      lastUpdated: now,
    })

    await this.publishEntityEvent(projectId, 'analysis', 'rolled_back', {
      restoredCommit: data.previousSealed.commitHash,
      restoredSignature: data.previousSealed.signature,
    })

    return { success: true, restoredSignature: data.previousSealed.signature }
  }

  /**
   * Compute diff between draft and sealed analysis (PRJ-275).
   * Returns null if either side is missing.
   */
  async diff(projectId: string): Promise<AnalysisDiff | null> {
    const data = await this.read(projectId)

    if (!data.sealed || !data.draft) {
      return null
    }

    return generateAnalysisDiff(data.sealed, data.draft)
  }

  /**
   * Check if sealed analysis is stale (commit hash differs from current HEAD).
   */
  checkStaleness(sealedCommit: string | null, currentCommit: string | null): StalenessCheck {
    if (!sealedCommit) {
      return {
        isStale: false,
        sealedCommit: null,
        currentCommit,
        message: 'No sealed analysis. Run `p. sync` then `p. seal`.',
      }
    }

    if (!currentCommit) {
      return {
        isStale: true,
        sealedCommit,
        currentCommit: null,
        message: 'Cannot determine current commit. Analysis may be stale.',
      }
    }

    if (sealedCommit !== currentCommit) {
      return {
        isStale: true,
        sealedCommit,
        currentCommit,
        message: `Analysis is stale: sealed at ${sealedCommit}, HEAD is ${currentCommit}. Run \`p. sync\` + \`p. seal\` to update.`,
      }
    }

    return {
      isStale: false,
      sealedCommit,
      currentCommit,
      message: 'Analysis is current.',
    }
  }

  /**
   * Verify the integrity of a sealed analysis by recomputing its signature.
   */
  async verify(projectId: string): Promise<{ valid: boolean; message: string }> {
    const data = await this.read(projectId)

    if (!data.sealed) {
      return { valid: false, message: 'No sealed analysis to verify.' }
    }

    if (!data.sealed.signature) {
      return { valid: false, message: 'Sealed analysis has no signature.' }
    }

    const expected = this.computeSignature({
      ...data.sealed,
      // Strip signature and sealedAt before recomputing — they weren't part of the original hash
      signature: undefined,
      sealedAt: undefined,
    })

    if (expected === data.sealed.signature) {
      return { valid: true, message: 'Signature verified. Analysis integrity confirmed.' }
    }

    return {
      valid: false,
      message: `Signature mismatch. Expected ${expected}, got ${data.sealed.signature}. Analysis may have been modified.`,
    }
  }

  /**
   * Perform semantic verification on analysis results (PRJ-270).
   * Validates that analysis data matches actual project state:
   * - Frameworks exist in package.json
   * - Languages match file extensions
   * - Pattern locations reference real files
   * - File count is accurate
   * - Anti-pattern files exist
   */
  async semanticVerify(
    projectId: string,
    projectPath: string
  ): Promise<SemanticVerificationReport> {
    const data = await this.read(projectId)

    // Get the active analysis (sealed if available, otherwise draft)
    const analysis = data.sealed ?? data.draft

    if (!analysis) {
      // No analysis to verify - return empty report
      return {
        passed: false,
        checks: [
          {
            name: 'Analysis availability',
            passed: false,
            error: 'No analysis available. Run `p. sync` to generate.',
            durationMs: 0,
          },
        ],
        totalMs: 0,
        failedCount: 1,
        passedCount: 0,
      }
    }

    // Run semantic verification
    return await semanticVerify(analysis, projectPath)
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Compute SHA-256 signature for analysis data.
   * Deterministic: same input always produces same hash.
   */
  private computeSignature(analysis: AnalysisSchema): string {
    // Build a canonical representation (exclude volatile fields)
    const canonical = {
      projectId: analysis.projectId,
      languages: analysis.languages,
      frameworks: analysis.frameworks,
      packageManager: analysis.packageManager,
      sourceDir: analysis.sourceDir,
      testDir: analysis.testDir,
      configFiles: analysis.configFiles,
      fileCount: analysis.fileCount,
      patterns: analysis.patterns,
      antiPatterns: analysis.antiPatterns,
      analyzedAt: analysis.analyzedAt,
      commitHash: analysis.commitHash,
    }

    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  }
}

export const analysisStorage = new AnalysisStorage()
export default analysisStorage
export type { AnalysisStoreData, SealResult, StalenessCheck, RollbackResult }
export type { SemanticVerificationReport } from '../schemas/analysis'
export type { AnalysisDiff, AnalysisDiffItem } from '../types/services.js'
