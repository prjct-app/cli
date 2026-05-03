/**
 * Spec Service — orchestration for SDD specs.
 *
 * Bridges `spec-storage` (SQLite) and `projectMemory` (memory event
 * stream) so:
 *   - Specs are queryable as first-class entities (status, links, etc.)
 *   - Specs surface in `prjct context memory spec` recall
 *   - Vault regen (`prjct sync`, on `remember`/`ship`/etc) renders specs
 *     to ~/Documents/prjct/<slug>/_generated/specs/<slug>.md
 *
 * Service is intentionally thin — Claude does the heavy lifting
 * (interactive spec drafting, audit-spec subagent dispatch). The
 * service owns persistence + invariants only.
 */

import configManager from '../infrastructure/config-manager'
import { projectMemory } from '../memory/project-memory'
import { specStorage } from '../storage/spec-storage'
import {
  type Spec,
  type SpecContent,
  SpecContentSchema,
  type SpecReview,
  type SpecReviewer,
  type SpecStatus,
} from '../types/spec'
import { getTimestamp } from '../utils/date-helper'

class SpecService {
  /**
   * Create a draft spec. Goal is required (a spec without a goal is
   * just an inbox item — use `prjct capture` for that).
   */
  async create(
    projectPath: string,
    args: {
      title: string
      content: Partial<SpecContent> & { goal: string }
      tags?: Record<string, string>
    }
  ): Promise<Spec> {
    const projectId = await this.requireProjectId(projectPath)
    const validated = SpecContentSchema.parse({
      goal: args.content.goal,
      eli10: args.content.eli10 ?? '',
      stakes: args.content.stakes ?? '',
      acceptance_criteria: args.content.acceptance_criteria ?? [],
      scope: args.content.scope ?? [],
      out_of_scope: args.content.out_of_scope ?? [],
      risks: args.content.risks ?? [],
      test_plan: args.content.test_plan ?? [],
      reviews: args.content.reviews,
      linked_tasks: args.content.linked_tasks ?? [],
      notes: args.content.notes ?? '',
    })

    const spec = specStorage.create(projectId, {
      title: args.title,
      content: validated,
      tags: args.tags,
    })

    // Mirror to memory event stream so `prjct context memory spec` finds it.
    await projectMemory.remember(projectPath, {
      type: 'spec',
      content: `${spec.title}\n\nGoal: ${spec.content.goal}`,
      tags: { ...(args.tags ?? {}), spec_id: spec.id, status: spec.status },
      source: spec.id,
      provenance: 'declared',
    })

    return spec
  }

  async get(projectPath: string, id: string): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    return specStorage.get(projectId, id)
  }

  async list(
    projectPath: string,
    filter: { status?: SpecStatus; includeArchived?: boolean } = {}
  ): Promise<Spec[]> {
    const projectId = await this.requireProjectId(projectPath)
    return specStorage.list(projectId, filter)
  }

  async setStatus(projectPath: string, id: string, status: SpecStatus): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    const next = specStorage.setStatus(projectId, id, status)
    if (next) {
      await projectMemory.remember(projectPath, {
        type: 'spec',
        content: `Spec status → ${status}: ${next.title}`,
        tags: { spec_id: id, status, event: 'status_change' },
        source: id,
      })
    }
    return next
  }

  async update(projectPath: string, id: string, content: SpecContent): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    return specStorage.updateContent(projectId, id, content)
  }

  async recordReview(
    projectPath: string,
    id: string,
    reviewer: SpecReviewer,
    review: Omit<SpecReview, 'ts'>
  ): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    const spec = specStorage.get(projectId, id)
    if (!spec) return null

    const fullReview: SpecReview = { ...review, ts: getTimestamp() }
    const nextContent: SpecContent = {
      ...spec.content,
      reviews: {
        ...(spec.content.reviews ?? {}),
        [reviewer]: fullReview,
      },
    }
    const updated = specStorage.updateContent(projectId, id, nextContent)
    if (updated && this.allReviewsPass(updated.content)) {
      // All three reviewers pass → auto-promote draft to reviewed.
      if (updated.status === 'draft') {
        return specStorage.setStatus(projectId, id, 'reviewed')
      }
    }
    return updated
  }

  async linkTask(projectPath: string, specId: string, taskId: string): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    return specStorage.linkTask(projectId, specId, taskId)
  }

  async ship(projectPath: string, specId: string, pr?: number): Promise<Spec | null> {
    const projectId = await this.requireProjectId(projectPath)
    if (pr !== undefined) {
      specStorage.setShippedPr(projectId, specId, pr)
    }
    return specStorage.setStatus(projectId, specId, 'shipped')
  }

  /**
   * Acceptance gate: returns the criteria still un-satisfied. The CLI
   * doesn't auto-tick boxes — caller (or Claude) marks each criterion
   * met by passing the `met` set.
   */
  unmetCriteria(spec: Spec, met: Set<string> = new Set()): string[] {
    return spec.content.acceptance_criteria.filter((c) => !met.has(c))
  }

  private allReviewsPass(content: SpecContent): boolean {
    const r = content.reviews
    if (!r) return false
    return (
      r.strategic?.verdict === 'pass' &&
      r.architecture?.verdict === 'pass' &&
      r.design?.verdict === 'pass'
    )
  }

  private async requireProjectId(projectPath: string): Promise<string> {
    const config = await configManager.readConfig(projectPath)
    if (!config?.projectId) {
      throw new Error('not a prjct project (run `prjct init` first)')
    }
    return config.projectId
  }
}

export const specService = new SpecService()
export type { SpecService }
