/**
 * prjct MCP Server
 *
 * Exposes project data via Model Context Protocol.
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
const PRJCT_INSTRUCTIONS = `# prjct — AI Agile OS + project memory

Use when the user describes work, asks for project memory, or wants to improve developer/LLM execution. **Recognize intent — don't wait for the user to type prjct commands.** Default to a human-in-the-loop work cycle: clarify intent, retrieve focused context, run the right workflow/gates, execute with evidence, persist synthesized learning, and measure performance.

## What's here

- **Intent briefs** — durable goal/scope/risk artifacts for complex or high-stakes work. Tools: \`prjct_spec_*\`.
- **Memory** (facts, decisions, learnings, gotchas, patterns, anti-patterns, insights, questions, sources, people, okrs, shipped work, inbox, **spec**). Save/recall via memory tools.
- **Work-cycle state** via the session and project tools. The backing storage may still use task-shaped rows for compatibility.
- **Workflows and gates** registered in this project (can be run, listed, edited). They are the quality engine of the work cycle, not a task board.
- **Code intelligence** helpers (impact, related context) for navigating repos.
- **Patterns and performance signals** detected by analysis.

## Gotchas

- Recognize intent in any language — the verbs are language-agnostic. But PERSIST in English only: every saved entry is authored in English regardless of the conversation language.
- Memory is best-effort — never assume recall returned everything; it's a query, not a lookup.
- Topic keys are free-form strings; don't invent new vocabularies when existing ones fit.
- Not every project defines every memory type — if one is empty, that's fine.
- Saving a secret-looking string is refused by default. Re-save with a scrubbed version.
- Synthesize what happened and why. Raw transcript fragments are input, not final project context.`

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
