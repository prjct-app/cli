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

## Step 3.5: Deep Project Analysis (AGENTIC)

**ANALYZE the actual project. Do NOT follow hardcoded rules.**

### 3.5.1 Detect Ecosystem

```bash
ls -la  # Look at project root
```

| File Found | Ecosystem | Package Manager |
|------------|-----------|-----------------|
| `Gemfile` | Ruby | bundle |
| `requirements.txt`/`pyproject.toml` | Python | pip/poetry/uv |
| `go.mod` | Go | go |
| `Cargo.toml` | Rust | cargo |
| `package.json` + `bun.lockb` | JavaScript | bun |
| `package.json` + `pnpm-lock.yaml` | JavaScript | pnpm |
| `package.json` + `yarn.lock` | JavaScript | yarn |
| `package.json` + `package-lock.json` | JavaScript | npm |

SET: `{ecosystem}`, `{projectType}`, `{packageManager}`

### 3.5.2 Extract Commands

```bash
cat package.json | grep -A 20 '"scripts"'  # For Node.js
```

EXTRACT: `{installCommand}`, `{devCommand}`, `{testCommand}`, `{buildCommand}`, `{lintCommand}`

### 3.5.3 Detect Conventions

```bash
ls .eslintrc* .prettierrc* tsconfig.json biome.json 2>/dev/null
```

EXTRACT: `{namingConvention}`, `{linter}`, `{formatter}`

### 3.5.4 Write Analysis

```bash
mkdir -p {globalPath}/analysis
```

WRITE: `{globalPath}/analysis/repo-analysis.json` with ecosystem, commands, conventions, structure.

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

**Generate 3 workflow agents for every project:**

| Agent | agentId | Handles |
|-------|---------|---------|
| `prjct-workflow.md` | `p.agent.workflow` | /p:task, /p:done, /p:pause, /p:resume |
| `prjct-planner.md` | `p.agent.planner` | /p:idea, /p:spec, /p:bug |
| `prjct-shipper.md` | `p.agent.shipper` | /p:ship |

READ templates from: `templates/subagents/workflow/`
ADAPT with: projectId, projectPath, detected commands
WRITE to: `{globalPath}/agents/`

### 7.4 Generate Domain Agents (AGENTIC)

**See:** `templates/guides/agent-generation.md` for complete instructions.

**Summary:**
1. FIND representative files for each domain
2. READ 3-5 files and EXTRACT real patterns
3. GENERATE agents that enforce those patterns

**Domains to detect:**

| If Found | Generate | Temperature |
|----------|----------|-------------|
| React/Vue/Svelte | `frontend.md` | 0.3 |
| Express/Fastify/Hono | `backend.md` | 0.2 |
| Prisma/Drizzle/SQL | `database.md` | 0.1 |
| Docker/K8s/Actions | `devops.md` | 0.2 |
| Jest/Vitest/tests | `testing.md` | 0.2 |
| UI + design system | `uxui.md` | 0.4 |

**Output per agent:**
```
🤖 Generated: {agent}.md
   Stack: {technologies}
   Patterns: {count} from {files}
```

---

### 7.5 Report Generated Agents

Track which agents were generated for output:
- `{workflowAgents}`: Always 3 (prjct-workflow, prjct-planner, prjct-shipper)
- `{domainAgents}`: List of domain agents generated

---

## Step 7.6: Install Skills (AGENTIC)

**See:** `templates/guides/integrations.md` for complete skill integration docs.

**Summary:**
1. Search claude-plugins.dev for skills matching agent's stack
2. Install matching skills to `~/.claude/skills/`
3. Update agent frontmatter: `skills: [{skill-name}]`
4. Save mapping to `{globalPath}/config/skills.json`

**Fallback skills:**
- frontend/uxui → `frontend-design`
- backend → `{ecosystem} backend patterns`
- testing → `testing automation`

**Output:**
```
📦 Skills Synchronized
├── Installed: {count} new
├── Verified: {count} existing
└── Location: ~/.claude/skills/
```

---

## Step 7.7: Configure MCP Servers (AGENTIC)

**See:** `templates/guides/integrations.md` for complete MCP documentation.

**Summary:**
1. Analyze which agents need external docs/tools
2. Configure `context7` for library documentation
3. Save to `{globalPath}/config/mcp-servers.json`
4. Update agent frontmatter: `mcp: [context7]`

**Agent-MCP Mapping:**

| Agent Type | Needs MCP? | Reason |
|------------|------------|--------|
| frontend, backend, database | Yes | Library docs |
| devops | Rarely | Uses bash |
| workflow agents | Sometimes | Framework docs |

**Output:**
```
🔌 MCP Servers Configured
├── Servers: {count}
├── Agents with MCP: {count}
└── Config: {globalPath}/config/mcp-servers.json
```

---

## Step 7.8: Agent Auto-Refresh

**Detect when agents need regeneration:**

1. Compare `repo-analysis.json` with previous analysis
2. If dependencies changed → regenerate all agents
3. If agent older than 7 days → refresh that agent
4. Backup previous version as `{agent}.md.backup`

**Output:**
```
🔄 Agent Refresh
├── Checked: {count} agents
├── Refreshed: {count} stale
└── Dependencies: Changed/Unchanged
```

---

## Step 7.9: Slash Command Registration

**Generate registry for Claude Code integration.**

WRITE: `{globalPath}/config/slash-commands.json`

```json
{
  "version": "1.0.0",
  "generatedAt": "{timestamp}",
  "commands": {
    "p:task": { "description": "Start task", "category": "workflow" },
    "p:done": { "description": "Complete subtask", "category": "workflow" },
    "p:ship": { "description": "Ship feature", "category": "shipping" }
  }
}
```

---

## Step 7.10: Token Budget Analysis

**Estimate context token usage (~3.8 chars/token):**

1. Sum tokens: CLAUDE.md + agents/*.md + config/skills.json
2. Budget: 160,000 tokens (80% of 200k limit)
3. If over budget → summarize large agents

**Output:**
```
📊 Token Budget: {utilization}% ({used}/{budget} tokens)
```

---

## Step 8: Log to Memory

APPEND to: `{globalPath}/memory/events.jsonl`

```json
{"ts":"{GetTimestamp()}","action":"sync","branch":"{currentBranch}","uncommitted":{hasUncommittedChanges},"fileCount":{fileCount},"commitCount":{commitCount},"tokensUsed":{totalContextTokens}}
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
🔄 Synced to prjct v{cliVersion}

📊 {projectName} | {version} | {stack}
├── Files: {fileCount} | Commits: {commitCount}
├── Branch: {currentBranch} {hasUncommittedChanges ? "⚠️ uncommitted" : "✓ clean"}
└── Context: {tokenUtilization}% of budget

🤖 Agents ({workflowAgents.length + domainAgents.length})
├── Workflow: prjct-workflow, prjct-planner, prjct-shipper
└── Domain: {domainAgents.join(', ') || 'none'}

📦 Integrations
├── Skills: {totalSkills} ({skillsInstalled.length} new)
└── MCP: {mcpServersConfigured} servers

{IF isVersionUpgrade}
✨ v{cliVersion}: /p:task unifies all task types
{ENDIF}

{IF cloudSync}
☁️ Synced {pushedCount}↑ {pulledCount}↓
{ENDIF}

Next: /p:task "description"
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
├── storage/          # Source of Truth: state.json, queue.json, ideas.json, shipped.json
├── context/          # Claude Context: CLAUDE.md, now.md, next.md, ideas.md, shipped.md
├── config/           # Config: skills.json, mcp-servers.json, slash-commands.json
├── agents/           # Domain agents: prjct-*.md, frontend.md, backend.md, etc.
├── analysis/         # repo-analysis.json
├── memory/           # events.jsonl
├── sync/             # pending.json
└── project.json      # Metadata + cliVersion
```

**Agent Frontmatter (v0.28+):**
```yaml
name: backend
agentId: p.agent.backend
skills: [skill-name]      # Auto-invoked
mcp: [context7]           # Auto-used
generatedAt: {timestamp}  # For refresh detection
```
