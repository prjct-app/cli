---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Linear issue tracker integration via SDK'
---

# p. linear - Linear Integration

**ARGUMENTS**: $ARGUMENTS

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `p. linear` | List my assigned issues |
| `p. linear setup` | Configure API key (NOT MCP, just API key) |
| `p. linear 123` | Get issue details |
| `p. linear start 123` | Start working on issue |
| `p. linear done 123` | Mark issue as done |

---

## Execution Method: prjct CLI

All commands use the `prjct linear` CLI (NOT MCP tools):

```bash
prjct linear <command> [args...]
```

The CLI resolves the project internally from `.prjct/prjct.config.json`.

---

## Step 1: Validate Project

```bash
prjct status --json 2>/dev/null || echo "NO_PROJECT"
```

IF output contains "NO_PROJECT":
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

---

## Step 2: Parse User Intent

Analyze $ARGUMENTS to determine what user wants:

| User Input | Intent | CLI Command |
|------------|--------|-------------|
| (empty) | List my issues | `list` |
| `setup` | Configure API key | `setup <apiKey>` |
| `123` or `PRJ-123` | Get issue details | `get PRJ-123` |
| `start 123` | Start working | `start PRJ-123` |
| `done 123` | Mark complete | `done PRJ-123` |
| `comment 123 text...` | Add comment | `comment PRJ-123 "text"` |
| `"create something"` | Create issue | `create '{"title":"..."}'` |
| `teams` | List teams | `teams` |
| `status` | Check connection | `status` |

**Identifier normalization**: If user types `123`, check project config for team key and expand to `PRJ-123`.

---

## Subcommand: setup

**Trigger**: `p. linear setup`

### Flow

1. **Ask for API key**
   ```
   ASK: "Enter your Linear API key"
   HINT: "Get it from https://linear.app/settings/api"
   ```

2. **Store and test via CLI**
   ```bash
   RESULT=$(prjct linear setup "$API_KEY")
   ```

3. **Parse result** - Contains `{ success, teams, defaultTeam }`

4. **If multiple teams, ask user to select**
   ```
   ASK: "Select your default team"
   OPTIONS: teams from result

   # Re-run setup with team selection
   prjct linear setup "$API_KEY" "$TEAM_ID"
   ```

### Output

```
✅ Linear configured

Team: {teamName} ({teamKey})
Credentials: Stored per-project

Next: `p. linear` to see your issues
```

---

## Subcommand: list (default)

**Trigger**: `p. linear` (no arguments)

```bash
RESULT=$(prjct linear list)
```

### Output

```
Linear: Connected

Your issues (5):
  PRJ-123  Add user authentication     In Progress
  PRJ-124  Fix login redirect          Todo
  PRJ-125  Update dependencies         Backlog
  ...

Next: `p. linear 123` for details, `p. linear start 123` to begin
```

---

## Subcommand: get <ID>

**Trigger**: `p. linear 123` or `p. linear PRJ-123`

```bash
RESULT=$(prjct linear get "PRJ-123")
```

### Output

```
PRJ-123: Add user authentication

Status: In Progress
Priority: High
Assignee: @user

Description:
{description text}

URL: https://linear.app/team/issue/PRJ-123

Next: `p. linear start 123` to begin, `p. task "PRJ-123"` to track in prjct
```

---

## Subcommand: start <ID>

**Trigger**: `p. linear start 123`

```bash
# 1. Get issue info
ISSUE=$(prjct linear get "PRJ-123")

# 2. Mark in progress
prjct linear start "PRJ-123"

# 3. Create git branch
git checkout -b "feature/PRJ-123-{slug}"
```

### Output

```
Started: PRJ-123 - {title}

Branch: feature/PRJ-123-add-user-auth
Linear: In Progress

Next: Work on the task, then `p. done`
```

---

## Subcommand: done <ID>

**Trigger**: `p. linear done 123`

```bash
prjct linear done "PRJ-123"
```

### Output

```
✅ Completed: PRJ-123 - {title}

Linear: Done
```

---

## Subcommand: create

**Trigger**: `p. linear "add feature X"` or `p. linear create "title"`

```bash
# Get default team from credentials
TEAMS=$(prjct linear teams)

# Create issue
RESULT=$(prjct linear create '{"title":"...","teamId":"..."}')
```

### Output

```
✅ Created: PRJ-126 - {title}

URL: https://linear.app/...

Next: `p. linear start 126` to begin
```

---

## Subcommand: comment <ID> <text>

**Trigger**: `p. linear comment 123 "Progress update..."`

```bash
prjct linear comment "PRJ-123" "Progress update..."
```

### Output

```
✅ Comment added to PRJ-123
```

---

## Subcommand: update <ID>

**Trigger**: `p. linear update 123` (then ask what to update)

```bash
prjct linear update "PRJ-123" '{"description":"..."}'
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Not configured | "Run `p. linear setup` to configure your API key" |
| Invalid API key | "Invalid API key. Get a new one at https://linear.app/settings/api" |
| Issue not found | "Issue PRJ-123 not found" |
| No project | "Run `p. init` first" |

---

## Credential Storage

Credentials are stored **per-project** to support multiple Linear workspaces:

**Location**: Stored securely via the CLI in SQLite

**Fallback chain**:
1. Project credentials (per-project)
2. Global keychain (macOS)
3. Environment variable (`LINEAR_API_KEY`)

---

## Performance

| Operation | Time |
|-----------|------|
| Fetch issue | ~150ms |
| List issues | ~300ms |
| Create issue | ~200ms |
