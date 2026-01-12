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

### Detect Frontend/UI Stack (for UX/UI Agent)

**CRITICAL**: If ANY frontend technology is detected, generate the UX/UI agent.

#### Web Frontend Detection
```bash
# Check package.json for web frameworks
grep -E '"(react|react-dom|next|vue|nuxt|svelte|@sveltejs/kit|@angular/core)"' package.json 2>/dev/null
```

SET: `{hasWebFrontend}` = true if any match

#### Mobile Frontend Detection
```bash
# React Native / Expo
grep -E '"(react-native|expo)"' package.json 2>/dev/null

# Flutter
test -f pubspec.yaml && echo "flutter"

# SwiftUI (iOS)
find . -name "*.swift" -exec grep -l "import SwiftUI" {} \; 2>/dev/null | head -1

# Jetpack Compose (Android)
find . -name "*.kt" -exec grep -l "androidx.compose" {} \; 2>/dev/null | head -1
```

SET: `{hasMobileFrontend}` = true if any match

#### Combined Frontend Flag
```
{hasFrontendUI} = {hasWebFrontend} OR {hasMobileFrontend}
```

EXTRACT: `{frontendType}` = "web" | "mobile" | "both" | null

---

## Step 3.5: Deep Project Analysis (TRULY AGENTIC)

**CRITICAL: Do NOT follow hardcoded rules. ANALYZE the actual project and UNDERSTAND what it is.**

### 3.5.1 Detect Project Type (AGENTIC)

**Look at the project root and DETERMINE what kind of project this is:**

```bash
ls -la
```

ANALYZE what files exist and REASON about the project type:

| If you see... | Project is... | Ecosystem |
|---------------|---------------|-----------|
| `Gemfile` | Ruby/Rails | Ruby |
| `requirements.txt`, `pyproject.toml`, `setup.py` | Python | Python |
| `go.mod` | Go | Go |
| `Cargo.toml` | Rust | Rust |
| `composer.json` | PHP | PHP |
| `pom.xml`, `build.gradle` | Java | JVM |
| `*.csproj`, `*.sln` | .NET/C# | .NET |
| `mix.exs` | Elixir | Elixir |
| `Package.swift` | Swift | Apple |
| `package.json` | Node.js/JavaScript | JavaScript |
| `pubspec.yaml` | Flutter/Dart | Dart |
| `Makefile` only | C/C++ or custom | Native |

SET: `{ecosystem}` = detected ecosystem
SET: `{projectType}` = specific type (e.g., "Rails", "Django", "Next.js", "Go API")

### 3.5.2 Detect Commands FOR THIS PROJECT (AGENTIC)

**Based on the ecosystem, LOOK for the actual commands this project uses:**

#### Ruby/Rails
```bash
cat Gemfile | head -20  # See dependencies
test -f bin/rails && echo "rails"
test -f Rakefile && echo "rake"
```
→ Commands: `bundle install`, `rails s`, `rails c`, `rake db:migrate`, `rspec`

#### Python
```bash
test -f pyproject.toml && cat pyproject.toml | head -20
test -f requirements.txt && echo "pip"
which poetry && echo "poetry"
which uv && echo "uv"
```
→ Commands: `pip install -r requirements.txt` OR `poetry install` OR `uv sync`

#### Go
```bash
cat go.mod | head -5
```
→ Commands: `go build`, `go test ./...`, `go run .`

#### Rust
```bash
cat Cargo.toml | head -10
```
→ Commands: `cargo build`, `cargo test`, `cargo run`

#### Node.js/JavaScript
```bash
# Check lockfile to determine package manager
test -f bun.lockb && echo "bun"
test -f pnpm-lock.yaml && echo "pnpm"
test -f yarn.lock && echo "yarn"
test -f package-lock.json && echo "npm"
cat package.json | grep -A 20 '"scripts"'
```
→ Commands: Use detected package manager + scripts from package.json

**EXTRACT the actual commands:**
- `{installCommand}` = what installs dependencies
- `{runCommand}` = how to run scripts
- `{testCommand}` = how to run tests
- `{buildCommand}` = how to build
- `{devCommand}` = how to run dev server

### 3.5.3 Detect Code Conventions (AGENTIC)

**LOOK at actual files to understand patterns:**

```bash
# List some source files
find . -type f \( -name "*.rb" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.ts" -o -name "*.js" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -10

# Check for linters/formatters
ls .rubocop.yml .eslintrc* .prettierrc* pyproject.toml rustfmt.toml .golangci.yml 2>/dev/null
```

ANALYZE and DETERMINE:
- `{namingConvention}` = based on actual file names
- `{linter}` = what linter is configured
- `{formatter}` = what formatter is used

### 3.5.4 Detect Project Structure (AGENTIC)

```bash
ls -d */ 2>/dev/null | head -10
```

UNDERSTAND the structure:
- Where is source code?
- Where are tests?
- Is it a monorepo?
- What's the architecture?

### 3.5.5 Generate Project-Specific Rules (AGENTIC)

**Based on YOUR ANALYSIS, generate rules that make sense for THIS project.**

Think: "What does a developer working on this project need to know?"

Examples:
- Rails project: "Use `bundle exec` for Ruby commands", "Migrations: `rails db:migrate`"
- Python/Poetry: "Use `poetry run` to run commands in venv"
- Go project: "Use `go test ./...` to run all tests"
- Rust project: "Use `cargo fmt` before commits"
- Node/bun: "Use `bun` not npm - this project has bun.lockb"

### 3.5.6 Write analysis/repo-analysis.json

```bash
mkdir -p {globalPath}/analysis
```

WRITE: `{globalPath}/analysis/repo-analysis.json`

```json
{
  "analyzedAt": "{timestamp}",
  "ecosystem": "{ecosystem}",
  "projectType": "{projectType}",
  "commands": {
    "install": "{installCommand}",
    "run": "{runCommand}",
    "test": "{testCommand}",
    "build": "{buildCommand}",
    "dev": "{devCommand}",
    "lint": "{lintCommand}",
    "format": "{formatCommand}"
  },
  "conventions": {
    "naming": "{namingConvention}",
    "linter": "{linter}",
    "formatter": "{formatter}"
  },
  "structure": {
    "srcDir": "{srcDir}",
    "testDir": "{testDir}",
    "isMonorepo": {isMonorepo}
  },
  "rules": [
    "{rule1 - generated based on analysis}",
    "{rule2 - generated based on analysis}",
    "..."
  ]
}
```

---

## Step 3.6: Generate/Update Roadmap (For Existing Projects)

**CRITICAL**: This step populates the roadmap from git history for existing projects.
Features detected from git are marked as `legacy: true` - they do NOT require PRDs.

### 3.6.1 Check if Roadmap Exists

READ: `{globalPath}/storage/roadmap.json`

```
IF roadmap.json does NOT exist:
  SET: {isNewRoadmap} = true
  SET: {existingFeatures} = []
ELSE:
  SET: {isNewRoadmap} = false
  SET: {existingFeatures} = roadmap.features
```

IF roadmap already has features AND was NOT generated from git:
  SKIP to Step 4 (don't overwrite manual roadmap)

### 3.6.2 Analyze Git History for Features

```bash
# Get all commits with conventional commit format (last 200)
git log --oneline --all --pretty=format:"%h|%s|%ad|%an" --date=short | head -200
```

PARSE commits and GROUP by conventional commit type:

| Prefix | Type | Maps To |
|--------|------|---------|
| `feat:` | Feature | New feature |
| `fix:` | Bug Fix | Bug fix (not a feature) |
| `refactor:` | Refactor | Code change (not a feature) |
| `chore:` | Chore | Maintenance (not a feature) |
| `docs:` | Docs | Documentation (not a feature) |
| `perf:` | Performance | Enhancement |
| `test:` | Test | Testing (not a feature) |

**Feature Grouping Logic:**

```
FOR EACH commit with "feat:" prefix:
  EXTRACT: feature name from commit message
  # e.g., "feat: add user authentication" → "user authentication"
  # e.g., "feat(api): implement rate limiting" → "api rate limiting"

  GROUP commits by similar feature names
  COUNT commits per feature group
  SUM lines changed per group: git show --stat {commit} | tail -1
```

SET: `{detectedFeatures}` = grouped features with:
- name
- commits (array of {hash, message, date})
- totalCommits
- linesAdded
- linesRemoved
- firstCommitDate
- lastCommitDate

### 3.6.3 Analyze Feature Branches

```bash
git branch -a --format='%(refname:short)|%(upstream:short)|%(committerdate:short)' 2>/dev/null
```

FOR EACH branch:
  IF branch name matches `feature/*` or `feat/*`:
    COUNT commits ahead of main:
    ```bash
    git rev-list --count main..{branch} 2>/dev/null || echo "0"
    ```

    ADD to `{activeBranches}`:
    - name: branch name
    - commitsAhead: count
    - lastCommit: date

### 3.6.4 Analyze Tags (Shipped Versions)

```bash
git tag --sort=-creatordate --format='%(refname:short)|%(creatordate:short)' 2>/dev/null | head -20
```

FOR EACH tag:
  EXTRACT version from tag name
  LINK to features completed before tag date
  ADD to `{versionTags}` array

### 3.6.5 Generate Initial Roadmap

IF {isNewRoadmap} OR roadmap was generated from git:

  GENERATE UUIDs:
  ```bash
  # For each feature
  bun -e "console.log('feat_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('feat_' + require('crypto').randomUUID().slice(0,8))"
  ```

  WRITE: `{globalPath}/storage/roadmap.json`

  ```json
  {
    "strategy": null,
    "features": [
      // COMPLETED FEATURES (from git history)
      {
        "id": "feat_{uuid8}",
        "name": "{detected feature name}",
        "description": "Inferred from git history",
        "date": "{firstCommitDate}",
        "status": "completed",
        "impact": "medium",
        "progress": 100,
        "tasks": [],
        "createdAt": "{firstCommitDate}",
        "completedDate": "{lastCommitDate}",

        // LEGACY MARKERS
        "legacy": true,
        "prdId": null,
        "inferredFrom": "git",

        // GIT DATA
        "commits": [
          {"hash": "{hash}", "message": "{message}", "date": "{date}"}
        ],
        "effort": {
          "estimated": null,
          "actual": {
            "commits": {totalCommits},
            "linesAdded": {linesAdded},
            "linesRemoved": {linesRemoved}
          }
        }
      },

      // ACTIVE FEATURES (from branches)
      {
        "id": "feat_{uuid8}",
        "name": "{branch name without prefix}",
        "description": "Work in progress",
        "date": "{today}",
        "status": "active",
        "impact": "medium",
        "progress": 0,
        "tasks": [],
        "createdAt": "{today}",

        // LEGACY MARKERS
        "legacy": true,
        "prdId": null,
        "inferredFrom": "git-branch",

        // BRANCH DATA
        "branch": "{branch name}",
        "commitsAhead": {count}
      }
    ],
    "backlog": [],
    "quarters": [],
    "lastUpdated": "{timestamp}",
    "generatedFrom": "git-history",
    "generatedAt": "{timestamp}"
  }
  ```

### 3.6.6 Initialize PRDs Storage

IF `{globalPath}/storage/prds.json` does NOT exist:
  CREATE empty prds.json:
  ```json
  {
    "prds": [],
    "lastUpdated": "{timestamp}"
  }
  ```

### 3.6.7 Output

```
📊 Roadmap {isNewRoadmap ? "Generated" : "Updated"} from Git History

Detected Features:
├── Completed: {completedFeatures.length} features
{FOR EACH completedFeature (max 5)}
│   └── {name} ({totalCommits} commits)
{END FOR}
├── Active: {activeBranches.length} in progress
{FOR EACH activeBranch}
│   └── {name} ({commitsAhead} commits ahead)
{END FOR}
└── Legacy Mode: PRDs not required for existing work

Going forward, use `p. prd <title>` before starting new features.
```

SET: `{roadmapGenerated}` = true
SET: `{completedCount}` = completed features count
SET: `{activeCount}` = active branches count

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

## Step 5: Update context/CLAUDE.md (CRITICAL - AGENTIC)

**ALWAYS OVERWRITE** this file on every sync.

READ: `{globalPath}/analysis/repo-analysis.json` to get the analysis you just did.

WRITE: `{globalPath}/context/CLAUDE.md`

**Generate this file BASED ON YOUR ANALYSIS. The content below is a TEMPLATE - adapt it to what you found.**

```markdown
# {projectName} - Project Rules
<!-- projectId: {projectId} -->
<!-- Generated: {GetTimestamp()} -->
<!-- Ecosystem: {ecosystem} | Type: {projectType} -->

## THIS PROJECT ({ecosystem})

**Type:** {projectType}
**Path:** {cwd}

### Commands (USE THESE, NOT OTHERS)

| Action | Command |
|--------|---------|
| Install dependencies | \`{installCommand}\` |
| Run dev server | \`{devCommand}\` |
| Run tests | \`{testCommand}\` |
| Build | \`{buildCommand}\` |
| Lint | \`{lintCommand}\` |
| Format | \`{formatCommand}\` |

### Project-Specific Rules

{FOR EACH rule in analysis.rules}
- {rule}
{END FOR}

### Code Conventions

- **Naming**: {namingConvention}
- **Linter**: {linter}
- **Formatter**: {formatter}
{IF isMonorepo}
- **Monorepo**: Check which package you're in before running commands
{ENDIF}

---

## DO vs DON'T (FOR THIS PROJECT)

| DO | DON'T |
|----|-------|
| \`{installCommand}\` | Wrong install command for this ecosystem |
| \`{testCommand}\` | Wrong test command |
| Read files before editing | Assume contents |
| Use Task(Explore) to understand | Jump to conclusions |
| Ask when uncertain | Make assumptions |

---

## PRJCT RULES

### Path Resolution
**ALL prjct writes go to**: \`~/.prjct-cli/projects/{projectId}/\`
- NEVER write to \`.prjct/\`
- NEVER write to \`./\` for prjct data

### Workflow
\`\`\`
p. sync → p. task "desc" → [work] → p. done → p. ship
\`\`\`

| Command | Action |
|---------|--------|
| \`p. sync\` | Re-analyze project |
| \`p. task X\` | Start task |
| \`p. done\` | Complete subtask |
| \`p. ship X\` | Ship feature |

---

## PROJECT STATE

| Field | Value |
|-------|-------|
| Name | {projectName} |
| Version | {version} |
| Ecosystem | {ecosystem} |
| Branch | {currentBranch} |
| Files | {fileCount} |

**Current Task:** {currentTask.description || "_None_"}
**Queue:** {queue.tasks.length} tasks

---

## AGENTS

Load from \`{globalPath}/agents/\`:
{FOR EACH agent in generatedAgents}
- \`{agent}.md\`
{END FOR}

---

## STRUCTURE

\`\`\`
{srcDir}/           # Source code
{testDir}/          # Tests
{globalPath}/
├── storage/        # prjct state
├── context/        # This file
├── agents/         # Domain experts
└── analysis/       # repo-analysis.json
\`\`\`
```

---

## Step 6: Update project.json (CRITICAL: cliVersion)

READ existing: `{globalPath}/project.json` (preserve createdAt, integrations)

GET CLI version (REQUIRED - this clears the status line warning):
```bash
bun -e "console.log(require('./package.json').version)" 2>/dev/null || node -e "console.log(require('./package.json').version)"
```
SET: `{cliVersion}` = result (e.g., "0.25.1")

CHECK: `{previousCliVersion}` = existing.cliVersion (if any)
SET: `{isVersionUpgrade}` = previousCliVersion != cliVersion OR previousCliVersion is missing

**CRITICAL**: The `cliVersion` field MUST be written to project.json. This field:
- Clears the "⚠️ prjct v{version} available!" status line warning
- Indicates which CLI version last synced this project
- If missing, the warning will persist even after sync

WRITE: `{globalPath}/project.json` (merge with existing, but ALWAYS update these fields):

```json
{
  "projectId": "{projectId}",
  "repoPath": "{cwd}",
  "name": "{projectName}",
  "version": "{version}",
  "cliVersion": "{cliVersion}",  // ← REQUIRED: Must match CLI version to clear warning
  "techStack": {techStack},
  "fileCount": {fileCount},
  "commitCount": {commitCount},
  "stack": "{stack}",
  "currentBranch": "{currentBranch}",
  "hasUncommittedChanges": {hasUncommittedChanges},
  "createdAt": "{existingCreatedAt || GetTimestamp()}",
  "lastSync": "{GetTimestamp()}",
  "integrations": "{existing.integrations || {}}"  // ← Preserve integrations
}
```

---

## Step 7: Generate Claude Code Sub-Agents (AGENTIC)

Generate sub-agents for Claude Code in the GLOBAL storage `{globalPath}/agents/` directory.

### 7.0 PURGE Legacy Agents (CRITICAL)

**ALWAYS purge all existing agents to ensure no legacy remains.**

```bash
rm -rf {globalPath}/agents/*
```

OUTPUT: "🗑️ Purged legacy agents"

This ensures:
- Old agent formats are removed
- New agent templates are used
- No outdated instructions remain

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
| Bun test, Jest, Pytest, testing | `testing.md` | `templates/subagents/domain/testing.md` |
| **{hasFrontendUI} = true** | `uxui.md` | `templates/agentic/agents/uxui.md` |

For EACH detected stack:
1. READ template from `templates/subagents/domain/{name}.md`
2. ADAPT description with detected frameworks (e.g., "React specialist" not just "frontend")
3. WRITE to `{globalPath}/agents/{name}.md`

### 7.5 Generate UX/UI Agent (CRITICAL for Frontend Projects)

**Priority: UX > UI** - User experience is more important than visuals.

IF `{hasFrontendUI}` == true:

1. READ template: `templates/agentic/agents/uxui.md`
2. WRITE to: `{globalPath}/agents/uxui.md`
3. ADD to `{domainAgents}`: "uxui"

OUTPUT: "🎨 Generated UX/UI agent for {frontendType} ({frameworks detected})"

The UX/UI agent ensures:
- **UX First**: Clarity, feedback, reduced friction, error handling, accessibility
- **Modern UI**: Distinctive typography, bold colors, purposeful animation
- **Anti-patterns avoided**: No "AI slop" (Inter font, purple gradients, generic layouts)
- **Checklists**: UX and UI quality gates before shipping

### 7.6 Report Generated Agents

Track which agents were generated for output:
- `{workflowAgents}`: Always 3 (prjct-workflow, prjct-planner, prjct-shipper)
- `{domainAgents}`: List of domain agents generated

---

## Step 7.5: Install Claude Code Skills (AGENTIC)

**CRITICAL: This step is AGENTIC. Search claude-plugins.dev dynamically to find the best skills.**

Skills in Claude Code are markdown files in `~/.claude/skills/`. We search the marketplace and download the best matching skills for each agent.

### 7.5.1 Check Existing Skills

```bash
ls ~/.claude/skills/*.md 2>/dev/null || echo "none"
```

SET: `{existingSkills}` = list of installed skill files

### 7.5.2 Search & Install Skills (AGENTIC)

**For each generated agent, search claude-plugins.dev and install the best skill.**

```
{skillsToFind} = [
  { agent: "frontend", searchTerms: ["frontend-design", "react", "ui components"] },
  { agent: "uxui", searchTerms: ["ux-designer", "frontend-design", "ui ux"] },
  { agent: "backend", searchTerms: ["{ecosystem} backend", "api design", "backend patterns"] },
  { agent: "testing", searchTerms: ["testing", "test automation", "{ecosystem} testing"] },
  { agent: "devops", searchTerms: ["devops", "ci cd", "docker kubernetes"] },
  { agent: "prjct-planner", searchTerms: ["feature development", "architecture", "planning"] },
  { agent: "prjct-shipper", searchTerms: ["code review", "pr review", "shipping"] }
]

FOR EACH entry in {skillsToFind}:
  IF {entry.agent} IN {generatedAgents}:

    # Step A: Search claude-plugins.dev
    USE WebFetch:
      url: "https://claude-plugins.dev/skills?q={entry.searchTerms[0]}"
      prompt: "Find the best skill for {entry.agent}. Return: skill name, author, install URL"

    SET: {searchResult} = result

    # Step B: Analyze results and pick best match
    ANALYZE {searchResult}:
      - Prefer @anthropics skills (official)
      - Prefer skills with high download count
      - Match the agent's domain

    SET: {bestSkill} = selected skill

    # Step C: Check if already installed
    IF {bestSkill.name}.md NOT IN {existingSkills}:

      # Step D: Get skill content from GitHub
      USE WebFetch:
        url: "{bestSkill.githubUrl}/raw/main/skills/{bestSkill.name}.md"
        prompt: "Get the complete skill markdown content"

      SET: {skillContent} = result

      # Step E: Install to ~/.claude/skills/
      ```bash
      mkdir -p ~/.claude/skills
      ```

      WRITE: `~/.claude/skills/{bestSkill.name}.md`
      CONTENT: {skillContent}

      OUTPUT: "📦 Installed skill: {bestSkill.name} (from {bestSkill.author})"
      ADD {bestSkill} to {installedSkills}

    ELSE:
      OUTPUT: "✓ Skill exists: {bestSkill.name}"
      ADD {bestSkill.name} to {verifiedSkills}
```

### 7.5.3 Skill Search Fallbacks

If WebFetch fails or no results found:

```
FALLBACK SKILLS (use these if search fails):
- frontend/uxui → "frontend-design" from @anthropics/claude-code
- backend (JS/TS) → Search "typescript backend patterns"
- backend (Python) → Search "python backend patterns"
- testing → Search "testing automation"
- devops → Search "devops ci cd"
- planner → Search "architecture planning"
- shipper → Search "code review"
```

### 7.5.4 Create Custom Skill if Not Found

If no suitable skill found on marketplace, CREATE a minimal skill:

```markdown
---
name: {agent}-skill
description: Custom skill for {agent} agent
---

# {Agent} Skill

This is a custom skill for the {agent} domain.

## Expertise
{Based on agent's domain - frontend, backend, etc.}

## Patterns
{Common patterns for this domain}
```

WRITE to: `~/.claude/skills/{agent}-custom.md`

### 7.5.5 Save Skills Configuration

```bash
mkdir -p {globalPath}/config
```

WRITE: `{globalPath}/config/skills.json`

```json
{
  "projectId": "{projectId}",
  "ecosystem": "{ecosystem}",
  "installedAt": "{GetTimestamp()}",
  "searchedAt": "{GetTimestamp()}",
  "skills": [
    {
      "name": "{skill.name}",
      "source": "{skill.source}",
      "author": "{skill.author}",
      "path": "~/.claude/skills/{skill.name}.md",
      "linkedAgents": ["{agents that use this skill}"]
    }
  ],
  "agentSkillMap": {
    "{agent}": "{skill.name}"
  }
}
```

### 7.5.6 Update Agent Frontmatter

FOR EACH agent file in `{globalPath}/agents/`:
  READ agent file
  GET skill from agentSkillMap[agent.name]

  IF skill exists AND frontmatter.skills is missing:
    UPDATE frontmatter to include: `skills: [{skill}]`
    WRITE updated agent file

### 7.5.7 Output Summary

```
SET: {skillsInstalled} = list of newly installed
SET: {skillsVerified} = list of already existing
SET: {skillsCreated} = list of custom-created
SET: {totalSkills} = count of all

OUTPUT:
📦 Skills Synchronized
├── Installed: {skillsInstalled.length} new from marketplace
├── Verified: {skillsVerified.length} already exist
├── Created: {skillsCreated.length} custom skills
└── Location: ~/.claude/skills/
```

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
🔄 Project synced to prjct v{cliVersion}

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

🤖 Agents Regenerated ({workflowAgents.length + domainAgents.length})
├── Workflow: prjct-workflow, prjct-planner, prjct-shipper
├── Domain: {domainAgents.join(', ') || 'none'}
{IF hasFrontendUI}
└── 🎨 UX/UI: uxui.md (Priority: UX > UI)
{ENDIF}

📦 Skills ({totalSkills})
├── Installed: {skillsInstalled.length ? skillsInstalled.join(', ') : 'none'}
├── Verified: {skillsVerified.length ? skillsVerified.join(', ') : 'none'}
└── Config: {globalPath}/config/skills.json

🔗 Agent → Skill Mapping
{FOR EACH entry in agentSkillMap WHERE entry.skill != null}
├── {entry.agent}.md → /{entry.skill}
{END FOR}

{IF isVersionUpgrade}
✨ New Features Available in v{cliVersion}:

• /p:task - Unified task command with agentic classification
• Automatic type detection (feature, bug, improvement, refactor, chore)
• 7-phase development workflow for all task types
• Git branch management with type-based prefixes
• UX/UI design workflow for frontend tasks
• Design expert integration

Note: /p:now and /p:feature are deprecated. Use /p:task instead.
{ENDIF}

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

Next: /p:task "your next task"
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
├── config/                   # Configuration (NEW)
│   └── skills.json          # Agent-to-skill mappings
├── sync/                     # Backend Sync
│   └── pending.json         # Events queue
├── agents/                   # Specialists
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
├── testing.md               # (if test framework detected)
└── uxui.md                  # (if ANY frontend UI detected - web or mobile)
```
