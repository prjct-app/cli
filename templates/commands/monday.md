---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Monday.com issue tracker integration via MCP'
extends: '_bases/tracker-base.md'
---

# p. monday - Monday.com Integration

**EXTENDS**: `_bases/tracker-base.md` - See base template for common flows.

**ARGUMENTS**: $ARGUMENTS

Manage Monday.com boards directly from prjct using MCP.

## Tracker-Specific Config

- `{mcpServerName}`: "monday"
- `{mcpPrefix}`: "mcp__monday__"
- `{projectKey}`: "boardId"

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{agentName}`: Name of the AI agent (Claude Code, Gemini CLI)
- `{agentSettingsPath}`: Path to agent settings (settings.json)
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. monday` | Show your items |
| `p. monday setup` | Configure Monday.com (first time) |
| `p. monday start <ID>` | Start working on item |

---

## Authentication

Monday.com uses MCP with OAuth - **no API key needed**.

**MCP Server**: `@mondaydotcomorg/monday-api-mcp`
**Auth**: Browser-based OAuth (first use opens browser)
**Tools prefix**: `mcp__monday__*`

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
READ: {agentSettingsPath} (create {} if not exists)
CHECK: Does mcpServers.monday exist?

IF not exists:
  READ: templates/mcp-config.json
  EXTRACT: mcpServers.monday

  MERGE into {agentSettingsPath}:
  {
    "mcpServers": {
      "monday": {
        "command": "npx",
        "args": ["-y", "@mondaydotcomorg/monday-api-mcp"]
      }
    }
  }

  WRITE: {agentSettingsPath}

  OUTPUT: "✅ Installed Monday.com MCP server"
  OUTPUT: ""
  OUTPUT: "⚠️ Restart {agentName} to activate the MCP server."
  OUTPUT: "Then run `p. monday setup` again to complete configuration."
  STOP
```

---

## Step 3: Check MCP Tools Available

```
CHECK: Are mcp__monday__* tools available?

IF not available:
  OUTPUT: "Monday MCP is installed but not yet active."
  OUTPUT: "Restart {agentName}, then run `p. monday setup` again."
  STOP
```

---

## Subcommand: setup

### Flow

1. **Install MCP + Verify tools available**
   ```
   Execute Step 2 (auto-install MCP if needed)
   Execute Step 3 (verify tools active)
   IF not available: Prompt restart and STOP
   ```

2. **Test connection (triggers OAuth if needed)**
   ```
   USE TOOL: mcp__monday__get_board_items_by_name
   # First use will open browser for OAuth
   ```

3. **List boards and ask user to select**
   ```
   ASK: "Select your default board"
   OPTIONS: List of boards
   ```

4. **Save config to project.json**
   ```json
   {
     "integrations": {
       "monday": {
         "enabled": true,
         "authMode": "mcp",
         "boardId": "{boardId}",
         "boardName": "{boardName}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
✅ Monday.com configured

Board: {boardName}
Auth: MCP (OAuth)

Next: `p. monday` to see your items
```

---

## Subcommand: status (default, no args)

```
USE TOOL: mcp__monday__get_board_items_by_name
PARAMS:
  boardId: "{boardId}"

OUTPUT:
Monday.com: Connected ✓
Board: {boardName}

Your items ({count}):
• {item_name} ({status})
...

Next: `p. monday start <ID>` to begin work
```

---

## Subcommand: start <ID>

```
1. Get item
   USE TOOL: mcp__monday__get_board_items_by_name

2. Update status column to "Working on it"
   USE TOOL: mcp__monday__change_item_column_values

3. Create prjct task from item

4. Create git branch: feature/{id}-{slug}

OUTPUT:
Started: {item_name}

Branch: feature/123-add-feature
Monday: Working on it ✓

Next: Work on the task, then `p. done`
```

---

## MCP Tool Reference

| Operation | MCP Tool |
|-----------|----------|
| Get items | `mcp__monday__get_board_items_by_name` |
| Create item | `mcp__monday__create_item` |
| Delete item | `mcp__monday__delete_item` |
| Update columns | `mcp__monday__change_item_column_values` |
| Create update | `mcp__monday__create_update` |

---

## Config Storage

| What | Where |
|------|-------|
| Auth | MCP OAuth (managed by Monday) |
| Config | `{globalPath}/project.json` → `integrations.monday` |

---

## Error Handling

| Error | Action |
|-------|--------|
| MCP tools not found | "Add Monday MCP to settings, restart {agentName}" |
| OAuth failed | "Re-authenticate via browser" |
| Item not found | "Item not found in board" |

---

## Output Format

```
{action}: {result}

{details}

Next: {suggested action}
```
