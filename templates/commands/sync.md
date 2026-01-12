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

**PERFORMANCE**: Use parallel operations wherever possible. This sync should complete in <30 seconds.

## Parallelization Strategy

| Phase | Operations | Parallel? |
|-------|------------|-----------|
| Git + Stats | git commands, package.json read | ✅ Yes |
| Storage Read | state, queue, ideas, shipped | ✅ Yes |
| Context Write | now, next, ideas, shipped, CLAUDE.md | ✅ Yes |
| Agent Gen | workflow agents, domain agents | ✅ Yes |

**CRITICAL**: Batch all Read/Write operations. Never do sequential reads when parallel is possible.

---

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

## Step 2: Git Analysis (PARALLEL)

**Run ALL git commands in a single parallel batch:**

```bash
# Run in parallel (single Bash call with &&)
git status --porcelain && \
git log --oneline -10 --pretty=format:"%h|%s" && \
git branch --show-current && \
git rev-list --count HEAD
```

EXTRACT from combined output:
- `{stagedFiles}`, `{modifiedFiles}`, `{untrackedFiles}`, `{hasUncommittedChanges}`
- `{recentCommits}`: Last 10 commits (reduced from 20)
- `{currentBranch}`, `{commitCount}`
- `{isFeatureBranch}`: true if not main/master

---

## Step 3: Project Stats (FAST)

**Use Glob tool instead of find - much faster:**

### 3.1 Quick Stats (Single Read)

READ: `package.json` → extract `name`, `version`, `dependencies`, `devDependencies`, `scripts`

From dependencies, detect:
- `{techStack}`: react, vue, express, etc.
- `{hasWebFrontend}`: react|vue|svelte|next in deps
- `{hasMobileFrontend}`: react-native|expo in deps

SET: `{projectName}` = package.name OR directory name
SET: `{version}` = package.version

### 3.2 File Count (Use Glob, NOT find)

```
GLOB: **/*.{ts,tsx,js,jsx,py,go,rs} (exclude node_modules, .git)
```
SET: `{fileCount}` = count of matches

**NOTE**: commitCount already extracted in Step 2.

### 3.3 Detect Ecosystem (Single ls)

```bash
ls package.json bun.lockb pnpm-lock.yaml yarn.lock package-lock.json Cargo.toml go.mod pyproject.toml 2>/dev/null
```

| Found | Ecosystem | Package Manager |
|-------|-----------|-----------------|
| `bun.lockb` | JavaScript | bun |
| `pnpm-lock.yaml` | JavaScript | pnpm |
| `yarn.lock` | JavaScript | yarn |
| `package-lock.json` | JavaScript | npm |
| `Cargo.toml` | Rust | cargo |
| `go.mod` | Go | go |
| `pyproject.toml` | Python | uv/poetry |

SET: `{ecosystem}`, `{packageManager}`

---

## Step 3.5: Extract Commands & Conventions

**Already have ecosystem from Step 3. Now extract commands from scripts.**

### 3.5.1 Extract Commands (from package.json scripts already read)

From `package.json.scripts`:
- `{installCommand}` = `{packageManager} install`
- `{devCommand}` = scripts.dev || scripts.start
- `{testCommand}` = scripts.test
- `{buildCommand}` = scripts.build
- `{lintCommand}` = scripts.lint

### 3.5.2 Detect Conventions (Single ls)

```bash
ls .eslintrc* .prettierrc* tsconfig.json biome.json .editorconfig 2>/dev/null
```

SET: `{linter}` = eslint|biome, `{formatter}` = prettier|biome

### 3.5.3 Write Analysis

WRITE: `{globalPath}/analysis/repo-analysis.json`
```json
{"ecosystem":"{ecosystem}","packageManager":"{packageManager}","commands":{...},"linter":"{linter}"}
```

---

## Step 4: Regenerate Context Files (PARALLEL READS)

### 4.1 Read ALL Storage (PARALLEL)

**Read all 4 files in parallel (single tool call batch):**

READ (parallel):
- `{globalPath}/storage/state.json` → `{state}`
- `{globalPath}/storage/queue.json` → `{queue}`
- `{globalPath}/storage/ideas.json` → `{ideas}`
- `{globalPath}/storage/shipped.json` → `{shipped}`

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

## Step 6b: Update Global CLAUDE.md (CRITICAL)

**ALWAYS update `~/.claude/CLAUDE.md`** with the latest prjct instructions.

This ensures Claude has the newest features and commands available.

### 6b.1 Read Current Global Config

READ: `~/.claude/CLAUDE.md`

### 6b.2 Read Template

The template is at the prjct-cli install location. For development:
READ: `templates/global/CLAUDE.md` (from the prjct-cli repo/package)

### 6b.3 Intelligent Merge

The file has markers:
- `<!-- prjct:start - DO NOT REMOVE THIS MARKER -->`
- `<!-- prjct:end - DO NOT REMOVE THIS MARKER -->`

**IF markers exist in ~/.claude/CLAUDE.md:**
1. Extract content BEFORE the start marker (user's custom content)
2. Extract content AFTER the end marker (user's custom content)
3. Replace the section between markers with template content
4. Write merged content

**IF no markers:**
1. Append template content to end of file

### 6b.4 Write Updated Config

WRITE: `~/.claude/CLAUDE.md`

OUTPUT: "📝 Updated ~/.claude/CLAUDE.md to v{cliVersion}"

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

### 7.5 Integrations (Skills + MCP) - CONDITIONAL

**Only if agents were generated, configure integrations.**

See: `templates/guides/integrations.md`

| Agent | Default Skill | MCP |
|-------|---------------|-----|
| frontend/uxui | `frontend-design` | context7 |
| backend | - | context7 |
| testing | - | - |

WRITE: `{globalPath}/config/skills.json` (if skills configured)

---

### 7.6 Scan Quick Commands

```bash
ls ~/.prjct-cli/commands/*.md 2>/dev/null | head -20
```

IF files found:
  SET: `{quickCommandCount}` = count
  FOR EACH file: extract `description` from frontmatter
  SET: `{quickCommandList}` = [{name, description}, ...]

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

## Output (Compact)

```
🔄 {projectName} v{version} | {ecosystem} | prjct v{cliVersion}

{currentBranch} {hasUncommittedChanges ? "⚠️" : "✓"} | {fileCount} files | {commitCount} commits

🤖 Agents: {domainAgents.join(', ') || 'workflow only'}
{IF quickCommandCount > 0}⚡ Commands: {quickCommandList.map(c => c.name).join(', ')}{ENDIF}
{IF cloudSync}☁️ {pushedCount}↑ {pulledCount}↓{ENDIF}

Next: p. task "description"
```

**Keep output under 6 lines unless errors occur.**

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
~/.prjct-cli/
├── commands/         # User Quick Commands (global, priority over built-in)
│   └── {command}.md  # Custom command templates
└── projects/{projectId}/
    ├── storage/      # Source of Truth: state.json, queue.json, ideas.json, shipped.json
    ├── context/      # Claude Context: CLAUDE.md, now.md, next.md, ideas.md, shipped.md
    ├── config/       # Config: skills.json, mcp-servers.json, slash-commands.json
    ├── agents/       # Domain agents: prjct-*.md, frontend.md, backend.md, etc.
    ├── analysis/     # repo-analysis.json
    ├── memory/       # events.jsonl
    ├── sync/         # pending.json
    └── project.json  # Metadata + cliVersion
```

**Agent Frontmatter (v0.28+):**
```yaml
name: backend
agentId: p.agent.backend
skills: [skill-name]      # Auto-invoked
mcp: [context7]           # Auto-used
generatedAt: {timestamp}  # For refresh detection
```
