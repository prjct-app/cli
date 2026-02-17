---
allowed-tools: ["*"]
---

# p. jira $ARGUMENTS

Jira is MCP-only — no API tokens, no REST calls.

## Step 0: Check MCP readiness (ALWAYS, except for `setup`)

Before any Jira operation (except `setup`), check if Jira MCP tools are available in your tool list.
Look for tools starting with `mcp__jira` or `mcp__atlassian`.

**If tools ARE available** → proceed with the requested operation below.

**If tools are NOT available** → run setup:

```bash
prjct jira status --md
```

If status shows `configured: false` → run `p. jira setup`.
If status shows `configured: true` → tools were loaded but aren't active in this session.
Tell the user: "Close and reopen Claude Code to activate Jira MCP tools."

**Do NOT attempt MCP tool calls if Jira tools are not in your tool list.**

---

## Setup (`p. jira setup`)

Run step by step:

### Step 1: Write MCP config
```bash
prjct jira setup --md
```

### Step 2: Complete OAuth in terminal (REQUIRED before restarting)

Tell the user to open a NEW terminal and run this **exact** command (version pinned to match mcp.json):
```
npx -y mcp-remote@0.1.38 https://mcp.atlassian.com/v1/mcp
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

---

## Status (`p. jira status`)

```bash
prjct jira status --md
```

---

## Sprint / Backlog

```bash
prjct jira sprint --md   # → JQL for active sprint
prjct jira backlog --md  # → JQL for backlog
```

Use the returned JQL with the Jira MCP search tool (available after setup + restart).
Show sprint and backlog issues **separately**:
- `## 🏃 Active Sprint` for sprint issues
- `## 📋 Backlog` for backlog issues

---

## Issue Operations (list / get / create / update / start / done)

Use Jira MCP tools directly. No REST API, no API tokens.

- `start <KEY>`: transition to In Progress via MCP → `prjct task "<title>" --md`
- `done <KEY>`: transition to Done via MCP → `prjct done --md`
- `list`: fetch assigned issues via MCP → show as table
