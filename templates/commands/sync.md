---
allowed-tools: [Read, Write, Bash, Glob, Grep]
description: 'Deep sync - analyze git, update ALL project data'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:sync - Deep Project Sync

**CRITICAL**: This is a DEEP analysis. Sync EVERYTHING with the real state of the repository.

## What Gets Analyzed & Updated

### Git Analysis (Deep)
- `git status` - Uncommitted changes, staged files
- `git log` - Recent commits to detect completed tasks
- `git diff` - What's changed since last commit
- `git branch` - Current branch, feature branches

### ALL MD Files Updated
- `core/now.md` - Current task (validate against git status)
- `core/next.md` - Task queue (remove completed ones)
- `progress/shipped.md` - Add tasks found in commits
- `planning/ideas.md` - Keep valid, remove implemented
- `planning/roadmap.md` - Update feature status

### Project Metadata
- `project.json` - ALL fields with real data
- `CLAUDE.md` - Quick Reference with real stats
- `analysis/repo-summary.md` - Full analysis
- `agents/*.md` - Specialized agents

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{cwd}`: Current working directory (repo path)

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
- `{stagedFiles}`: Files staged for commit (A, M, D prefixed with space)
- `{modifiedFiles}`: Modified but not staged (M, D without space prefix)
- `{untrackedFiles}`: New files (??)
- `{hasUncommittedChanges}`: true/false

### 2.2 Recent Commits (Last 20)
```bash
git log --oneline -20 --pretty=format:"%h|%s|%ad" --date=short
```

ANALYZE each commit message for:
- Keywords: "feat:", "fix:", "complete", "done", "implement", "add", "finish"
- Task patterns: "Task: X", "#123", issue references
- Feature completions: "feat(auth):", "feat: user login"

EXTRACT: `{completedTasks}` - List of tasks found in commits

### 2.3 Current Branch Analysis
```bash
git branch --show-current
git log main..HEAD --oneline 2>/dev/null || git log master..HEAD --oneline 2>/dev/null
```

EXTRACT:
- `{currentBranch}`: Current branch name
- `{branchCommits}`: Commits ahead of main
- `{isFeatureBranch}`: true if not main/master

### 2.4 Uncommitted Changes Summary
```bash
git diff --stat
git diff --cached --stat
```

EXTRACT: `{changesDescription}` - What files are being worked on

---

## Step 3: Gather Project Stats

### Count Files
```bash
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./.next/*" | wc -l
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

## Step 4: Sync Core MD Files

### 4.1 Update now.md (Current Task)

READ: `{globalPath}/core/now.md`

**Logic:**
- IF `{hasUncommittedChanges}` AND now.md is empty:
  - INFER task from modified files (e.g., "Working on: auth module")
  - UPDATE now.md with inferred task

- IF now.md has task AND task appears in recent commits:
  - Task is DONE → Clear now.md, add to shipped.md

- IF `{isFeatureBranch}`:
  - Suggest task based on branch name (e.g., `feature/auth` → "Implement authentication")

WRITE: `{globalPath}/core/now.md`

### 4.2 Update next.md (Task Queue)

READ: `{globalPath}/core/next.md`

**Logic:**
- Parse existing tasks (lines starting with `- `)
- For each task, check if it appears in `{completedTasks}` from commits
- REMOVE completed tasks from queue
- Keep remaining tasks

WRITE: `{globalPath}/core/next.md`

### 4.3 Update shipped.md (Completed Work)

READ: `{globalPath}/progress/shipped.md`

**Logic:**
- For each task in `{completedTasks}` from git commits:
  - Check if NOT already in shipped.md
  - ADD new entries with commit date

FORMAT for new entries:
```markdown
- **{taskName}** - {date}
  - Commit: {commitHash}
```

WRITE: `{globalPath}/progress/shipped.md`

### 4.4 Update ideas.md

READ: `{globalPath}/planning/ideas.md`

**Logic:**
- Parse existing ideas
- Check if any idea was implemented (appears in commits)
- REMOVE implemented ideas OR mark as done

WRITE: `{globalPath}/planning/ideas.md`

### 4.5 Update roadmap.md

READ: `{globalPath}/planning/roadmap.md`

**Logic:**
- Parse features and their status
- For each feature, check commits for implementation
- UPDATE status: planning → in-progress → completed
- Add completion dates where applicable

WRITE: `{globalPath}/planning/roadmap.md`

---

## Step 5: Update CLAUDE.md

READ: `{globalPath}/CLAUDE.md`

### Quick Reference Table (MUST UPDATE)

```markdown
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
```

### Git Status Section

```markdown
## Current Git Status

**Branch**: `{currentBranch}`
**Uncommitted Changes**: {hasUncommittedChanges ? "Yes" : "Clean"}

{IF hasUncommittedChanges}
### Modified Files
{list of modified files}

### What's Being Worked On
{changesDescription}
{ENDIF}
```

WRITE: `{globalPath}/CLAUDE.md`

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

## Step 7: Generate Analysis Files

### repo-summary.md
WRITE: `{globalPath}/analysis/repo-summary.md`

```markdown
# Repository Summary

> Generated: {GetTimestamp()}

## Project
- **Name**: {projectName}
- **Version**: {version}
- **Path**: {cwd}

## Stack
- **Languages**: {languages}
- **Frameworks**: {frameworks}
- **Package Manager**: {packageManager}

## Stats
- **Files**: {fileCount}
- **Commits**: {commitCount}
- **Contributors**: {contributorCount}

## Structure
- **Source**: {sourceDir}
- **Tests**: {testDir}
- **Config**: {configFiles}

## Git Status
- **Branch**: {currentBranch}
- **Uncommitted**: {hasUncommittedChanges}
- **Recent Activity**: {recentCommitCount} commits this week
```

### patterns.md (Code patterns detected)
Analyze code and WRITE: `{globalPath}/analysis/patterns.md`

---

## Step 8: Generate Agents (AGENTIC)

**CRITICAL**: Agent generation is AGENTIC - Claude decides based on raw data.

READ the raw data in `{globalPath}/CLAUDE.md`:
- Dependencies section
- File extensions section
- Config files section
- Directory structure section

Based on this RAW DATA, YOU (Claude) decide what specialists are needed.

**DO NOT use hardcoded rules.** Analyze the actual project data.

For EACH specialist you decide to create, call:
```typescript
const AgentGenerator = require('./core/domain/agent-generator').default
const generator = new AgentGenerator('{projectId}')
await generator.generateDynamicAgent('agent-name', {
  role: 'specific role based on your analysis',
  domain: 'domain you identified',
  expertise: 'technologies you found in the raw data'
})
```

**Examples of decisions YOU make:**
- Dependencies include 'react', 'next', 'tailwindcss' → Create 'frontend' agent with React/Next.js/Tailwind expertise
- File extensions show .ts, .tsx predominantly → TypeScript-focused agents
- Dependencies include 'express', 'prisma', 'pg' → Create 'backend' agent with Express/Prisma expertise
- Config files include 'vitest.config.ts' → Create 'testing' agent with Vitest expertise
- Directories include 'api/', 'server/' → Backend specialist

**DO NOT create generic 'developer' agent.** Create SPECIFIC specialists based on the raw data.

**The principle:** Code provides raw data, Claude analyzes and decides.

---

## Step 9: Log to Memory

APPEND to: `{globalPath}/memory/context.jsonl`

```json
{"ts":"{GetTimestamp()}","action":"sync","branch":"{currentBranch}","uncommitted":{hasUncommittedChanges},"tasksCompleted":{completedTaskCount},"fileCount":{fileCount},"commitCount":{commitCount}}
```

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

✅ Tasks Synced
├── Completed (from commits): {completedTaskCount}
├── Removed from queue: {removedFromQueue}
└── Added to shipped: {addedToShipped}

📁 Files Updated
├── core/now.md
├── core/next.md
├── progress/shipped.md
├── planning/ideas.md
├── planning/roadmap.md
├── project.json
├── CLAUDE.md
└── analysis/*.md

{IF hasUncommittedChanges}
⚠️  You have uncommitted changes:
{changesDescription}

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

## Examples

### Example: Clean repo, tasks completed
```
🔄 Deep Sync Complete

📊 Project Stats
├── Files: 156
├── Commits: 234
├── Version: 1.2.0
└── Stack: TypeScript + React + Node.js

🌿 Git Status
├── Branch: main
├── Uncommitted: Clean
└── Recent: 8 commits this week

✅ Tasks Synced
├── Completed (from commits): 3
├── Removed from queue: 2
└── Added to shipped: 3

📁 Files Updated
├── core/now.md (cleared - task completed)
├── core/next.md (2 tasks removed)
├── progress/shipped.md (+3 entries)
└── All metadata updated

✨ Repository is clean!

Next: /p:now to start a new task
```

### Example: Work in progress
```
🔄 Deep Sync Complete

📊 Project Stats
├── Files: 156
├── Commits: 234
├── Version: 1.2.0
└── Stack: TypeScript + React + Node.js

🌿 Git Status
├── Branch: feature/auth
├── Uncommitted: Yes - 5 files
└── Recent: 3 commits today

⚠️  You have uncommitted changes:
   M src/auth/login.tsx
   M src/auth/signup.tsx
   A src/auth/utils.ts

Working on: Authentication module

Next: Commit your work or continue coding
```
