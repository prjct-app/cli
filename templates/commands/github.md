---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'GitHub Issues integration via MCP'
---

# p. github - GitHub Issues Integration

Manage GitHub Issues directly from prjct using MCP.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. github` | Show your assigned issues |
| `p. github setup` | Configure GitHub (first time) |
| `p. github start <NUM>` | Start working on issue (e.g., #123) |
| `p. github comment <NUM> <text>` | Add comment to issue |

---

## Authentication

GitHub uses MCP with Personal Access Token.

**MCP Server**: `@modelcontextprotocol/server-github`
**Auth**: GITHUB_TOKEN env var (needs `repo` scope)
**Tools prefix**: `mcp__github__*`

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId
SET: globalPath = ~/.prjct-cli/projects/{projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP
```

---

## Step 2: Check MCP Tools

```
CHECK: Are mcp__github__* tools available?

IF not available:
  OUTPUT: "GitHub MCP not configured."
  OUTPUT: "1. Set GITHUB_TOKEN env var (needs repo scope)"
  OUTPUT: "2. Add to ~/.claude/settings.json:"
  OUTPUT: '{"mcpServers":{"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"${GITHUB_TOKEN}"}}}}'
  OUTPUT: "3. Restart Claude Code."
  STOP
```

---

## Subcommand: setup

### Flow

1. **Verify MCP tools available**

2. **Detect repo from git remote**
   ```bash
   git remote get-url origin
   # Extract owner/repo
   ```

3. **Test connection**
   ```
   USE TOOL: mcp__github__list_issues
   PARAMS:
     owner: "{owner}"
     repo: "{repo}"
     state: "open"
     per_page: 1
   ```

4. **Save config to project.json**
   ```json
   {
     "integrations": {
       "github": {
         "enabled": true,
         "authMode": "token",
         "owner": "{owner}",
         "repo": "{repo}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
✅ GitHub configured

Repo: {owner}/{repo}
Auth: Token (GITHUB_TOKEN)

Next: `p. github` to see your issues
```

---

## Subcommand: status (default, no args)

```
USE TOOL: mcp__github__list_issues
PARAMS:
  owner: "{owner}"
  repo: "{repo}"
  state: "open"
  assignee: "@me"
  per_page: 10

OUTPUT:
GitHub: Connected ✓
Repo: {owner}/{repo}

Your issues ({count}):
• #{123} {title} ({state})
• #{124} {title} ({state})
...

Next: `p. github start 123` to begin work
```

---

## Subcommand: start <NUM>

```
1. Get issue
   USE TOOL: mcp__github__get_issue
   PARAMS:
     owner: "{owner}"
     repo: "{repo}"
     issue_number: {NUM}

2. Add "in progress" label (if exists)
   USE TOOL: mcp__github__update_issue
   PARAMS:
     labels: ["in progress"]

3. Create prjct task from issue

4. Create git branch: feature/{NUM}-{slug}

OUTPUT:
Started: #{NUM} - {title}

Branch: feature/123-add-feature
GitHub: In Progress ✓

Next: Work on the task, then `p. done`
```

---

## Subcommand: comment <NUM> <text>

```
USE TOOL: mcp__github__create_issue_comment
PARAMS:
  owner: "{owner}"
  repo: "{repo}"
  issue_number: {NUM}
  body: "{text}"

OUTPUT:
Comment added to #{NUM}
```

---

## MCP Tool Reference

| Operation | MCP Tool |
|-----------|----------|
| List issues | `mcp__github__list_issues` |
| Get issue | `mcp__github__get_issue` |
| Create issue | `mcp__github__create_issue` |
| Update issue | `mcp__github__update_issue` |
| Add comment | `mcp__github__create_issue_comment` |
| Search issues | `mcp__github__search_issues` |

---

## Config Storage

| What | Where |
|------|-------|
| Auth | GITHUB_TOKEN env var |
| Config | `{globalPath}/project.json` → `integrations.github` |

---

## Error Handling

| Error | Action |
|-------|--------|
| MCP tools not found | "Set GITHUB_TOKEN and add MCP config" |
| Token invalid | "Check GITHUB_TOKEN has repo scope" |
| Issue not found | "Issue #{NUM} not found" |
| Rate limited | "GitHub API rate limited. Try again later" |

---

## Output Format

```
{action}: {result}

{details}

Next: {suggested action}
```
