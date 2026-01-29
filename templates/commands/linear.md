---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Linear issue tracker integration via SDK'
extends: '_bases/tracker-base.md'
---

# p. linear - Linear Integration

**EXTENDS**: `_bases/tracker-base.md` - See base template for common flows.

**ARGUMENTS**: $ARGUMENTS

Manage Linear issues directly from prjct using the @linear/sdk for fast performance.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. linear` | Show your assigned issues |
| `p. linear setup` | Configure Linear API key (first time) |
| `p. linear start <ID>` | Start working on issue (e.g., PRJ-59) |
| `p. linear comment <ID> <text>` | Add comment to issue |

---

## Authentication

Linear uses API key authentication for fast SDK access.

**Get API Key**: https://linear.app/settings/api
**Env Variable**: `LINEAR_API_KEY`

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

## Step 2: Check API Key

```
CHECK: Is LINEAR_API_KEY set in environment?

IF not set:
  ASK: "Enter your Linear API key"
  HINT: "Get it from https://linear.app/settings/api"

  ONCE PROVIDED:
  OUTPUT: "Add to your shell profile:"
  OUTPUT: "export LINEAR_API_KEY='your-key'"
  OUTPUT: ""
  OUTPUT: "Or add to .env file in project root"
```

---

## Subcommand: setup

### Flow

1. **Check for API key**
   ```
   IF LINEAR_API_KEY not in environment:
     ASK: "Enter your Linear API key"
     PROVIDE: Link to https://linear.app/settings/api
   ```

2. **Test SDK connection**
   ```
   IMPORT: linearService from core/integrations/linear
   CALL: linearService.initializeFromApiKey(apiKey)

   # This will verify the connection
   ```

3. **Get user info and teams**
   ```
   CALL: linearService.getTeams()
   EXTRACT: List of teams with id, name, key
   ```

4. **Ask user to select default team**
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
         "authMode": "api-key",
         "teamId": "{teamId}",
         "teamName": "{teamName}",
         "teamKey": "{teamKey}",
         "setupAt": "{timestamp}"
       }
     }
   }
   ```

### Output

```
Linear configured

Team: {teamName} ({teamKey})
Auth: API Key (SDK)

Next: `p. linear` to see your issues
```

---

## Subcommand: status (default, no args)

```
CALL: linearService.fetchAssignedIssues({ limit: 10 })

OUTPUT:
Linear: Connected
Team: {teamName} ({teamKey})

Your issues ({count}):
  {PRJ-123} {title} ({status})
  {PRJ-124} {title} ({status})
...

Next: `p. linear start PRJ-123` to begin work
```

---

## Subcommand: start <ID>

```
1. Get issue
   CALL: linearService.fetchIssue("{ID}")
   EXTRACT: id, title, description, status

2. Update status to In Progress
   CALL: linearService.markInProgress("{ID}")

3. Create prjct task from issue
   - Use issue title as task description
   - Link externalId to Linear issue

4. Create git branch
   PATTERN: feature/{ID}-{slug}
   EXAMPLE: feature/PRJ-59-add-user-auth

OUTPUT:
Started: {ID} - {title}

Branch: feature/PRJ-59-add-user-auth
Linear: In Progress

Next: Work on the task, then `p. done`
```

---

## Subcommand: comment <ID> <text>

```
1. Add comment via SDK
   CALL: linearService.addComment("{ID}", "{text}")

OUTPUT:
Comment added to {ID}
```

---

## SDK Service Reference

The `linearService` from `core/integrations/linear` provides:

| Operation | SDK Method |
|-----------|------------|
| Initialize | `linearService.initializeFromApiKey(key, teamId?)` |
| List assigned | `linearService.fetchAssignedIssues(options?)` |
| Get issue | `linearService.fetchIssue(id)` |
| Create issue | `linearService.createIssue(input)` |
| Update issue | `linearService.updateIssue(id, input)` |
| Mark in progress | `linearService.markInProgress(id)` |
| Mark done | `linearService.markDone(id)` |
| Add comment | `linearService.addComment(id, body)` |
| Get teams | `linearService.getTeams()` |
| Get projects | `linearService.getProjects()` |

### Caching

All read operations are cached for 5 minutes:
- Issues are cached by ID and identifier (e.g., "PRJ-123")
- Assigned issues list is cached per user
- Teams and projects are cached globally

Cache is automatically invalidated on writes (create, update, status changes).

---

## Config Storage

| What | Where |
|------|-------|
| API Key | `LINEAR_API_KEY` environment variable |
| Config | `{globalPath}/project.json` → `integrations.linear` |

---

## Error Handling

| Error | Action |
|-------|--------|
| No API key | "Set LINEAR_API_KEY or run `p. linear setup`" |
| Invalid API key | "Check your API key at https://linear.app/settings/api" |
| Issue not found | "Issue {ID} not found in Linear" |
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

SDK operations are significantly faster than MCP:

| Operation | SDK | MCP (deprecated) |
|-----------|-----|------------------|
| Fetch issue | ~150ms | ~600ms |
| Create issue | ~200ms | ~800ms |
| Batch (10) | ~500ms | ~8000ms |
