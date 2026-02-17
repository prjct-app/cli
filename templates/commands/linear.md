---
allowed-tools: [Bash, AskUserQuestion]
---

# p. linear $ARGUMENTS

Linear is MCP-only.

## Setup / Status

For setup and diagnostics, run:

```bash
prjct linear $ARGUMENTS --md
```

Supported CLI subcommands:
- `setup` → writes Linear MCP server config to `~/.claude/mcp.json`
- `status` → verifies Linear MCP entry exists

## Issue Operations (list/get/start/done/update/comment)

Do NOT use SDK/API-token flows.

Instead:
1. Confirm MCP is configured (`prjct linear setup` if needed)
2. Use Linear MCP tools available in the current AI client/session
3. If MCP tools are unavailable, explain that Linear operations require an MCP-enabled client

