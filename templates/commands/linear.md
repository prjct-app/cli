---
allowed-tools: ["*"]
---

# p. linear $ARGUMENTS

Linear is MCP-only — no SDK, no API tokens.

## Step 0: Check MCP readiness (ALWAYS, except for `setup`)

Look for tools starting with `mcp__linear` in your tool list.

**If tools ARE available** → proceed with the requested operation below.

**If NOT available** → run: `prjct linear status --md` and interpret:

| Status | Action |
|--------|--------|
| `configured: false` | Run `p. linear setup` |
| `configured: true, oauthReady: false` | Tell user to run in a terminal: `npx -y mcp-remote@0.1.38 https://mcp.linear.app/mcp` then restart their AI client |
| `configured: true, oauthReady: true` | Tell user to restart their AI client |

**Do NOT attempt MCP tool calls if Linear tools are not in your tool list.**

---

## Setup (`p. linear setup`)

Run step by step:

### Step 1: Write MCP config
```bash
prjct linear setup --md
```

### Step 2: Complete OAuth in terminal (REQUIRED before restarting)

Tell the user to open a NEW terminal and run this **exact** command (version pinned to match mcp.json):
```
npx -y mcp-remote@0.1.38 https://mcp.linear.app/mcp
```

This will:
1. Print an OAuth URL
2. Try to open the browser automatically
3. If browser doesn't open → copy-paste the URL manually

Tell the user: **Complete the authorization in the browser, then come back here.**

Wait for the user to confirm they completed OAuth before continuing.

### Step 3: Restart Claude Code

Tell the user: "Close and reopen Claude Code. The Linear MCP tools will be ready."

After restart, Linear MCP tools are available — no more auth needed.

---

## Status (`p. linear status`)

```bash
prjct linear status --md
```

---

## Issue Operations (list / get / start / done / update / comment / create)

Use Linear MCP tools directly. No SDK, no API tokens.

- `start <ID>`: move to In Progress via MCP → `prjct task "<title>" --md`
- `done <ID>`: move to Done via MCP → `prjct done --md`
- `list`: fetch assigned issues via MCP → show as table with ID, title, status, priority

---

## Sync (`p. linear sync`)

1. Fetch assigned issues via Linear MCP tools
2. For each untracked issue: `prjct task "<title>" --md`
3. Show sync summary
