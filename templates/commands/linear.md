---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Linear issue tracker integration via MCP'
extends: '_bases/tracker-base.md'
---

# p. linear - Linear Integration

**EXTENDS**: `_bases/tracker-base.md` - See base template for common flows.

**ARGUMENTS**: $ARGUMENTS

Manage Linear issues directly from prjct using MCP (no SDK needed).

## Tracker-Specific Config

- `{mcpServerName}`: "linear"
- `{mcpPrefix}`: "mcp__linear__"
- `{projectKey}`: "teamId"

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. linear` | Show your assigned issues |
| `p. linear setup` | Configure Linear (first time) |
| `p. linear start <ID>` | Start working on issue (e.g., PRJ-59) |
| `p. linear comment <ID> <text>` | Add comment to issue |

---

## Authentication

Linear uses MCP with OAuth - **no API key needed**.

**MCP Server**: `https://mcp.linear.app/mcp`
**Auth**: Browser-based OAuth (first use opens browser)
**Tools prefix**: `mcp__linear__*`

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

## Step 2: Install MCP Server (if needed)

```
READ: ~/.claude/settings.json (create {} if not exists)
CHECK: Does mcpServers.linear exist?

IF not exists:
  READ: templates/mcp-config.json
  EXTRACT: mcpServers.linear

  MERGE into ~/.claude/settings.json:
  {
    "mcpServers": {
      "linear": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
      }
    }
  }

  WRITE: ~/.claude/settings.json

  OUTPUT: "✅ Installed Linear MCP server"
  OUTPUT: ""
  OUTPUT: "⚠️ Restart Claude Code to activate the MCP server."
  OUTPUT: "Then run `p. linear setup` again to complete configuration."
  STOP
```

---

## Step 3: Check MCP Tools Available

```
CHECK: Are mcp__linear__* tools available?

IF not available:
  OUTPUT: "Linear MCP is installed but not yet active."
  OUTPUT: "Restart Claude Code, then run `p. linear setup` again."
  STOP
```

---

## Subcommand: setup

### Flow

1. **Install MCP + Verify tools available**
   ```
   Execute Step 2 (auto-install if needed)
   Execute Step 3 (verify tools active)
   IF not available: Prompt restart and STOP
   ```

2. **Test connection (triggers OAuth if needed)**
   ```
   USE TOOL: mcp__linear__list_issues
   PARAMS: { "limit": 1 }

   # First use will open browser for OAuth
   ```

3. **Get user info and teams**
   ```
   USE TOOL: mcp__linear__get_viewer
   EXTRACT: userId, name, email

   USE TOOL: mcp__linear__list_teams
   ```

4. **Ask user to select team**
   ```
   ASK: "Select your default team"
   OPTIONS: List of teams
   ```

5. **Save config to project.json**
   ```json
   {
     "integrations": {
       "linear": {
         "enabled": true,
         "authMode": "mcp",
         "teamId": "{teamId}",
         "teamName": "{teamName}",
         "teamKey": "{teamKey}",
         "userId": "{userId}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
✅ Linear configured

Connected as: {name} ({email})
Team: {teamName} ({teamKey})
Auth: MCP (OAuth)

Next: `p. linear` to see your issues
```

---

## Subcommand: status (default, no args)

```
USE TOOL: mcp__linear__list_issues
PARAMS:
  assignedToMe: true
  limit: 10

OUTPUT:
Linear: Connected ✓
Team: {teamName} ({teamKey})

Your issues ({count}):
• {PRJ-123} {title} ({status})
• {PRJ-124} {title} ({status})
...

Next: `p. linear start PRJ-123` to begin work
```

---

## Subcommand: start <ID>

```
1. Get issue
   USE TOOL: mcp__linear__get_issue
   PARAMS: { "issueId": "{ID}" }

2. Update status to In Progress
   USE TOOL: mcp__linear__update_issue
   PARAMS:
     issueId: "{uuid}"
     stateId: "{in_progress_state_id}"

3. Create prjct task from issue

4. Create git branch: feature/{ID}-{slug}

OUTPUT:
Started: {ID} - {title}

Branch: feature/PRJ-59-add-user-auth
Linear: In Progress ✓

Next: Work on the task, then `p. done`
```

---

## Subcommand: comment <ID> <text>

```
1. Get issue UUID
   USE TOOL: mcp__linear__get_issue
   PARAMS: { "issueId": "{ID}" }

2. Add comment
   USE TOOL: mcp__linear__create_comment
   PARAMS:
     issueId: "{uuid}"
     body: "{text}"

OUTPUT:
Comment added to {ID}
```

---

## MCP Tool Reference

| Operation | MCP Tool |
|-----------|----------|
| List issues | `mcp__linear__list_issues` |
| Get issue | `mcp__linear__get_issue` |
| Update issue | `mcp__linear__update_issue` |
| Create issue | `mcp__linear__create_issue` |
| Add comment | `mcp__linear__create_comment` |
| Get viewer | `mcp__linear__get_viewer` |
| List teams | `mcp__linear__list_teams` |

### Example: List My Issues

```
USE TOOL: mcp__linear__list_issues
PARAMS:
  assignedToMe: true
  includeArchived: false
  limit: 20
```

### Example: Get Issue by ID

```
USE TOOL: mcp__linear__get_issue
PARAMS:
  issueId: "PRJ-59"
```

### Example: Add Comment

```
USE TOOL: mcp__linear__create_comment
PARAMS:
  issueId: "{uuid}"
  body: "Implementation complete. Used MCP instead of SDK."
```

---

## Config Storage

| What | Where |
|------|-------|
| Auth | MCP OAuth (managed by Linear) |
| Config | `{globalPath}/project.json` → `integrations.linear` |
| Issue cache | `{globalPath}/storage/issues.json` |

---

## Error Handling

| Error | Action |
|-------|--------|
| MCP tools not found | "Add Linear MCP to settings, restart Claude" |
| OAuth failed | "Re-authenticate via browser" |
| Issue not found | "Issue {ID} not found in Linear" |

---

## Output Format

```
{action}: {result}

{details}

Next: {suggested action}
```
