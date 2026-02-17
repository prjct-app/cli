---
allowed-tools: [Bash, AskUserQuestion, "*"]
---

# p. linear $ARGUMENTS

Linear is MCP-only — no SDK, no API tokens.

## Setup (`p. linear setup`)

```bash
prjct linear setup --md
```

After writing the config, **immediately attempt to connect** using the Linear MCP tools available in this session:

1. Try to call a Linear MCP tool (e.g. list teams or get current user)
2. If the OAuth prompt appears — complete it with the user
3. If MCP tools are not yet loaded (server not restarted): tell the user to restart their AI client and run `p. linear setup` again — the OAuth will trigger on first use

## Status (`p. linear status`)

```bash
prjct linear status --md
```

Then use a Linear MCP tool to verify the live connection works.

## Issue Operations (list / get / start / done / update / comment / create)

Do NOT use SDK or API-token flows.

1. Check MCP is configured: `prjct linear status --md`
2. Use the Linear MCP tools directly in this session
3. For `start`: use Linear MCP to move issue to In Progress, then run `prjct task "<title>" --md`
4. For `done`: use Linear MCP to move issue to Done, then run `prjct done --md`
5. For `list`: use Linear MCP to fetch assigned issues — show as a table with key, title, status, priority
6. If MCP tools unavailable: tell user to restart AI client and retry

## Sync (`p. linear sync`)

1. Use Linear MCP to fetch all issues assigned to current user
2. For each issue: run `prjct task "<title>" --md` if not already tracked
3. Show a summary of what was synced

## Presentation

- Always show issue identifier, title, status, priority
- Use tables for issue lists
- Group by status when listing multiple issues
