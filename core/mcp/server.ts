/**
 * prjct MCP Server
 *
 * Exposes project data via Model Context Protocol (48 tools).
 * Wraps existing storage and context modules — no new logic.
 *
 * @module mcp/server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerCodeIntelTools } from './tools/code-intel'
import { registerFileTools } from './tools/files'
import { registerMemoryTools } from './tools/memory'
import { registerProjectTools } from './tools/project'
import { registerWorkflowTools } from './tools/workflow'

/**
 * MCP server instructions — describe WHAT prjct holds, never prescribe
 * step-by-step HOW to use it. Deterministic pipelines (“first do X, then
 * Y”) are harness behavior; this template is the canonical anti-harness
 * shape (Anthropic skill docs): `Use when` + `What's here` + `Gotchas`.
 *
 * If you find yourself adding a numbered list of steps here, stop.
 */
const PRJCT_INSTRUCTIONS = `# prjct — persona-aware context broker

Use when you want prior project memory, state, or a registered workflow. You decide whether any of it is relevant to the current turn.

## What's here
- **Memory** (facts, decisions, learnings, gotchas, patterns, anti-patterns, insights, questions, sources, people, okrs, shipped work, inbox). Save via memory tools; recall via search/list. Tags are freeform.
- **Session + task state** via the session and project tools.
- **Workflows** registered in this project (can be run, listed, edited).
- **Code intelligence** helpers (impact, related context) for navigating repos.
- **Patterns** detected by analysis.

## Gotchas
- Memory is best-effort — never assume recall returned everything; it's a query, not a lookup.
- Topic keys are free-form strings; don't invent new vocabularies when existing ones fit.
- Not every project defines every memory type — if one is empty, that's fine.
- Saving a secret-looking string is refused by default. Re-save with a scrubbed version.`

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

  return server
}
