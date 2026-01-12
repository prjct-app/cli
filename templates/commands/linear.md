---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Sync and enrich Linear issues with AI-generated context'
---

# p. linear - Issue Tracker Integration

Sync issues from Linear (or other trackers) and enrich them with AI-generated context.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{args}`: User-provided arguments (subcommand)

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. linear` | Show status + **your** assigned issues |
| `p. linear sync` | Fetch and enrich **your** assigned issues |
| `p. linear enrich <ID>` | Enrich specific issue (e.g., ENG-123) |
| `p. linear setup` | Configure Linear integration |
| `p. linear start <ID>` | Start working on issue → creates prjct task |

### Filter Options

| Flag | Description |
|------|-------------|
| (default) | Only issues assigned to you |
| `--team` | All issues in your configured team |
| `--project <name>` | Issues in a specific project |
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

## Step 2: Check Configuration

```
READ: {globalPath}/project.json
EXTRACT: integrations.issueTracker

IF not configured:
  OUTPUT: "Linear not configured."
  OUTPUT: "Run `p. linear setup` to configure."
  STOP

IF LINEAR_API_KEY not set:
  OUTPUT: "LINEAR_API_KEY environment variable not set."
  OUTPUT: "Get your API key from: https://linear.app/settings/api"
  STOP
```

---

## Step 3: Route Subcommand

### No args / status

```
SHOW:
- Connection status
- Team/project configured
- Assigned issues (first 10)

OUTPUT:
Linear: Connected ✓
Team: {teamName}
Issues assigned: {count}

Recent:
- {ENG-123} {title} ({status})
- ...
```

### sync

```
1. Fetch assigned issues from Linear
2. For each issue without enrichment:
   a. Use Task(Explore) to analyze codebase
   b. Generate enrichment using enricher.ts prompts
   c. Update issue description in Linear
   d. Save enriched data locally
3. Output summary

OUTPUT:
Synced {count} issues from Linear.
Enriched: {enrichedCount}
Updated in Linear: {updatedCount}
```

### enrich <ID>

```
1. Fetch issue by ID (e.g., ENG-123)
2. Analyze codebase for context
3. Generate full enrichment:
   - Enhanced description
   - Acceptance criteria
   - Affected files
   - Technical notes
   - Complexity estimate
4. Ask user to confirm before updating Linear
5. Update issue in Linear
6. Save locally

OUTPUT:
## {ID}: {title}

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
Update in Linear? [Y/n]
```

### setup

```
1. Check LINEAR_API_KEY
2. Connect to Linear
3. List available teams
4. Ask user to select default team
5. List projects (optional)
6. Save config to {globalPath}/project.json

OUTPUT:
Linear Setup

Connected as: {userName}
Workspace: {workspaceName}

Select team for new issues:
1. {team1}
2. {team2}
...

Config saved!
```

### start <ID>

```
1. Fetch issue from Linear
2. Enrich if not already enriched
3. Mark issue as "In Progress" in Linear
4. Create prjct task with enrichment data
5. Create git branch: {type}/{issueId}-{slug}

OUTPUT:
Started: {ID} - {title}

Branch: feature/ENG-123-add-user-auth
Linear status: In Progress

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
  "provider": "linear",
  "lastSync": "2024-01-15T10:30:00Z",
  "issues": {
    "ENG-123": {
      "id": "uuid",
      "externalId": "ENG-123",
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

## Error Handling

| Error | Action |
|-------|--------|
| No API key | "Set LINEAR_API_KEY. Get key: https://linear.app/settings/api" |
| Connection failed | Show error, suggest checking key |
| Issue not found | "Issue {ID} not found in Linear" |
| Rate limited | "Linear API rate limited. Try again in {time}" |

---

## Output Format

```
{action} {count} issues

{issueId}: {title}
Status: {status} → {newStatus}
Enriched: ✓

Next: {suggested action}
```
