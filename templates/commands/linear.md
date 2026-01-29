---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Linear issue tracker integration via SDK'
extends: '_bases/tracker-base.md'
---

# p. linear - Linear Integration

**ARGUMENTS**: $ARGUMENTS

Manage Linear issues directly from prjct using natural language.

## How This Works

User types natural commands → Claude interprets → Executes SDK → Shows formatted result

**Examples**:
- `p. linear` → List my assigned issues
- `p. linear 123` or `p. linear PRJ-123` → Get issue details
- `p. linear start 123` → Start working on issue
- `p. linear done 123` → Mark issue as done
- `p. linear setup` → Configure API key
- `p. linear "add auth feature"` → Create new issue

---

## CRITICAL - Execution Pattern

**NEVER use MCP tools** (`mcp__linear__*`, `mcp__claude_ai_Linear__*`).
**ALWAYS use SDK via CLI helper** (much faster, per-project credentials).

### CLI Helper (Internal Use)

```bash
# Setup paths first
PRJCT_CLI=$(npm root -g)/prjct-cli
PROJECT_ID=$(cat .prjct/prjct.config.json | jq -r '.projectId')

# Then run commands with --project flag
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID <command> [args...]
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
   RESULT=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID setup "$API_KEY")
   ```

3. **Parse result** - Contains `{ success, teams, defaultTeam }`

4. **If multiple teams, ask user to select**
   ```
   ASK: "Select your default team"
   OPTIONS: teams from result

   # Re-run setup with team selection
   bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID setup "$API_KEY" "$TEAM_ID"
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
RESULT=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID list)
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
RESULT=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID get "PRJ-123")
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
ISSUE=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID get "PRJ-123")

# 2. Mark in progress
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID start "PRJ-123"

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
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID done "PRJ-123"
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
TEAMS=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID teams)

# Create issue
RESULT=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID create '{"title":"...","teamId":"..."}')
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
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID comment "PRJ-123" "Progress update..."
```

### Output

```
✅ Comment added to PRJ-123
```

---

## Subcommand: update <ID>

**Trigger**: `p. linear update 123` (then ask what to update)

```bash
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID update "PRJ-123" '{"description":"..."}'
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

**Location**: `~/.prjct-cli/projects/{projectId}/config/credentials.json`

**Fallback chain**:
1. Project credentials (per-project)
2. Global keychain (macOS)
3. Environment variable (`LINEAR_API_KEY`)

---

## Performance

| Operation | SDK | MCP (deprecated) |
|-----------|-----|------------------|
| Fetch issue | ~150ms | ~600ms |
| List issues | ~300ms | ~1200ms |
| Create issue | ~200ms | ~800ms |
