---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'JIRA issue tracker integration via REST API'
---

# p. jira - JIRA Integration

**ARGUMENTS**: $ARGUMENTS

---

Manage JIRA issues directly from prjct using the REST API for fast performance.

## Context Variables

- `{args}`: User-provided arguments (subcommand)
- Project config is resolved internally by the CLI

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. jira` | Show status + your assigned issues |
| `p. jira setup` | Configure JIRA credentials (REQUIRED FIRST) |
| `p. jira sync` | Fetch your assigned issues |
| `p. jira start <KEY>` | Start working on issue (e.g., PROJ-123) |

---

## Authentication

JIRA uses API Token authentication for fast REST API access.

**Required Environment Variables:**
```bash
export JIRA_BASE_URL="https://company.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="your-token"
```

**Get API Token**: https://id.atlassian.com/manage-profile/security/api-tokens

---

## Step 1: Validate Project

```bash
prjct status --json 2>/dev/null || echo "NO_PROJECT"
```

IF output contains "NO_PROJECT":
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

---

## Step 2: Check Credentials

```
CHECK: Are JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN set?

IF not all set:
  ASK: "Enter your JIRA credentials"

  PROMPT FOR:
  - JIRA_BASE_URL: "Your JIRA instance URL (e.g., https://company.atlassian.net)"
  - JIRA_EMAIL: "Your Atlassian account email"
  - JIRA_API_TOKEN: "API token from https://id.atlassian.com/manage-profile/security/api-tokens"

  OUTPUT: "Add to your shell profile:"
  OUTPUT: "export JIRA_BASE_URL='https://company.atlassian.net'"
  OUTPUT: "export JIRA_EMAIL='you@company.com'"
  OUTPUT: "export JIRA_API_TOKEN='your-token'"
```

---

## Subcommand: setup

### Flow

1. **Check for credentials**
   ```
   IF any of JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN missing:
     ASK: Collect missing credentials
     PROVIDE: Link to https://id.atlassian.com/manage-profile/security/api-tokens
   ```

2. **Test REST API connection**
   ```
   IMPORT: jiraService from core/integrations/jira
   CALL: jiraService.initializeFromCredentials(baseUrl, email, token)

   # This will verify the connection
   ```

3. **Get available projects**
   ```
   CALL: jiraService.getProjects()
   EXTRACT: List of projects with id, name, key
   ```

4. **Ask user to select default project**
   ```
   ASK: "Select your default project"
   OPTIONS: List of projects
   ```

5. **Save config via CLI**
   ```bash
   prjct jira setup --base-url "{baseUrl}" --project-key "{projectKey}"
   ```
   The CLI persists integration config to SQLite.

### Output

```
JIRA configured

Instance: {baseUrl}
Project: {projectKey} - {projectName}
Auth: API Token (REST)

Next: `p. jira` to see your issues
```

---

## Subcommand: status (default, no args)

```
CALL: jiraService.fetchAssignedIssues({ limit: 10 })

OUTPUT:
JIRA: Connected
Project: {projectKey}

Your issues ({count}):
  {PROJ-123} {title} ({status})
  {PROJ-124} {title} ({status})
...

Next: `p. jira start PROJ-123` to begin work
```

---

## Subcommand: sync

```
1. Fetch all assigned issues
   CALL: jiraService.fetchAssignedIssues({ limit: 50 })

2. Save to prjct.db (SQLite)

3. Show summary

OUTPUT:
Synced {count} issues from JIRA.

Next: `p. jira start <KEY>` to begin work
```

---

## Subcommand: start <KEY>

```
1. Fetch issue by key
   CALL: jiraService.fetchIssue("{KEY}")
   EXTRACT: id, title, description, status

2. Transition to "In Progress" in JIRA
   CALL: jiraService.markInProgress("{KEY}")

3. Create prjct task from issue
   - Use issue title as task description
   - Link externalId to JIRA issue

4. Create git branch
   PATTERN: {type}/{KEY}-{slug}
   EXAMPLE: feature/PROJ-123-add-user-auth

OUTPUT:
Started: {KEY} - {title}

Branch: feature/PROJ-123-add-user-auth
JIRA: In Progress

Next: Work on the task, then `p. done`
```

---

## SDK Service Reference

The `jiraService` from `core/integrations/jira` provides:

| Operation | SDK Method |
|-----------|------------|
| Initialize | `jiraService.initializeFromCredentials(url, email, token, project?)` |
| List assigned | `jiraService.fetchAssignedIssues(options?)` |
| List project issues | `jiraService.fetchProjectIssues(projectKey, options?)` |
| Get issue | `jiraService.fetchIssue(key)` |
| Create issue | `jiraService.createIssue(input)` |
| Update issue | `jiraService.updateIssue(key, input)` |
| Mark in progress | `jiraService.markInProgress(key)` |
| Mark done | `jiraService.markDone(key)` |
| Get projects | `jiraService.getProjects()` |

### Caching

All read operations are cached for 5 minutes:
- Issues are cached by ID and key (e.g., "PROJ-123")
- Assigned issues list is cached per user
- Projects are cached globally

Cache is automatically invalidated on writes (create, update, status changes).

---

## Credential Storage

| What | Where |
|------|-------|
| Credentials | Environment variables: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Config | Stored in SQLite via CLI |

---

## Error Handling

| Error | Action |
|-------|--------|
| Missing credentials | "Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN or run `p. jira setup`" |
| Invalid credentials | "Check your credentials at https://id.atlassian.com/manage-profile/security" |
| Issue not found | "Issue {KEY} not found in JIRA" |
| Network error | "Check your internet connection" |

---

## Output Format

```
{action}: {result}

{details}

Next: {suggested action}
```

---

## Performance

REST API operations are fast and cached:

| Operation | REST API |
|-----------|----------|
| Fetch issue | ~200ms |
| List issues | ~300ms |
| Transition | ~250ms |
