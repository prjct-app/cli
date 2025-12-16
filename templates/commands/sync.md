---
allowed-tools: [Read, Write, Bash, Glob, Grep]
description: 'Deep sync - analyze git, update ALL project data'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/*.json'
claude-context: 'context/*.md'
backend-sync: 'sync/pending.json'
---

# /p:sync - Deep Project Sync

**CRITICAL**: This is a DEEP analysis. Sync EVERYTHING with the real state of the repository.

## Architecture: Write-Through Pattern

```
Git Analysis → Storage (JSON) → Context (MD) → Project Metadata
```

**Source of Truth**: `storage/*.json` (state, queue, ideas, shipped)
**Claude Context**: `context/*.md` (now, next, ideas, shipped, CLAUDE.md)
**Project Metadata**: `project.json`

## What Gets Analyzed & Updated

### Git Analysis (Deep)
- `git status` - Uncommitted changes, staged files
- `git log` - Recent commits to detect completed tasks
- `git diff` - What's changed since last commit
- `git branch` - Current branch, feature branches

### Storage Files (Source of Truth)
- `storage/state.json` - Current task state
- `storage/queue.json` - Task queue
- `storage/ideas.json` - Ideas list
- `storage/shipped.json` - Shipped features

### Context Files (Generated for Claude)
- `context/now.md` - Current task (from state.json)
- `context/next.md` - Task queue (from queue.json)
- `context/ideas.md` - Ideas (from ideas.json)
- `context/shipped.md` - Shipped (from shipped.json)
- `context/CLAUDE.md` - Full project context

### Project Metadata
- `project.json` - ALL fields with real data

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{cwd}`: Current working directory (repo path)

---

## Step 0: Migration Check (Legacy Projects)

CHECK: Does `.prjct/prjct.config.json` exist?

IF file exists:
  READ: `.prjct/prjct.config.json`
  CHECK: Does `projectId` exist and is it a valid UUID?

  IF projectId is missing OR not a UUID:
    MIGRATE to UUID:
    1. Generate new UUID: `{newProjectId}`
    2. Create global structure: `~/.prjct-cli/projects/{newProjectId}/`
    3. Create subdirectories: storage/, context/, agents/, memory/, analysis/
    4. IF legacy data exists in `.prjct/`:
       - Migrate core/now.md → storage/state.json
       - Migrate planning/ideas.md → storage/ideas.json
       - Migrate progress/shipped.md → storage/shipped.json
    5. Update `.prjct/prjct.config.json` with new `projectId`
    OUTPUT: "🔄 Migrated to UUID format: {newProjectId}"

IF file not found:
  CHECK: Does `.prjct/` directory exist? (legacy project without config)

  IF `.prjct/` exists:
    MIGRATE:
    1. Generate new UUID: `{newProjectId}`
    2. Create `.prjct/prjct.config.json` with `projectId`
    3. Create global structure
    4. Migrate legacy data
    OUTPUT: "🔄 Migrated legacy project to UUID: {newProjectId}"
  ELSE:
    OUTPUT: "No prjct project. Run /p:init first."
    STOP

---

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

---

## Step 2: Deep Git Analysis

### 2.1 Git Status (Uncommitted Work)
```bash
git status --porcelain
```

EXTRACT:
- `{stagedFiles}`: Files staged for commit
- `{modifiedFiles}`: Modified but not staged
- `{untrackedFiles}`: New files
- `{hasUncommittedChanges}`: true/false

### 2.2 Recent Commits (Last 20)
```bash
git log --oneline -20 --pretty=format:"%h|%s|%ad" --date=short
```

ANALYZE each commit for completed tasks.

EXTRACT: `{completedTasks}` - List of tasks found in commits

### 2.3 Current Branch Analysis
```bash
git branch --show-current
git log main..HEAD --oneline 2>/dev/null
```

EXTRACT:
- `{currentBranch}`: Current branch name
- `{branchCommits}`: Commits ahead of main
- `{isFeatureBranch}`: true if not main/master

---

## Step 3: Gather Project Stats

### Count Files
```bash
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l
```
EXTRACT: `{fileCount}`

### Count Commits
```bash
git rev-list --count HEAD
```
EXTRACT: `{commitCount}`

### Get Version
READ: `package.json` → version field
EXTRACT: `{version}`

### Get Project Name
READ: `package.json` → name field OR directory name
EXTRACT: `{projectName}`

### Detect Stack
GLOB for config files and analyze:
- `package.json` → Node.js, detect React/Vue/Express/Next.js
- `Cargo.toml` → Rust
- `go.mod` → Go
- `requirements.txt` / `pyproject.toml` → Python

EXTRACT: `{languages}`, `{frameworks}`, `{techStack}`

---

## Step 4: Regenerate ALL Context Files

### 4.1 Read Storage (Source of Truth)

READ: `{globalPath}/storage/state.json`
READ: `{globalPath}/storage/queue.json`
READ: `{globalPath}/storage/ideas.json`
READ: `{globalPath}/storage/shipped.json`

### 4.2 Generate context/now.md

WRITE: `{globalPath}/context/now.md`

IF state.currentTask exists:
```markdown
# NOW

**{state.currentTask.description}**

Started: {state.currentTask.startedAt}
Session: {state.currentTask.sessionId}
{IF estimate: Estimate: {state.currentTask.estimate}}
```

ELSE IF state.pausedTask exists:
```markdown
# NOW

⏸️ **{state.pausedTask.description}** (paused)

Paused: {state.pausedTask.pausedAt}
Reason: {state.pausedTask.pauseReason}
```

ELSE:
```markdown
# NOW

_No active task_

Use `/p:now <task>` to start working.
```

### 4.3 Generate context/next.md

WRITE: `{globalPath}/context/next.md`

```markdown
# NEXT

## Active

{FOR EACH task in queue.tasks WHERE section == "active":}
- [ ] {task.description} {task.priority ? `[${task.priority}]` : ''}
{END FOR}

## Backlog

{FOR EACH task in queue.tasks WHERE section == "backlog":}
- [ ] {task.description}
{END FOR}
```

### 4.4 Generate context/ideas.md

WRITE: `{globalPath}/context/ideas.md`

```markdown
# IDEAS

## Pending

{FOR EACH idea in ideas.ideas WHERE status == "pending":}
- **{idea.text}** {idea.tags.join(' ')}
  - Priority: {idea.priority}
  - Added: {idea.createdAt}
{END FOR}

## Converted

{FOR EACH idea in ideas.ideas WHERE status == "converted":}
- ~~{idea.text}~~ → Feature
{END FOR}
```

### 4.5 Generate context/shipped.md

WRITE: `{globalPath}/context/shipped.md`

```markdown
# SHIPPED 🚀

## {Current Month Year}

{FOR EACH ship in shipped.shipped WHERE month matches:}
- **{ship.name}** v{ship.version} - {formatDate(ship.shippedAt)}
{END FOR}

---

**Total shipped:** {shipped.shipped.length}
```

---

## Step 5: Update context/CLAUDE.md

WRITE: `{globalPath}/context/CLAUDE.md`

```markdown
# {projectName} - Project Context
<!-- projectId: {projectId} -->
<!-- Generated: {GetTimestamp()} -->

## Quick Reference

| Field | Value |
|-------|-------|
| **Name** | {projectName} |
| **Version** | {version} |
| **Stack** | {stack} |
| **Files** | {fileCount} |
| **Commits** | {commitCount} |
| **Branch** | {currentBranch} |
| **Path** | {cwd} |
| **Last Sync** | {GetTimestamp()} |

## Current Git Status

**Branch**: `{currentBranch}`
**Uncommitted Changes**: {hasUncommittedChanges ? "Yes" : "Clean"}

{IF hasUncommittedChanges}
### Modified Files
{list of modified files}
{ENDIF}

## PROJECT DATA

### Dependencies
{list dependencies from package.json}

### Scripts
{list scripts from package.json}

## CURRENT STATE

**Now:** {currentTask or "_No active task_"}

**Queue ({queue.tasks.length}):**
{list first 5 tasks}

**Ideas ({ideas.ideas.length}):**
{list first 3 ideas}

## DATA LOCATION

\`\`\`
~/.prjct-cli/projects/{projectId}/
├── storage/        # JSON (source of truth)
│   ├── state.json
│   ├── queue.json
│   ├── ideas.json
│   └── shipped.json
├── context/        # MD (for Claude)
│   ├── CLAUDE.md
│   ├── now.md
│   ├── next.md
│   ├── ideas.md
│   └── shipped.md
├── sync/           # Backend sync
│   └── pending.json
└── agents/         # Specialists
\`\`\`
```

---

## Step 6: Update project.json

READ existing: `{globalPath}/project.json` (preserve createdAt)

WRITE: `{globalPath}/project.json`

```json
{
  "projectId": "{projectId}",
  "repoPath": "{cwd}",
  "name": "{projectName}",
  "version": "{version}",
  "techStack": {techStack},
  "fileCount": {fileCount},
  "commitCount": {commitCount},
  "stack": "{stack}",
  "currentBranch": "{currentBranch}",
  "hasUncommittedChanges": {hasUncommittedChanges},
  "createdAt": "{existingCreatedAt || GetTimestamp()}",
  "lastSync": "{GetTimestamp()}"
}
```

---

## Step 7: Generate Claude Code Sub-Agents (AGENTIC)

Generate sub-agents for Claude Code in the GLOBAL storage `{globalPath}/agents/` directory.

### 7.1 Create Directory

```bash
mkdir -p {globalPath}/agents
```

### 7.2 Read Generation Instructions

READ: `templates/agentic/subagent-generation.md`

This template contains:
- Which workflow agents to ALWAYS generate
- Which domain agents to generate based on stack
- Format and structure requirements

### 7.3 Generate Workflow Agents (ALWAYS)

These 3 agents are ALWAYS created for every prjct project:

**prjct-workflow.md** - Handles: /p:now, /p:done, /p:next, /p:pause, /p:resume
READ template: `templates/subagents/workflow/prjct-workflow.md`
ADAPT with: projectId, projectPath
WRITE to: `{globalPath}/agents/prjct-workflow.md`

**prjct-planner.md** - Handles: /p:feature, /p:idea, /p:spec, /p:bug
READ template: `templates/subagents/workflow/prjct-planner.md`
ADAPT with: projectId, projectPath
WRITE to: `{globalPath}/agents/prjct-planner.md`

**prjct-shipper.md** - Handles: /p:ship
READ template: `templates/subagents/workflow/prjct-shipper.md`
ADAPT with: projectId, projectPath, detected test/lint commands
WRITE to: `{globalPath}/agents/prjct-shipper.md`

### 7.4 Generate Domain Agents (Based on Stack)

Analyze `{techStack}` from Step 3 and generate ONLY relevant domain agents:

| If Detected | Generate | Template |
|-------------|----------|----------|
| React, Vue, Angular, Svelte, CSS | `frontend.md` | `templates/subagents/domain/frontend.md` |
| Node.js, Express, Go, Python API | `backend.md` | `templates/subagents/domain/backend.md` |
| PostgreSQL, MySQL, MongoDB, Prisma | `database.md` | `templates/subagents/domain/database.md` |
| Docker, Kubernetes, GitHub Actions | `devops.md` | `templates/subagents/domain/devops.md` |
| Jest, Pytest, Vitest, testing | `testing.md` | `templates/subagents/domain/testing.md` |

For EACH detected stack:
1. READ template from `templates/subagents/domain/{name}.md`
2. ADAPT description with detected frameworks (e.g., "React specialist" not just "frontend")
3. WRITE to `{globalPath}/agents/{name}.md`

### 7.5 Report Generated Agents

Track which agents were generated for output:
- `{workflowAgents}`: Always 3 (prjct-workflow, prjct-planner, prjct-shipper)
- `{domainAgents}`: List of domain agents generated

---

## Step 8: Log to Memory

APPEND to: `{globalPath}/memory/events.jsonl`

```json
{"ts":"{GetTimestamp()}","action":"sync","branch":"{currentBranch}","uncommitted":{hasUncommittedChanges},"fileCount":{fileCount},"commitCount":{commitCount}}
```

---

## Step 9: Backend Sync (Cloud)

Sync with prjct API if authenticated.

### 9.1 Check Authentication

READ: `~/.prjct-cli/config/auth.json`

IF no auth OR no apiKey:
  SET: `{cloudSync}` = false
  OUTPUT TIP: "💡 Run `prjct auth` to enable cloud sync"
  CONTINUE to output (skip 9.2, 9.3)

ELSE:
  SET: `{cloudSync}` = true

### 9.2 Push Pending Events

READ: `{globalPath}/sync/pending.json`
COUNT: `{pendingCount}` events

IF pendingCount > 0:
  CALL syncManager.push(projectId)

  IF success:
    SET: `{pushedCount}` = result.count
    OUTPUT: "☁️ Pushed {pushedCount} events to cloud"
  ELSE:
    OUTPUT: "⚠️ Cloud sync failed: {error}. Events queued for retry."
    SET: `{syncError}` = error
ELSE:
  SET: `{pushedCount}` = 0

### 9.3 Pull Updates (if push succeeded)

IF cloudSync AND no syncError:
  CALL syncManager.pull(projectId)

  IF success AND result.count > 0:
    SET: `{pulledCount}` = result.count
    OUTPUT: "📥 Pulled {pulledCount} updates from cloud"
  ELSE:
    SET: `{pulledCount}` = 0

---

## Output

```
🔄 Deep Sync Complete

📊 Project Stats
├── Files: {fileCount}
├── Commits: {commitCount}
├── Version: {version}
└── Stack: {stack}

🌿 Git Status
├── Branch: {currentBranch}
├── Uncommitted: {hasUncommittedChanges ? "Yes - " + modifiedCount + " files" : "Clean"}
└── Recent: {recentCommitCount} commits this week

📁 Context Updated
├── context/now.md
├── context/next.md
├── context/ideas.md
├── context/shipped.md
└── context/CLAUDE.md

🤖 Claude Code Sub-Agents ({workflowAgents.length + domainAgents.length})
├── Workflow: prjct-workflow, prjct-planner, prjct-shipper
└── Domain: {domainAgents.join(', ') || 'none'}

{IF cloudSync}
☁️ Cloud Sync
├── Pushed: {pushedCount} events
├── Pulled: {pulledCount} updates
└── Status: {syncError ? "⚠️ " + syncError : "✓ Synced"}
{ELSE}
💡 Cloud sync disabled. Run `prjct auth` to enable.
{ENDIF}

{IF hasUncommittedChanges}
⚠️  You have uncommitted changes

Next: Commit your work or continue coding
{ELSE}
✨ Repository is clean!

Next: /p:now to start a new task
{ENDIF}
```

---

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No config | "No prjct project" | STOP |
| Not a git repo | "Not a git repository" | WARN, continue without git |
| No commits | Use defaults | CONTINUE |
| File read error | Skip that file | CONTINUE |

---

## File Structure Reference

```
~/.prjct-cli/projects/{projectId}/
├── storage/                  # Source of Truth (JSON)
│   ├── state.json           # Current + paused task
│   ├── queue.json           # Task queue
│   ├── ideas.json           # Ideas list
│   └── shipped.json         # Shipped features
├── context/                  # For Claude (MD)
│   ├── CLAUDE.md            # Full context
│   ├── now.md               # Current task
│   ├── next.md              # Queue
│   ├── ideas.md             # Ideas
│   └── shipped.md           # Shipped
├── sync/                     # Backend Sync
│   └── pending.json         # Events queue
├── agents/                   # Specialists (legacy)
├── memory/                   # Audit Trail
│   └── events.jsonl
└── project.json             # Metadata

# Sub-Agents are in {globalPath}/agents/ (NOT in project .claude/)
├── prjct-workflow.md        # /p:now, /p:done, /p:next
├── prjct-planner.md         # /p:feature, /p:idea, /p:spec
├── prjct-shipper.md         # /p:ship
├── frontend.md              # (if React/Vue/Angular detected)
├── backend.md               # (if Node/Go/Python API detected)
├── database.md              # (if DB detected)
├── devops.md                # (if Docker/K8s detected)
└── testing.md               # (if test framework detected)
```
