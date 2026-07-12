/**
 * Safe Artifact Repo (Claude compliance-store pattern, local-first).
 *
 * Controlled, queryable view of agent *outputs* already persisted in SQLite
 * (judgment ledgers, ship receipts, handoffs, checkpoints). Not a second
 * markdown vault — a single read surface so agents can audit "what was
 * produced and under which gates" without grepping git history.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { judgmentLedgerStorage } from '../storage/judgment-ledger-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { getErrorMessage } from '../types/fs'

export type SafeArtifactKind =
  | 'judgment_ledger'
  | 'ship_receipt'
  | 'handoff'
  | 'checkpoint'
  | 'session_continuity'

export interface SafeArtifact {
  kind: SafeArtifactKind
  id: string
  /** ISO timestamp when known. */
  at: string | null
  /** One-line human summary. */
  summary: string
  /** Content fingerprint for audit (not a secret). */
  contentHash: string
  /** Gate / compliance tags (intensity, verdict, version, …). */
  gates: Record<string, string>
}

export interface SafeArtifactsReport {
  projectId: string
  count: number
  artifacts: SafeArtifact[]
}

function hashPayload(payload: unknown): string {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function judgmentArtifact(projectId: string): SafeArtifact | null {
  const ledger = judgmentLedgerStorage.get(projectId)
  if (!ledger) return null
  const open = ledger.findings.filter(
    (f) => f.status === 'stands' || f.status === 'candidate' || f.status === 'open'
  ).length
  return {
    kind: 'judgment_ledger',
    id: ledger.id,
    at: ledger.updatedAt || ledger.createdAt,
    summary: `Judgment ${ledger.verdict} · intensity=${ledger.intensity} · findings=${ledger.findings.length} (openish=${open}) · target=${ledger.target}`,
    contentHash: hashPayload({
      id: ledger.id,
      verdict: ledger.verdict,
      intensity: ledger.intensity,
      findings: ledger.findings.map((f) => f.id),
      contentBound: ledger.contentBound?.treeHash,
    }),
    gates: {
      verdict: ledger.verdict,
      intensity: ledger.intensity,
      fixRound: String(ledger.fixRound),
      ...(ledger.contentBound?.treeHash
        ? { contentBound: ledger.contentBound.treeHash.slice(0, 12) }
        : {}),
    },
  }
}

async function shipArtifacts(projectId: string, limit: number): Promise<SafeArtifact[]> {
  const ships = await shippedStorage.getRecent(projectId, limit)
  return ships.map((s) => ({
    kind: 'ship_receipt' as const,
    id: s.id,
    at: s.shippedAt ?? null,
    summary: `Ship ${s.version ? `v${s.version} ` : ''}${s.name}`.trim(),
    contentHash: hashPayload({
      id: s.id,
      name: s.name,
      version: s.version,
      shippedAt: s.shippedAt,
    }),
    gates: {
      version: s.version || 'none',
      ...(s.type ? { type: s.type } : {}),
    },
  }))
}

async function handoffArtifacts(projectId: string, limit: number): Promise<SafeArtifact[]> {
  try {
    const { listHandoffs } = await import('../storage/handoff-storage')
    const pending = listHandoffs(projectId, { status: 'pending', limit })
    return pending.map((h) => ({
      kind: 'handoff' as const,
      id: h.id,
      at: h.createdAt ?? null,
      summary: `Handoff ${h.fromAgent}→${h.toAgent}: ${h.reason.slice(0, 80)}`,
      contentHash: hashPayload({
        id: h.id,
        taskId: h.taskId,
        to: h.toAgent,
        status: h.status,
        reason: h.reason,
      }),
      gates: {
        status: h.status,
        to: h.toAgent,
        from: h.fromAgent,
      },
    }))
  } catch {
    return []
  }
}

async function checkpointArtifacts(projectId: string, limit: number): Promise<SafeArtifact[]> {
  try {
    const dir = path.join(pathManager.getGlobalProjectPath(projectId), 'checkpoints')
    const names = await fs.readdir(dir).catch(() => [] as string[])
    const jsons = names
      .filter((n) => n.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
    const out: SafeArtifact[] = []
    for (const name of jsons) {
      try {
        const raw = await fs.readFile(path.join(dir, name), 'utf-8')
        const doc = JSON.parse(raw) as {
          title?: string
          createdAt?: string
          git?: { branch?: string }
        }
        out.push({
          kind: 'checkpoint',
          id: name,
          at: doc.createdAt ?? null,
          summary: `Checkpoint "${doc.title ?? name}"${doc.git?.branch ? ` @ ${doc.git.branch}` : ''}`,
          contentHash: hashPayload(raw),
          gates: { file: name },
        })
      } catch {
        /* skip corrupt */
      }
    }
    return out
  } catch {
    return []
  }
}

export interface ListSafeArtifactsOptions {
  /** Max ships + handoffs + checkpoints each (default 5). Judgment is 0–1. */
  limit?: number
  kinds?: SafeArtifactKind[]
}

/**
 * List controlled agent-output artifacts for a project.
 * Pure read; no writes. Fail-soft per source.
 */
export async function listSafeArtifacts(
  projectId: string,
  options: ListSafeArtifactsOptions = {}
): Promise<SafeArtifactsReport> {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 20))
  const allow = options.kinds ? new Set(options.kinds) : null
  const artifacts: SafeArtifact[] = []

  if (!allow || allow.has('judgment_ledger')) {
    const j = judgmentArtifact(projectId)
    if (j) artifacts.push(j)
  }
  if (!allow || allow.has('ship_receipt')) {
    try {
      artifacts.push(...(await shipArtifacts(projectId, limit)))
    } catch (e) {
      void getErrorMessage(e)
    }
  }
  if (!allow || allow.has('handoff')) {
    artifacts.push(...(await handoffArtifacts(projectId, limit)))
  }
  if (!allow || allow.has('checkpoint')) {
    artifacts.push(...(await checkpointArtifacts(projectId, limit)))
  }
  if (!allow || allow.has('session_continuity')) {
    try {
      const { loadSessionContinuity } = await import('./session-continuity')
      const stamp = loadSessionContinuity(projectId)
      if (stamp) {
        artifacts.push({
          kind: 'session_continuity',
          id: 'session:continuity',
          at: stamp.landedAt,
          summary: stamp.cycleDescription
            ? `Last land · cycle "${stamp.cycleDescription.slice(0, 60)}"`
            : 'Last land · no open cycle',
          contentHash: hashPayload(stamp),
          gates: {
            handoff: stamp.handoffWrote ? 'yes' : 'no',
            receipt: stamp.receiptWrote ? 'yes' : 'no',
            ...(stamp.pressureLevel ? { pressure: stamp.pressureLevel } : {}),
          },
        })
      }
    } catch {
      /* best-effort */
    }
  }

  // Newest first when timestamps exist
  artifacts.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0
    const tb = b.at ? Date.parse(b.at) : 0
    return tb - ta
  })

  return { projectId, count: artifacts.length, artifacts }
}

export function formatSafeArtifactsMd(report: SafeArtifactsReport): string {
  const lines: string[] = [
    '# prjct safe artifacts',
    '',
    `Project \`${report.projectId}\` · **${report.count}** artifact(s)`,
    '',
    'Controlled agent outputs (judgment · ships · handoffs · checkpoints). Not a markdown vault.',
    '',
  ]
  if (report.artifacts.length === 0) {
    lines.push('_No artifacts yet — open judgment, ship, handoff, or `prjct context-save`._')
    lines.push('')
    return lines.join('\n')
  }
  lines.push('| Kind | Id | At | Summary | Hash | Gates |')
  lines.push('|---|---|---|---|---|---|')
  for (const a of report.artifacts) {
    const gates = Object.entries(a.gates)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    const at = a.at ? a.at.slice(0, 19) : '—'
    const sum = a.summary.replace(/\|/g, '\\|').slice(0, 100)
    lines.push(
      `| ${a.kind} | \`${a.id.slice(0, 12)}\` | ${at} | ${sum} | \`${a.contentHash}\` | ${gates || '—'} |`
    )
  }
  lines.push('')
  return lines.join('\n')
}

export function formatSafeArtifactsJson(report: SafeArtifactsReport): Record<string, unknown> {
  return {
    projectId: report.projectId,
    count: report.count,
    artifacts: report.artifacts,
  }
}
