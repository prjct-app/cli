/**
 * Named constants for workflow rule timeouts (replaces magic numbers
 * scattered across `addRule(...)` calls in the rule-action handlers).
 *
 * Numbers are in milliseconds. Picking values is part of product
 * design — change them here, not at the call site.
 */

export const WORKFLOW_TIMEOUTS = {
  /** Generic shell hook (lint plugin, custom step). */
  HOOK_DEFAULT_MS: 60_000,
  /** Gate that runs a shell command — typical CI-style check. */
  GATE_DEFAULT_MS: 60_000,
  /** Gate that should be near-instant (branch checks, file existence). */
  GATE_QUICK_MS: 5_000,
  /** Lint step — usually fast but can balloon on large repos. */
  STEP_LINT_MS: 120_000,
  /** Test step — the loudest tail in CI. */
  STEP_TEST_MS: 300_000,
  /** Instruction rules don't shell out, so the timeout is irrelevant. */
  INSTRUCTION_MS: 0,
} as const
