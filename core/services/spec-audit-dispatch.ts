/**
 * audit-spec dispatch — DYNAMIC lenses.
 *
 * prjct's audit used to dispatch a FIXED trio (strategic / architecture /
 * design) for every spec — the "predefined personas" anti-pattern. This
 * module makes the lens set emerge from the spec:
 *
 *   - `selectReviewers(content)` — a cheap, deterministic BASELINE. No LLM:
 *     prjct stays a thin CLI. `architecture` is the floor; other lenses are
 *     added when the spec's text signals their concern. The agent can
 *     override via `prjct spec audit <id> --lenses a,b,c`.
 *   - `renderAuditDispatch(id, title, content, lenses?)` — the single dispatch
 *     builder shared by the CLI and the MCP tool (previously duplicated; the
 *     MCP copy pasted the spec body — fixed here by pointing every reviewer
 *     at `prjct spec show <id> --md`).
 *   - `reviewsGatePassed(content)` — the auto-promote gate: every SELECTED
 *     lens passed. Legacy specs (empty selected_reviewers) fall back to the
 *     three baseline lenses.
 *
 * Lens vocabulary is OPEN — any lowercase string is a valid lens (mirrors how
 * memory `type` accepts any string); agent-invented lenses get a generic
 * rubric and resolve to the sonnet reviewer tier via the model policy fallback.
 */

import { renderModelDirective } from '../schemas/model'
import type { SpecContent } from '../types/spec'

export interface LensSpec {
  /** Short parenthetical shown after the lens name in the dispatch. */
  label: string
  /**
   * Lens-specific reviewer instruction. The renderer prepends the
   * "first read the spec from prjct" line and appends the verdict ask.
   */
  rubric: string
}

export const LENS_CATALOG: Record<string, LensSpec> = {
  strategic: {
    label: 'scope sanity',
    rubric:
      'Review it for strategic soundness. Does it solve a real problem? Is the goal worth the cost? Is out_of_scope coherent with goal? Is the spec OVER- or UNDER-scoped? Cross-reference relevant prior memory via `prjct context memory <topic>` if useful.',
  },
  architecture: {
    label: 'eng feasibility',
    rubric:
      'Then read the codebase paths listed above (Read tool, cap 10 files). Can this be built ON TOP of what exists? Does the spec contradict an existing state machine, schema, or contract? What failure modes / dependencies / edge cases are missing? Include a short ASCII diagram + cite at least one concrete symbol from the codebase in notes when applicable.',
  },
  design: {
    label: 'UX/DX',
    rubric:
      'Rate 0-10 across {clarity, ergonomics, consistency, accessibility} for the user-facing or developer-facing surface. If scope touches existing UI/CLI patterns (read the listed paths), consistency must be judged against those — not against your priors. Pass only if all dimensions ≥6; include the four scores in notes.',
  },
  security: {
    label: 'threat surface',
    rubric:
      'Threat-model the surface this spec defines: authn/authz, secret handling, input validation & injection, sandbox/exec boundaries, network egress, PII. Name the highest-severity gap and whether the acceptance criteria mitigate it. Pass only if no high-severity gap is left unmitigated.',
  },
  data: {
    label: 'data integrity',
    rubric:
      'Review the data design. Are schema / migration changes backward-compatible and reversible? Index / query implications, write amplification, migration idempotency, data-loss risk on partial failure. Pass only if the migration path is safe and rollbackable.',
  },
  performance: {
    label: 'perf profile',
    rubric:
      'Identify the hottest path this spec touches and its expected complexity / allocation / IO profile. Do the acceptance criteria bound latency or throughput where it matters? Name the single biggest perf risk. Pass only if no hot-path regression is left unbounded.',
  },
}

const GENERIC_RUBRIC =
  'Review the spec through this lens. Identify the most important risk or gap it implies and whether the acceptance criteria address it.'

/**
 * Deterministic BASELINE lens set for a spec. `architecture` is always
 * included (feasibility floor); the rest are added when the spec's combined
 * text signals their concern. This is the floor, not the final word — the
 * agent can adjust via `--lenses`.
 */
export function selectReviewers(content: SpecContent): string[] {
  const lenses = new Set<string>(['architecture'])

  const hay = [
    content.goal,
    content.eli10,
    content.stakes,
    ...content.scope,
    ...content.out_of_scope,
    ...content.acceptance_criteria,
    ...content.risks.flatMap((r) => [r.risk, r.mitigation]),
  ]
    .join(' ')
    .toLowerCase()

  if (content.stakes.trim() !== '' || content.scope.length >= 4 || content.risks.length >= 2) {
    lenses.add('strategic')
  }
  if (/\b(cli|command|ui|ux|api|endpoint|flag|output|render|prompt)\b/.test(hay))
    lenses.add('design')
  if (
    /\b(auth|secret|token|crypto|password|payment|pii|permission|sandbox|exec|network)\b/.test(hay)
  )
    lenses.add('security')
  if (/\b(schema|migration|sql|db|database|query|index|table|storage)\b/.test(hay))
    lenses.add('data')
  if (/\b(perf|latency|throughput|hot path|scale|cache|cold start)\b/.test(hay))
    lenses.add('performance')

  return [...lenses]
}

/**
 * Auto-promote gate. Passes when every SELECTED lens recorded verdict=pass.
 * Legacy specs (selected_reviewers empty — audited before dynamic lenses)
 * fall back to the three baseline lenses.
 */
export function reviewsGatePassed(content: SpecContent): boolean {
  const r = content.reviews
  if (!r) return false
  const selected = content.selected_reviewers
  if (selected.length > 0) {
    return selected.every((lens) => r[lens]?.verdict === 'pass')
  }
  return (
    r.strategic?.verdict === 'pass' &&
    r.architecture?.verdict === 'pass' &&
    r.design?.verdict === 'pass'
  )
}

/**
 * Pull file/dir paths from spec.scope entries (entries are typically
 * "core/sync/sync-manager.ts — desc" — peel off the path-like prefix).
 * Cap to 12 to stay within reviewer-tool budgets.
 */
function extractScopePaths(scope: string[]): string[] {
  const out: string[] = []
  for (const entry of scope) {
    const m = entry.match(/[a-zA-Z0-9_./-]+\.[a-zA-Z]+/) ?? entry.match(/[a-zA-Z0-9_./-]+\//)
    if (m && !out.includes(m[0])) out.push(m[0])
    if (out.length >= 12) break
  }
  return out
}

/**
 * The dispatch prompt emitted by `prjct spec audit`. Claude reads this, runs
 * one Agent call per selected lens IN PARALLEL (one tool-use block each, same
 * message), then writes each verdict back via `prjct spec record-review`.
 *
 * The spec body is NEVER embedded — each reviewer runs `prjct spec show <id>
 * --md` itself in its own fresh context.
 */
export function renderAuditDispatch(
  id: string,
  title: string,
  content: SpecContent,
  lenses?: string[]
): string {
  const chosen = lenses && lenses.length > 0 ? lenses : selectReviewers(content)
  const scopePaths = extractScopePaths(content.scope)
  const scopeBlock =
    scopePaths.length > 0
      ? `\n\n## Codebase paths to read (from spec.scope)\n${scopePaths.map((p) => `- \`${p}\``).join('\n')}\n\nEach reviewer SHOULD use the Read tool on these paths (cap 10 per reviewer) to ground the verdict in the actual code. Cite specific symbols / files / line numbers in notes when applicable.`
      : '\n\n## Codebase paths\n_No path-shaped scope entries found. Reviewers judge the spec body alone._'

  const reviewerSections: string[] = []
  chosen.forEach((lens, i) => {
    const spec = LENS_CATALOG[lens]
    const label = spec ? spec.label : 'custom lens'
    const rubric = spec ? spec.rubric : GENERIC_RUBRIC
    const letter = String.fromCharCode(65 + (i % 26))
    reviewerSections.push(
      `## Reviewer ${letter} — ${lens} (${label})`,
      `Subagent prompt: "First run \`prjct spec show ${id} --md\` to read the spec. ${rubric} Return verdict (pass|fail) and 2-4 sentence notes."`,
      ''
    )
  })

  const runLine =
    chosen.length === 1
      ? 'Run this review subagent via the Agent tool. It reads the spec FROM prjct (command below), reads the relevant codebase paths, applies its rubric, then returns a structured verdict.'
      : `Run these ${chosen.length} review subagents IN PARALLEL via the Agent tool — one tool-use block per lens, all in the SAME message so they run concurrently. Each subagent reads the spec FROM prjct (command below), reads the relevant codebase paths, applies its rubric, then returns a structured verdict.`

  return [
    `# audit-spec dispatch — ${title}`,
    '',
    `Spec id: \`${id}\``,
    '',
    `Selected lenses for this spec: **${chosen.join(', ')}**. This is the baseline prjct computed from the spec — re-run \`prjct spec audit ${id} --lenses <comma,separated>\` to adjust the set before dispatching (add a lens the risk surface demands, drop one that is irrelevant).`,
    '',
    runLine,
    '',
    '## Where the spec lives — read it from prjct, it is NOT in this prompt',
    `The plan lives in prjct (SQLite + regenerated vault), never duplicated into a dispatch payload. Each reviewer subagent runs \`prjct spec show ${id} --md\` itself, in its own fresh context window, to read the full spec. Do NOT paste the spec body into the subagent prompts — point them at that command. (Same rule for any memory the reviewer wants: \`prjct context memory <topic>\` — pulled by the subagent, not pre-pasted by you.)`,
    '',
    '## Model policy (perf — read before dispatching)',
    `${renderModelDirective('spec-review')} The SAME applies to every lens — they judge a spec, they do not implement, so they must NOT run on the parent's max model. Hand reviewers the spec-read COMMAND and the codebase PATHS + the Read tool — never paste spec body or file contents into their prompts.`,
    scopeBlock,
    '',
    ...reviewerSections,
    '## After dispatch',
    'For each lens that returns:',
    `  prjct spec record-review ${id} --reviewer <${chosen.join('|')}> --verdict <pass|fail> --notes "<their notes>"`,
    '',
    `When all selected lenses (${chosen.join(', ')}) are recorded with verdict=pass, the spec auto-promotes from \`draft\` → \`reviewed\`.`,
  ].join('\n')
}
