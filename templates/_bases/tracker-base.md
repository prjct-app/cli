---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Base template for issue tracker integrations'
---

# Issue Tracker Base Template

**This is a BASE TEMPLATE. Do not execute directly.**

All issue tracker integrations (Linear, JIRA, GitHub Issues, Monday.com) inherit from this base.

## CRITICAL - SDK vs MCP

| Tracker | Method | Why |
|---------|--------|-----|
| **Linear** | **SDK ONLY** | Per-project credentials, 4x faster |
| **JIRA** | **SDK ONLY** | Per-project credentials, 4x faster |
| GitHub | MCP | Simple token auth |
| Monday | MCP | OAuth only |

**For Linear and JIRA**: NEVER use MCP tools (`mcp__linear__*`, `mcp__jira__*`). ALWAYS use the SDK CLI helper.

---

## Common Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{agentName}`: Name of the AI agent (Claude Code, Gemini CLI)
- `{agentSettingsPath}`: Path to agent settings (settings.json)
- `{args}`: User-provided arguments (subcommand)
- `{tracker}`: The tracker name (linear, jira, github, monday)
- `{mcpPrefix}`: MCP tool prefix (e.g., `mcp__linear__`, `mcp__atlassian__jira_`)

---

## Standard Subcommands

All trackers MUST support these subcommands:

| Command | Description |
|---------|-------------|
| `p. {tracker}` | Show status + your assigned issues |
| `p. {tracker} setup` | Configure integration (REQUIRED FIRST) |
| `p. {tracker} start <ID>` | Start working on issue |
| `p. {tracker} comment <ID> <text>` | Add comment to issue |

---

## Step 1: Validate Project (COMMON)

```
READ: .prjct/prjct.config.json
EXTRACT: projectId
SET: globalPath = ~/.prjct-cli/projects/{projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP
```

---

## Step 2: Check Authentication (TRACKER-SPECIFIC)

**Override this section per tracker.**

Common patterns:
- **MCP OAuth** (Linear, JIRA): First use opens browser
- **API Token** (GitHub): Requires env var
- **Both supported** (JIRA): OAuth preferred, token fallback

```
# Check for existing config
READ: {globalPath}/project.json → integrations.{tracker}

IF config exists AND config.enabled:
  # Use existing credentials
  SET: authMode = config.authMode
ELSE:
  # Need setup
  OUTPUT: "{TRACKER} not configured. Run `p. {tracker} setup` first."
  STOP
```

---

## Step 3: Install MCP Server (COMMON)

```
READ: {agentSettingsPath} (create {} if not exists)
CHECK: Does mcpServers.{mcpServerName} exist?

IF not exists:
  MERGE MCP config:
  {
    "mcpServers": {
      "{mcpServerName}": {mcpConfig}
    }
  }

  WRITE: {agentSettingsPath}

  OUTPUT: "✅ Installed {TRACKER} MCP server"
  OUTPUT: ""
  OUTPUT: "⚠️ Restart your AI agent ({agentName}) to activate the MCP server."
  OUTPUT: "Then run `p. {tracker} setup` again to complete configuration."
  STOP
```

---

## Step 4: Check MCP Tools Available (COMMON)

```
CHECK: Are {mcpPrefix}* tools available?

IF not available:
  OUTPUT: "{TRACKER} MCP is installed but not yet active."
  OUTPUT: "Restart {agentName}, then run `p. {tracker} setup` again."
  STOP
```

---

## Subcommand: setup (COMMON FLOW)

### Flow

1. **Install MCP + Verify tools available**
   - Execute Step 3 (auto-install if needed)
   - Execute Step 4 (verify tools active)
   - IF not available: Prompt restart and STOP

2. **Test connection (TRACKER-SPECIFIC)**
   - Call list/get endpoint to verify auth
   - MCP OAuth may open browser on first call

3. **Get user info (TRACKER-SPECIFIC)**
   - Get current user
   - List available projects/teams

4. **Ask user to select project/team**
   ```
   ASK: "Select your default {project|team|board}"
   OPTIONS: List from step 3
   ```

5. **Save config to project.json**
   ```json
   {
     "integrations": {
       "{tracker}": {
         "enabled": true,
         "authMode": "{mcp|token}",
         "{projectKey}": "{selected}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
✅ {TRACKER} configured

{Connected as: {user} (if available)}
{Project|Team}: {name}
Auth: {authMode}

Next: `p. {tracker}` to see your issues
```

---

## Subcommand: status (default, no args) - COMMON FLOW

```
1. Validate auth (Step 2)
2. Call list issues API with assignee filter
3. Format and display

OUTPUT:
{TRACKER}: Connected ✓
{Project|Team}: {name}

Your issues ({count}):
• {ID-1} {title} ({status})
• {ID-2} {title} ({status})
...

Next: `p. {tracker} start {ID}` to begin work
```

---

## Subcommand: start <ID> - COMMON FLOW

```
1. Get issue by ID
   USE: {mcpPrefix}get_issue or equivalent

2. Update status to "In Progress"
   USE: {mcpPrefix}update_issue or transition

3. Create prjct task from issue
   - Extract title, description
   - Create task with linked issueId

4. Create git branch
   SET: branchName = {type}/{ID}-{slug}
   BASH: git checkout -b {branchName}

OUTPUT:
Started: {ID} - {title}

Branch: {branchName}
{TRACKER}: In Progress ✓

Next: Work on the task, then `p. done`
```

---

## Subcommand: comment <ID> <text> - COMMON FLOW

```
1. Get issue ID (may need to lookup)
2. Add comment via MCP

OUTPUT:
Comment added to {ID}
```

---

## Config Storage (COMMON)

| What | Where |
|------|-------|
| Auth | Varies: Env var, MCP OAuth, or keychain |
| Config | `{globalPath}/project.json` → `integrations.{tracker}` |
| Issue cache | `{globalPath}/storage/issues.json` (optional) |

---

## Error Handling (COMMON)

| Error | Action |
|-------|--------|
| No project | "Run `p. init` first" |
| Auth not configured | "Run `p. {tracker} setup` first" |
| MCP tools not found | "Restart {agentName} after setup" |
| Auth failed | Re-authenticate message |
| Issue not found | "Issue {ID} not found in {TRACKER}" |
| Rate limited | "Rate limited. Try again later" |

---

## Output Format (COMMON)

```
{action}: {result}

{details}

Next: {suggested action}
```

---

## MCP Tool Mapping

| Operation | Pattern |
|-----------|---------|
| List issues | `{mcpPrefix}list_issues` |
| Get issue | `{mcpPrefix}get_issue` |
| Update issue | `{mcpPrefix}update_issue` |
| Create issue | `{mcpPrefix}create_issue` |
| Add comment | `{mcpPrefix}create_comment` |

---

## Tracker-Specific Overrides

When implementing a tracker:

1. **INHERIT** all common flows from this base
2. **OVERRIDE** authentication check with tracker-specific logic
3. **IMPLEMENT** MCP tool calls with correct tool names
4. **ADD** tracker-specific subcommands if needed

---

## Example Implementation Pattern

```markdown
# p. {tracker} - {Tracker Name} Integration

**EXTENDS**: `_bases/tracker-base.md`

## Tracker-Specific Config

- `{mcpServerName}`: "{mcp server identifier}"
- `{mcpPrefix}`: "{tool prefix}"
- `{projectKey}`: "{what they call it - team, project, repo}"

## Authentication Override

{Tracker-specific auth flow}

## MCP Tool Reference

| Operation | MCP Tool |
|-----------|----------|
{Tracker-specific tool mappings}

## Additional Subcommands (if any)

{Tracker-specific commands}
```
