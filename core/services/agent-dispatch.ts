/**
 * Provider-aware multi-agent dispatch — the harness runs on ANY rig.
 *
 * prjct's multi-agent flows (audit-spec, review fan-out) emit dispatch
 * instructions; the host executes them. Claude Code has a native subagent tool,
 * so it dispatches real parallel subagents. Other rigs (Gemini, Codex, …) have
 * no subagent tool, so the same fan-out is EMULATED on a single agent: run each
 * unit as a fresh, isolated pass. Either way the per-role model comes from the
 * sovereignty policy via the live-rig bridge — so the architecture, not just
 * the prose, is portable across brains.
 */

import { getActiveProvider } from '../infrastructure/ai-provider'
import {
  type AgentRole,
  renderModelDirective,
  renderModelDirectiveForProvider,
} from '../schemas/model'
import type { AIProviderName } from '../types/provider'

export interface DispatchMechanism {
  provider: AIProviderName
  /** True when the rig has a native subagent tool (Claude). */
  native: boolean
  /** How to run `count` reviewers/workers concurrently (or emulated). */
  runLine(count: number): string
  /** The model directive for a role on this rig. */
  modelDirective(role: AgentRole): string
}

function claudeMechanism(): Omit<DispatchMechanism, 'provider'> {
  return {
    native: true,
    modelDirective: (role) => renderModelDirective(role),
    runLine: (count) =>
      count === 1
        ? 'Run this review subagent via the Agent tool. It reads the spec FROM prjct (command below), reads the relevant codebase paths, applies its rubric, then returns a structured verdict.'
        : `Run these ${count} review subagents IN PARALLEL via the Agent tool — one tool-use block per lens, all in the SAME message so they run concurrently. Each subagent reads the spec FROM prjct (command below), reads the relevant codebase paths, applies its rubric, then returns a structured verdict.`,
  }
}

function emulatedMechanism(provider: AIProviderName): Omit<DispatchMechanism, 'provider'> {
  return {
    native: false,
    modelDirective: (role) => renderModelDirectiveForProvider(role, provider),
    runLine: (count) =>
      count === 1
        ? `This rig (${provider}) has no native subagent tool. Run this review as ONE focused, fresh pass: read the spec FROM prjct (command below) and the relevant codebase paths, apply the rubric, return a structured verdict — do not carry over assumptions from the planning context.`
        : `This rig (${provider}) has no native subagent tool, so EMULATE the fan-out: run the ${count} reviews ONE AT A TIME, each as a fresh, independent pass. For each — reset your working assumptions, state the lens you are playing, read the spec FROM prjct (command below) + the relevant paths, apply that lens's rubric, return its verdict, then move on. Keep them isolated: a later lens must not inherit an earlier lens's framing.`,
  }
}

/**
 * Resolve the dispatch mechanism for the active rig. Pass `projectProvider` to
 * pin it (deterministic — skips CLI detection); omit it to detect the installed
 * rig. Claude → native subagents; everything else → emulated fresh-context
 * fan-out. The per-role model always flows from the policy.
 */
export async function resolveDispatchMechanism(
  projectProvider?: AIProviderName
): Promise<DispatchMechanism> {
  const provider = (await getActiveProvider(projectProvider)).name
  const base = provider === 'claude' ? claudeMechanism() : emulatedMechanism(provider)
  return { provider, ...base }
}

/**
 * The crew (leader/implementer/reviewer) EMULATED for a rig with no native
 * subagent tool: one agent plays the three roles in sequence, each a fresh
 * isolated pass, with the per-role model from the policy. The native Claude
 * crew (separate `.claude/agents/` files dispatched via the Agent tool) has no
 * equivalent on Gemini/Codex/etc., so `prjct crew install` writes this protocol
 * instead — the multi-agent architecture still runs, just on one brain.
 */
export function buildEmulatedCrewProtocol(m: DispatchMechanism, checkpoints: string): string {
  const cp = checkpoints.trim()
  return `${[
    `# prjct crew — emulated on ${m.provider}`,
    '',
    `This rig has no native subagent tool, so the crew runs as ONE agent playing three roles IN SEQUENCE — each a fresh, isolated pass. Reset your working assumptions between roles; a later role must never inherit an earlier role's framing.`,
    '',
    '## Roles (run in order)',
    '',
    `1. **Leader (orchestrate, do not write code).** Run \`prjct work --md\` to load the cycle + related context, decompose the request into ONE slice, and name its file scope. ${m.modelDirective('orchestrator')}`,
    `2. **Implementer (build).** Implement exactly that slice + its tests; self-verify before handing off (run the project's test command). ${m.modelDirective('implementer')}`,
    `3. **Reviewer (judge, do not edit).** Review the diff against the checkpoints below; reply \`VERDICT: APPROVED\` or \`VERDICT: CHANGES_REQUESTED\` with notes. ${m.modelDirective('reviewer')}`,
    '',
    '## Checkpoints the reviewer applies',
    '',
    cp.length > 0
      ? cp
      : '_No project checkpoints set — review against the project conventions. Set them with `prjct crew checkpoints set`._',
    '',
    '## Rules',
    "- Point, don't carry: the plan/work/memory live in prjct — read them in each role (`prjct work --md`, `prjct spec show <id> --md`, `prjct context memory <topic>`), never paste them between roles.",
    '- On APPROVED: run `prjct crew record-run …` (one durable row), THEN close the work cycle. On CHANGES_REQUESTED: loop back to the implementer role with the notes.',
    '- Persist ONLY through prjct verbs — SQLite + the regenerated vault are the only allowed surfaces. Never write reports/audits to disk.',
  ].join('\n')}\n`
}
