/**
 * prjct MCP Server
 *
 * Exposes project data via Model Context Protocol (48 tools).
 * Wraps existing storage and context modules — no new logic.
 *
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerCodeIntelTools } from './tools/code-intel'
import { registerFileTools } from './tools/files'
import { registerMemoryTools } from './tools/memory'
import { registerProjectTools } from './tools/project'
import { registerSpecTools } from './tools/spec'
import { registerWorkflowTools } from './tools/workflow'

/**
 * MCP server instructions — describe WHAT prjct holds, never prescribe
 * step-by-step HOW to use it. Deterministic pipelines (“first do X, then
 * Y”) are harness behavior; this template is the canonical anti-harness
 * shape (Anthropic skill docs): `Use when` + `What's here` + `Gotchas`.
 *
 * If you find yourself adding a numbered list of steps here, stop.
 */
const PRJCT_INSTRUCTIONS = `# prjct — Spec-Driven Development + project memory

Use when the user describes work, asks for project memory, or wants to run a registered workflow. **Recognize intent — don't wait for the user to type prjct commands.**

## SDD canonical sequence

When the user describes a feature, fix, or initiative *with goals or stakes attached*, default to the SDD flow:

\`\`\`
spec → audit-spec → task (linked to spec) → implement → ship (acceptance gate) → remember learning
\`\`\`

- **\`prjct_spec_create\`** — when the user describes WHAT they want to build / fix and WHY ("we need rate limiting", "the onboarding is broken"). Draft a spec with goal, eli10, stakes, acceptance_criteria, scope, out_of_scope, risks, test_plan.
- **\`prjct_spec_audit\`** — before any code: dispatch three review subagents in PARALLEL (strategic / architecture / design). Persist verdicts via \`prjct_spec_record_review\`. All three pass → spec auto-promotes draft → reviewed.
- **\`prjct_spec_link_task\`** — when the user starts implementing, link the task to the spec so ship can gate.
- **\`prjct_spec_ship\`** — after merge, mark the spec shipped + record the PR number.

Skip the SDD flow only for: routine captures, single-file fixes, doc tweaks, conversational Q&A. If work touches >1 file, ships to users, or takes >30 min — default to spec first.

## What's here

- **Specs** — first-class SDD artifacts (Goal/Acceptance/Scope/Risks). Tools: \`prjct_spec_*\`.
- **Memory** (facts, decisions, learnings, gotchas, patterns, anti-patterns, insights, questions, sources, people, okrs, shipped work, inbox, **spec**). Save/recall via memory tools.
- **Session + task state** via the session and project tools. Tasks accept a \`linked_spec_id\` for the SDD gate.
- **Workflows** registered in this project (can be run, listed, edited).
- **Code intelligence** helpers (impact, related context) for navigating repos.
- **Patterns** detected by analysis.

## Gotchas

- Recognize intent in any language (es/en) — the verbs are language-agnostic.
- Memory is best-effort — never assume recall returned everything; it's a query, not a lookup.
- Topic keys are free-form strings; don't invent new vocabularies when existing ones fit.
- Not every project defines every memory type — if one is empty, that's fine.
- Saving a secret-looking string is refused by default. Re-save with a scrubbed version.
- A spec without acceptance_criteria is just an inbox item — fill them.`

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'prjct', version: '1.0.0' },
    { instructions: PRJCT_INSTRUCTIONS }
  )

  registerMemoryTools(server)
  registerProjectTools(server)
  registerFileTools(server)
  registerWorkflowTools(server)
  registerCodeIntelTools(server)
  registerSpecTools(server)

  return server
}
