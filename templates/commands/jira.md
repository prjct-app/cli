---
allowed-tools: [Bash, AskUserQuestion, "*"]
---

# p. jira $ARGUMENTS

Jira is MCP-only — no API tokens, no REST calls.

## Setup (`p. jira setup`)

```bash
prjct jira setup --md
```

After writing the config, **immediately attempt to connect** using the Jira MCP tools available in this session:

1. Try to call a Jira MCP tool (e.g. list projects or get current user)
2. If the OAuth prompt appears — complete it with the user
3. If MCP tools are not yet loaded (server not restarted): tell the user to restart their AI client and run `p. jira setup` again — the OAuth will trigger on first use

## Status (`p. jira status`)

```bash
prjct jira status --md
```

Then use a Jira MCP tool to verify the live connection works.

## Sprint / Backlog

```bash
prjct jira sprint --md   # → JQL for active sprint
prjct jira backlog --md  # → JQL for backlog
```

Use the JQL provided with the Jira MCP search tool to fetch the issues.
Show sprint issues and backlog issues **separately** with clear headers.

## Issue Operations (list / get / create / update / start / done / transition)

Do NOT use REST API or API tokens.

1. Check MCP is configured: `prjct jira status --md`
2. Use the Jira MCP tools directly in this session
3. For `start`: transition issue to In Progress via MCP, then run `prjct task "<title>" --md`
4. For `done`: transition issue to Done via MCP, then run `prjct done --md`
5. If MCP tools unavailable: tell user to restart AI client and retry

## Presentation

- Always show issue key, title, status, priority
- Sprint issues under `## 🏃 Active Sprint`
- Backlog issues under `## 📋 Backlog`
- Use tables for issue lists
