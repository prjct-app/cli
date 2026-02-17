---
allowed-tools: [Bash, AskUserQuestion]
---

# p. jira $ARGUMENTS

Jira is MCP-only — no API tokens, no REST calls.

## Setup (`p. jira setup`)

Run step by step:

### Step 1: Write MCP config
```bash
prjct jira setup --md
```

### Step 2: Complete OAuth in terminal (REQUIRED before restarting)

Tell the user to open a NEW terminal and run this command:
```
npx -y mcp-remote https://mcp.atlassian.com/v1/mcp
```

This will:
1. Print an OAuth URL
2. Try to open the browser automatically
3. If browser doesn't open → copy-paste the URL manually

Tell the user: **Complete the authorization in the browser, then come back here.**

Wait for the user to confirm they completed OAuth before continuing.

### Step 3: Restart Claude Code

Tell the user: "Close and reopen Claude Code. The Jira MCP tools will be ready."

After restart, Jira MCP tools are available — no more auth needed.

## Status (`p. jira status`)

```bash
prjct jira status --md
```

## Sprint / Backlog

```bash
prjct jira sprint --md   # → JQL for active sprint
prjct jira backlog --md  # → JQL for backlog
```

Use the returned JQL with the Jira MCP search tool.
Show sprint and backlog issues **separately**:
- `## 🏃 Active Sprint` for sprint issues
- `## 📋 Backlog` for backlog issues

## Issue Operations (list / get / create / update / start / done)

Use Jira MCP tools directly. No REST API, no API tokens.

- `start <KEY>`: transition to In Progress via MCP → `prjct task "<title>" --md`
- `done <KEY>`: transition to Done via MCP → `prjct done --md`
- `list`: fetch assigned issues via MCP → show as table
