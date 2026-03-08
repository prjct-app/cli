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
import { registerContextTools } from './tools/context'
import { registerFileTools } from './tools/files'
import { registerMemoryTools } from './tools/memory'
import { registerPatternTools } from './tools/patterns'
import { registerProjectTools } from './tools/project'
import { registerReviewTools } from './tools/review'
import { registerSessionTools } from './tools/session'
import { registerWorkflowTools } from './tools/workflow'

/**
 * Memory Protocol — injected as server instructions so the agent
 * knows WHEN to save, search, and close sessions proactively.
 */
const MEMORY_PROTOCOL = `## prjct Memory Protocol

### On session start:
1. Call prjct_session_start to register this session
2. Call prjct_session_context to recover context from last session
3. Call prjct_mem_search for any relevant memories to current task

### During work — SAVE when you:
- Make a technical decision → prjct_decision_record (key/value with confidence tracking)
- Discover a project pattern → prjct_mem_save with topic_key pattern/*
- Fix a non-obvious bug → topic_key bug/*
- Learn a user preference → prjct_preference_set (key/value)
- Find an architectural constraint → topic_key architecture/*
- Use prjct_mem_suggest_topic if unsure about the right topic_key

### During work — SEARCH when you:
- Start a new subtask (search for related memories)
- Hit an error (search for similar bugs)
- Need to make a decision (prjct_decision_get to check prior decisions)

### Decisions & Preferences:
- prjct_decision_record / prjct_decision_get — technical decisions with confidence tracking
- prjct_preference_set / prjct_preference_get — user preferences

### Code Intelligence:
- prjct_impact_analysis — before reviewing changes, check what else is affected
- prjct_related_context — find related files (imports + co-change) for context

### Maintenance:
- prjct_archive_stale — periodically clean up old decisions
- prjct_confirm — when user confirms a decision/preference, boost confidence
- prjct_analysis_staleness — check if project analysis needs refresh
- prjct_mem_consolidate — merge duplicate memories (run periodically)

### On session end:
1. Call prjct_session_summary with Goal/Accomplished/Discoveries/Next Steps/Files
2. Save any important learnings not yet captured via prjct_mem_save
3. Call prjct_mem_capture_passive on your final output to auto-extract learnings`

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'prjct', version: '1.0.0' },
    { instructions: MEMORY_PROTOCOL }
  )

  registerMemoryTools(server)
  registerSessionTools(server)
  registerProjectTools(server)
  registerFileTools(server)
  registerWorkflowTools(server)
  registerReviewTools(server)
  registerPatternTools(server)
  registerCodeIntelTools(server)
  registerContextTools(server)

  return server
}
