---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Sync and enrich JIRA issues with AI-generated context'
---

# p. jira - JIRA Issue Tracker Integration

Sync issues from Atlassian JIRA and enrich them with AI-generated context.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. jira` | Show status + **your** assigned issues |
| `p. jira sync` | Fetch and enrich **your** assigned issues |
| `p. jira enrich <KEY>` | Enrich specific issue (e.g., PROJ-123) |
| `p. jira setup` | Configure JIRA integration |
| `p. jira start <KEY>` | Start working on issue → creates prjct task |

### Filter Options

| Flag | Description |
|------|-------------|
| (default) | Only issues assigned to you |
| `--project <KEY>` | All issues in a specific project |
| `--unassigned` | Unassigned issues (for picking up work) |

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

## Step 2: Check Configuration & Auth Mode

```
READ: {globalPath}/project.json
EXTRACT: integrations.jira

IF not configured:
  OUTPUT: "JIRA not configured."
  OUTPUT: "Run `p. jira setup` to configure."
  STOP

# Determine authentication mode
SET: hasApiToken = JIRA_API_TOKEN is set
SET: hasMCP = Atlassian MCP tools available

IF hasApiToken:
  SET: authMode = "api-token"
  # Use direct REST API calls via jiraProvider
ELSE IF hasMCP:
  SET: authMode = "mcp"
  # Use MCP tools for JIRA operations
ELSE:
  OUTPUT: "JIRA credentials not configured."
  OUTPUT: ""
  OUTPUT: "Choose an authentication method:"
  OUTPUT: ""
  OUTPUT: "Option 1: API Token (direct access)"
  OUTPUT: "  JIRA_BASE_URL - Your JIRA instance URL"
  OUTPUT: "  JIRA_EMAIL - Your Atlassian email"
  OUTPUT: "  JIRA_API_TOKEN - Token from https://id.atlassian.com/manage-profile/security/api-tokens"
  OUTPUT: ""
  OUTPUT: "Option 2: MCP Mode (for corporate SSO)"
  OUTPUT: "  Add to ~/.claude/mcp.json:"
  OUTPUT: '  {"mcpServers":{"Atlassian":{"command":"npx","args":["-y","mcp-remote@latest","https://mcp.atlassian.com/v1/sse"]}}}'
  OUTPUT: "  Then restart Claude Code and authenticate via browser."
  STOP
```

---

## Step 3: Route Subcommand

### No args / status

```
SHOW:
- Connection status
- Project configured
- Assigned issues (first 10)

OUTPUT:
JIRA: Connected ✓
Instance: {baseUrl}
Project: {projectKey}
Issues assigned: {count}

Recent:
- {PROJ-123} {title} ({status})
- ...
```

### sync

```
1. Fetch assigned issues from JIRA
2. For each issue without enrichment:
   a. Use Task(Explore) to analyze codebase
   b. Generate enrichment using enricher.ts prompts
   c. Update issue description in JIRA
   d. Save enriched data locally
3. Output summary

OUTPUT:
Synced {count} issues from JIRA.
Enriched: {enrichedCount}
Updated in JIRA: {updatedCount}
```

### enrich <KEY>

```
1. Fetch issue by key (e.g., PROJ-123)
2. Analyze codebase for context
3. Generate full enrichment:
   - Enhanced description
   - Acceptance criteria
   - Affected files
   - Technical notes
   - Complexity estimate
4. Ask user to confirm before updating JIRA
5. Update issue in JIRA
6. Save locally

OUTPUT:
## {KEY}: {title}

### Generated Enrichment

**Description**:
{enrichedDescription}

**Acceptance Criteria**:
- [ ] {ac1}
- [ ] {ac2}
...

**Affected Files**:
- `{file1}` - {reason}
...

**Complexity**: {estimate}

---
Update in JIRA? [Y/n]
```

### setup

```
1. Check JIRA environment variables:
   - JIRA_BASE_URL (required)
   - JIRA_EMAIL (required)
   - JIRA_API_TOKEN (required)

2. Connect to JIRA and verify credentials

3. List available projects

4. Ask user to select default project

5. Save config to {globalPath}/project.json

OUTPUT:
JIRA Setup

Connected as: {displayName}
Instance: {baseUrl}

Available projects:
1. {PROJ1} - {Project Name 1}
2. {PROJ2} - {Project Name 2}
...

Select default project for new issues:
> [user selects]

Config saved!
```

### start <KEY>

```
1. Fetch issue from JIRA
2. Enrich if not already enriched
3. Transition issue to "In Progress" in JIRA
4. Create prjct task with enrichment data
5. Create git branch: {type}/{issueKey}-{slug}

OUTPUT:
Started: {KEY} - {title}

Branch: feature/PROJ-123-add-user-auth
JIRA status: In Progress

Next: Work on the task, then `p. done`
```

---

## Enrichment Process

When enriching an issue:

### 1. Gather Project Context

```
READ: {globalPath}/project.json → techStack
READ: package.json → dependencies
BASH: git log --oneline -10 → recent commits
```

### 2. Analyze Codebase

Use Task(Explore) to find:
- Similar existing features
- Related code patterns
- Key files that might be affected

### 3. Generate Enrichment

Based on analysis, generate:

**Enhanced Description**:
- What the user/stakeholder wants to achieve
- Why this change is needed
- Context from similar features

**Acceptance Criteria** (3-7 items):
- [ ] When [action], then [expected result]
- Specific, testable criteria

**Affected Files**:
- `src/components/Auth.tsx` - Main auth component
- `src/api/users.ts` - User API calls

**Technical Notes**:
- Follow existing pattern in `src/auth/`
- Consider edge case: expired sessions
- Reuse `useAuth` hook

**Complexity**: small | medium | large
- Based on affected files and scope

---

## Storage

### Issue Cache: `{globalPath}/storage/issues.json`

```json
{
  "provider": "jira",
  "lastSync": "2024-01-15T10:30:00Z",
  "issues": {
    "PROJ-123": {
      "id": "10001",
      "externalId": "PROJ-123",
      "title": "Add user authentication",
      "status": "in_progress",
      "enrichment": {
        "description": "...",
        "acceptanceCriteria": [...],
        "affectedFiles": [...],
        "technicalNotes": "...",
        "estimatedComplexity": "medium",
        "generatedAt": "2024-01-15T10:30:00Z"
      }
    }
  }
}
```

---

## Configuration Storage

### In `{globalPath}/project.json`

```json
{
  "integrations": {
    "jira": {
      "enabled": true,
      "provider": "jira",
      "baseUrl": "https://company.atlassian.net",
      "projectKey": "PROJ",
      "projectName": "My Project",
      "userId": "account-id",
      "setupAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Missing JIRA_BASE_URL | "Set JIRA_BASE_URL environment variable" |
| Missing JIRA_EMAIL | "Set JIRA_EMAIL environment variable" |
| Missing JIRA_API_TOKEN | "Set JIRA_API_TOKEN. Get token: https://id.atlassian.com/manage-profile/security/api-tokens" |
| Connection failed | Show error, suggest checking credentials |
| Issue not found | "Issue {KEY} not found in JIRA" |
| Rate limited | "JIRA API rate limited. Try again in {time}" |
| No transition available | "Cannot transition issue - check workflow permissions" |

---

## Authentication

JIRA uses Basic Auth with API tokens:

```bash
# Add to ~/.zshrc or ~/.bashrc

# Your JIRA Cloud instance URL
export JIRA_BASE_URL="https://company.atlassian.net"

# Your Atlassian account email
export JIRA_EMAIL="you@company.com"

# API token (NOT your password)
# Generate at: https://id.atlassian.com/manage-profile/security/api-tokens
export JIRA_API_TOKEN="your-api-token-here"
```

### For JIRA Server/Data Center

Same environment variables work, just use your server URL:
```bash
export JIRA_BASE_URL="https://jira.internal.company.com"
```

---

## Output Format

```
{action} {count} issues

{issueKey}: {title}
Status: {status} → {newStatus}
Enriched: ✓

Next: {suggested action}
```

---

## JQL Quick Reference

The JIRA client uses JQL (JIRA Query Language) internally:

| Filter | JQL |
|--------|-----|
| My open issues | `assignee = currentUser() AND statusCategory != Done` |
| Project issues | `project = PROJ AND statusCategory != Done` |
| Unassigned | `assignee IS EMPTY AND statusCategory != Done` |
| Recent updates | `updated >= -7d ORDER BY updated DESC` |

---

## Comparison with Linear

| Feature | Linear | JIRA |
|---------|--------|------|
| Auth | API Key | Basic Auth (email + token) / MCP |
| Issue ID | ENG-123 | PROJ-123 |
| Teams | Teams | Projects |
| Status | State types | Status categories |
| Description | Markdown | ADF (converted from markdown) |

---

## MCP Mode Operations

When `authMode = "mcp"`, use Atlassian MCP tools instead of REST API.

### Available MCP Tools

| Operation | MCP Tool |
|-----------|----------|
| Search issues | `mcp__atlassian__jira_search_issues` |
| Get issue | `mcp__atlassian__jira_get_issue` |
| Transition issue | `mcp__atlassian__jira_transition_issue` |
| Update issue | `mcp__atlassian__jira_update_issue` |
| Create issue | `mcp__atlassian__jira_create_issue` |

### MCP Tool Usage Examples

#### Search Assigned Issues

```
USE TOOL: mcp__atlassian__jira_search_issues
PARAMS:
  jql: "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC"
  maxResults: 20
```

#### Get Single Issue

```
USE TOOL: mcp__atlassian__jira_get_issue
PARAMS:
  issueKey: "PROJ-123"
```

#### Transition to In Progress

```
USE TOOL: mcp__atlassian__jira_transition_issue
PARAMS:
  issueKey: "PROJ-123"
  transitionName: "In Progress"
```

#### Update Description

```
USE TOOL: mcp__atlassian__jira_update_issue
PARAMS:
  issueKey: "PROJ-123"
  fields:
    description: "Updated description with enrichment..."
```

### MCP Mode Setup

For corporate environments where API tokens cannot be generated:

```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "Atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/sse"]
    }
  }
}
```

After configuration:
1. Restart Claude Code
2. Run `/mcp` to verify Atlassian tools are available
3. First operation will prompt browser authentication (SSO compatible)

### Checking MCP Availability

```
# Check if Atlassian MCP tools are available
IF tools contain "mcp__atlassian__jira_*":
  SET: hasMCP = true
ELSE:
  SET: hasMCP = false
```

---

## Authentication Mode Detection Flow

```
p. jira
    │
    ▼
┌─────────────────────────────┐
│ Check JIRA_API_TOKEN env    │
└─────────────────────────────┘
    │
    ├─ Set → Use API Token Mode
    │        (direct REST API)
    │
    └─ Not set
         │
         ▼
    ┌─────────────────────────────┐
    │ Check MCP tools available   │
    │ (mcp__atlassian__jira_*)    │
    └─────────────────────────────┘
         │
         ├─ Available → Use MCP Mode
         │              (OAuth via browser)
         │
         └─ Not available → Show setup options
```
