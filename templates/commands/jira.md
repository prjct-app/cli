---
allowed-tools: [Bash, AskUserQuestion]
---

# p. jira $ARGUMENTS

Jira is MCP-only.

## Setup / Status

For setup and diagnostics, run:

```bash
prjct jira $ARGUMENTS --md
```

Supported CLI subcommands:
- `setup` → writes Jira MCP server config to `~/.claude/mcp.json`
- `status` → verifies Jira MCP entry exists

## Issue Operations (sync/start/done/list/get/create/update)

Do NOT use REST API token flows.

Instead:
1. Confirm MCP is configured (`prjct jira setup` if needed)
2. Use Jira MCP tools available in the current AI client/session
3. If MCP tools are unavailable, explain that Jira operations require an MCP-enabled client

