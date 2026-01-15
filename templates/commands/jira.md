---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'JIRA issue tracker integration'
---

# p. jira - JIRA Integration

**ARGUMENTS**: $ARGUMENTS

Manage JIRA issues directly from prjct.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. jira` | Show status + your assigned issues |
| `p. jira setup` | Configure JIRA integration (REQUIRED FIRST) |
| `p. jira sync` | Fetch your assigned issues |
| `p. jira start <KEY>` | Start working on issue (e.g., PROJ-123) |

---

## Authentication Modes

JIRA supports TWO authentication methods:

### 1. MCP Mode (Recommended for Corporate/SSO)

Uses Atlassian's official MCP server with OAuth - browser-based login, SSO compatible.

**Setup:**
- MCP server installed automatically during `p. init`
- First use opens browser for OAuth authentication
- No API tokens needed

**How to check:** Look for `mcp__atlassian__jira_*` tools

### 2. API Token Mode (Direct Access)

Uses REST API with email + token - for personal accounts or when MCP unavailable.

**Required env vars:**
```bash
export JIRA_BASE_URL="https://company.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="your-token"  # From https://id.atlassian.com/manage-profile/security/api-tokens
```

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
CHECK: Does mcpServers.Atlassian exist?

IF not exists:
  READ: templates/mcp-config.json
  EXTRACT: mcpServers.Atlassian

  MERGE into ~/.claude/settings.json:
  {
    "mcpServers": {
      "Atlassian": {
        "command": "npx",
        "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/sse"]
      }
    }
  }

  WRITE: ~/.claude/settings.json

  OUTPUT: "✅ Installed Atlassian MCP server"
  OUTPUT: ""
  OUTPUT: "⚠️ Restart Claude Code to activate the MCP server."
  OUTPUT: "Then run `p. jira setup` again to complete configuration."
  STOP
```

---

## Step 3: Detect Auth Mode

```
# Check API Token first
IF JIRA_API_TOKEN is set:
  SET: authMode = "api-token"

# Then check MCP
ELSE IF mcp__atlassian__jira_* tools available:
  SET: authMode = "mcp"

# MCP installed but not active
ELSE IF mcpServers.Atlassian exists in settings.json:
  OUTPUT: "Atlassian MCP is installed but not yet active."
  OUTPUT: "Restart Claude Code, then run `p. jira setup` again."
  STOP

# Neither available
ELSE:
  OUTPUT: "JIRA not configured. Run `p. jira setup` first."
  STOP
```

---

## Subcommand: setup

### Flow

1. **Install MCP + Detect auth mode**
   ```
   Execute Step 2 (auto-install MCP if needed)
   Execute Step 3 (detect auth mode)
   IF MCP not active: Prompt restart and STOP
   ```

2. **If MCP available (preferred)**
   ```
   OUTPUT: "Atlassian MCP detected. Using OAuth authentication."
   OUTPUT: "First operation will open browser for login."

   # Just save config indicating MCP mode
   ```

3. **If only API Token available**
   ```
   VERIFY: Connection works with provided credentials
   IF fails: Show error, ask to check credentials
   ```

4. **List projects and ask user to select**
   ```
   FETCH: projects from JIRA (via MCP or REST)
   ASK: "Select your default project"
   OPTIONS: List of projects
   ```

5. **Save config to project.json**
   ```json
   {
     "integrations": {
       "jira": {
         "enabled": true,
         "provider": "jira",
         "authMode": "mcp",  // or "api-token"
         "baseUrl": "{baseUrl}",
         "projectKey": "{projectKey}",
         "projectName": "{projectName}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
✅ JIRA configured

Auth: {MCP (OAuth) | API Token}
Instance: {baseUrl}
Project: {projectKey} - {projectName}

Next: `p. jira` to see your issues
```

---

## Subcommand: status (default, no args)

```
1. Detect auth mode
2. Fetch assigned issues (limit 10)
3. Show status

OUTPUT:
JIRA: Connected ✓
Project: {projectKey}
Auth: {authMode}

Your issues ({count}):
• {PROJ-123} {title} ({status})
• {PROJ-124} {title} ({status})
...

Next: `p. jira start PROJ-123` to begin work
```

---

## Subcommand: sync

```
1. Fetch all assigned issues
2. Save to {globalPath}/storage/issues.json
3. Show summary

OUTPUT:
Synced {count} issues from JIRA.

Next: `p. jira start <KEY>` to begin work
```

---

## Subcommand: start <KEY>

```
1. Fetch issue by key (e.g., PROJ-123)
2. Transition to "In Progress" in JIRA
3. Create prjct task from issue
4. Create git branch: {type}/{key}-{slug}

OUTPUT:
Started: {KEY} - {title}

Branch: feature/PROJ-123-add-user-auth
JIRA: In Progress ✓

Next: Work on the task, then `p. done`
```

---

## MCP Tool Reference

When `authMode = "mcp"`, use these tools:

| Operation | MCP Tool |
|-----------|----------|
| Search issues | `mcp__atlassian__jira_search_issues` |
| Get issue | `mcp__atlassian__jira_get_issue` |
| Transition | `mcp__atlassian__jira_transition_issue` |
| Update | `mcp__atlassian__jira_update_issue` |

### Example: Search Assigned Issues

```
USE TOOL: mcp__atlassian__jira_search_issues
PARAMS:
  jql: "assignee = currentUser() AND statusCategory != Done"
  maxResults: 20
```

### Example: Get Issue

```
USE TOOL: mcp__atlassian__jira_get_issue
PARAMS:
  issueKey: "PROJ-123"
```

### Example: Transition to In Progress

```
USE TOOL: mcp__atlassian__jira_transition_issue
PARAMS:
  issueKey: "PROJ-123"
  transitionName: "In Progress"
```

---

## Credential Storage

| What | Where |
|------|-------|
| API Token | Environment variable `JIRA_API_TOKEN` |
| Config | `{globalPath}/project.json` → `integrations.jira` |
| Issue cache | `{globalPath}/storage/issues.json` |

---

## Error Handling

| Error | Action |
|-------|--------|
| No auth configured | "Run `p. jira setup` first" |
| MCP auth failed | "Re-authenticate: browser will open" |
| API Token invalid | "Check JIRA_API_TOKEN" |
| Issue not found | "Issue {KEY} not found in JIRA" |

---

## Output Format

```
{action}: {result}

{details}

Next: {suggested action}
```
