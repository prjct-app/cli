/**
 * Triage → orchestration. The harness (`buildTaskHarness`) classifies each
 * task into a level (H0-H3), kind, and risk. That classification gated
 * EVIDENCE, but nothing routed the *LLM resource* — so a trivial docs edit and
 * a security migration both ran on whatever (often frontier) model the parent
 * agent happened to be on, and any subagents INHERITED that expensive model
 * (mem_3432). That is burning tokens.
 *
 * This module turns the triage into a concrete, correct orchestration plan:
 * which model tier + effort THIS task deserves, whether it needs a spec (SDD),
 * tests-first (TDD), and whether to do it directly or fan out to a group of
 * subagents — and it always reminds the agent to SET each subagent's model
 * (they inherit the parent's otherwise). The project's `sdd`/`tdd` modes are
 * reconciled as a FLOOR over the risk-based default (strict forces the
 * ceremony even on a low-risk task; the triage can only ADD ceremony, never
 * remove what a mode requires).
 *
 * Deterministic + free (no LLM call to decide how to spend the LLM).
 */

import type { HarnessKind, HarnessLevel, HarnessRisk, TaskHarness } from '../schemas/state'

/** Rig-agnostic capability tier (see core/schemas/model.ts MODEL_TIERS). */
export type ModelTier = 'fast' | 'balanced' | 'frontier'
export type Effort = 'low' | 'medium' | 'high'
/** none = skip; frame = lightweight `prjct spec`; reviewed = spec + audit panel. */
export type SpecCeremony = 'none' | 'frame' | 'reviewed'
/** none = skip; after = test the change; first = tests before implementation. */
export type TestCeremony = 'none' | 'after' | 'first'
/** direct = do it yourself; parallel = independent subagents; crew = leader + review crew. */
export type FanOut = 'direct' | 'parallel' | 'crew'

export type SddMode = 'off' | 'advisory' | 'strict'
export type TddMode = 'off' | 'assist' | 'strict'

export interface OrchestrationPlan {
  model: ModelTier
  effort: Effort
  spec: SpecCeremony
  tests: TestCeremony
  fanout: FanOut
  /** Agent-facing one-block directive — how to run THIS task efficiently. */
  directive: string
}

const SPEC_RANK: Record<SpecCeremony, number> = { none: 0, frame: 1, reviewed: 2 }
const TEST_RANK: Record<TestCeremony, number> = { none: 0, after: 1, first: 2 }
const maxSpec = (a: SpecCeremony, b: SpecCeremony): SpecCeremony =>
  SPEC_RANK[a] >= SPEC_RANK[b] ? a : b
const maxTest = (a: TestCeremony, b: TestCeremony): TestCeremony =>
  TEST_RANK[a] >= TEST_RANK[b] ? a : b

/** Is this a code-touching task (docs/chore never need spec/tests)? */
function isCodeKind(kind: HarnessKind): boolean {
  return kind !== 'docs' && kind !== 'chore'
}

/** Risk-based defaults per harness level (before SDD/TDD mode floors). */
function baseline(level: HarnessLevel, kind: HarnessKind, risk: HarnessRisk): OrchestrationPlan {
  const code = isCodeKind(kind)
  switch (level) {
    case 'H0':
      // Trivial (docs/chore). Do NOT spend a frontier model on this.
      return {
        model: 'fast',
        effort: 'low',
        spec: 'none',
        tests: 'none',
        fanout: 'direct',
        directive: '',
      }
    case 'H1':
      // Simple bug/change. Fix directly on a balanced model; leave a test behind.
      return {
        model: 'balanced',
        effort: 'medium',
        spec: 'none',
        tests: code ? 'after' : 'none',
        fanout: 'direct',
        directive: '',
      }
    case 'H2':
      // Substantial feature/refactor. Frame a lightweight spec, tests first,
      // frontier for the implementation; fan out only if scope is separable.
      return {
        model: 'frontier',
        effort: 'medium',
        spec: code ? 'frame' : 'none',
        tests: code ? 'first' : 'none',
        fanout: 'parallel',
        directive: '',
      }
    default:
      // H3 — high-risk (security / architecture / migration). Full ceremony.
      return {
        model: 'frontier',
        effort: risk === 'high' ? 'high' : 'medium',
        spec: code ? 'reviewed' : 'none',
        tests: code ? 'first' : 'none',
        fanout: 'crew',
        directive: '',
      }
  }
}

/** SDD/TDD project modes are a FLOOR: they can only ADD ceremony. */
function applyModeFloors(
  plan: OrchestrationPlan,
  kind: HarnessKind,
  sdd: SddMode,
  tdd: TddMode
): OrchestrationPlan {
  if (!isCodeKind(kind)) return plan
  let spec = plan.spec
  if (sdd === 'advisory') spec = maxSpec(spec, 'frame')
  if (sdd === 'strict') spec = maxSpec(spec, 'reviewed')
  let tests = plan.tests
  if (tdd === 'assist') tests = maxTest(tests, 'after')
  if (tdd === 'strict') tests = maxTest(tests, 'first')
  return { ...plan, spec, tests }
}

const SPEC_TEXT: Record<SpecCeremony, string> = {
  none: 'no spec',
  frame: 'frame a lightweight spec (`prjct spec "<title>"`)',
  reviewed: 'reviewed spec + audit panel (`prjct spec "<title>"` → `prjct spec audit <id>`)',
}
const TEST_TEXT: Record<TestCeremony, string> = {
  none: 'no test ceremony',
  after: 'leave a regression test behind',
  first: 'tests BEFORE implementation',
}
const FANOUT_TEXT: Record<FanOut, string> = {
  direct: 'do it yourself — no subagents',
  parallel:
    'fan out to parallel subagents ONLY if scope splits into independent pieces — set EACH subagent’s model explicitly (they inherit yours otherwise: mem_3432)',
  crew: 'run a crew (`prjct crew`): leader + implementer + review lenses. Set EACH subagent’s model (Explore→fast, implementer→frontier, reviewers→balanced) — they inherit your expensive model unless you fix it',
}
const MODEL_HINT: Record<ModelTier, string> = {
  fast: 'fast/cheap model (e.g. haiku)',
  balanced: 'balanced model (e.g. sonnet)',
  frontier: 'frontier model (e.g. opus)',
}

/** Compose the agent-facing directive block from the resolved plan. */
function renderDirective(level: HarnessLevel, kind: HarnessKind, plan: OrchestrationPlan): string {
  const effortNote =
    plan.effort === 'high' ? ', HIGH effort' : plan.effort === 'low' ? ', low effort' : ''
  if (level === 'H0') {
    return `Orchestrate (${level} ${kind}): trivial — do it directly on a ${MODEL_HINT[plan.model]}${effortNote}. ${SPEC_TEXT[plan.spec]}, ${TEST_TEXT[plan.tests]}, ${FANOUT_TEXT[plan.fanout]}. Don’t burn frontier tokens on this.`
  }
  return `Orchestrate (${level} ${kind}/${plan.model}${effortNote}): ${SPEC_TEXT[plan.spec]}; ${TEST_TEXT[plan.tests]}; ${FANOUT_TEXT[plan.fanout]}.`
}

/**
 * The public entrypoint: given the triage harness and the project's SDD/TDD
 * modes, produce the orchestration plan + its agent-facing directive.
 */
export function orchestrationFor(
  harness: Pick<TaskHarness, 'level' | 'kind' | 'risk'>,
  sdd: SddMode = 'off',
  tdd: TddMode = 'off'
): OrchestrationPlan {
  const base = baseline(harness.level, harness.kind, harness.risk)
  const withFloors = applyModeFloors(base, harness.kind, sdd, tdd)
  return { ...withFloors, directive: renderDirective(harness.level, harness.kind, withFloors) }
}
