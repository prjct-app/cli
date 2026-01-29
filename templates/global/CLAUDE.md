<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

**Context layer for AI agents** - Project context for Claude Code, Gemini CLI, and more.

## HOW TO USE PRJCT (Read This First)

When user types `p. <command>`, load the template from `templates/commands/{command}.md` and execute it.

```
p. sync     → templates/commands/sync.md
p. task X   → templates/commands/task.md
p. done     → templates/commands/done.md
p. ship X   → templates/commands/ship.md
```

---

## ⛔ CRITICAL RULES - READ BEFORE EVERY COMMAND

### 0. FOLLOW TEMPLATES STEP BY STEP (NON-NEGOTIABLE)

**Templates are MANDATORY WORKFLOWS, not suggestions.**

```
⛔ BEFORE executing ANY p. command:
1. READ the template file COMPLETELY
2. FOLLOW each step IN ORDER
3. DO NOT skip steps - even "obvious" ones
4. DO NOT take shortcuts - even for "simple" tasks
5. STOP at any ⛔ BLOCKING condition
```

**WHY THIS MATTERS:**
- Skipping steps breaks the prjct workflow for ALL users
- "Intelligent adaptation" is NOT permission to skip steps
- Every step exists for a reason
- If you skip steps, prjct becomes useless

### ⛔ BLOCKING CONDITIONS

When a template says "STOP" or has a ⛔ symbol:
```
1. HALT execution immediately
2. TELL the user why you stopped
3. DO NOT proceed until the condition is resolved
4. DO NOT work around the blocker
```

**Examples of blockers:**
- `p. ship` on main branch → STOP, tell user to create branch
- `gh auth status` fails → STOP, tell user to authenticate
- No changes to commit → STOP, tell user nothing to ship

### GIT WORKFLOW RULES (CRITICAL)

**⛔ NEVER commit directly to main/master**
- Always create a feature branch first
- Always create a PR for review
- Direct pushes to main are FORBIDDEN

**⛔ NEVER push without a PR**
- All changes go through pull requests
- No exceptions for "small fixes"

**⛔ NEVER skip version bump on ship**
- Every ship requires version update
- Every ship requires CHANGELOG entry

### PLAN BEFORE DESTRUCTIVE ACTIONS

For commands that modify git state (ship, merge, done):
```
1. Show the user what will happen
2. List all changes/files affected
3. WAIT for explicit approval ("yes", "proceed", "do it")
4. Only then execute
```

**DO NOT assume approval. WAIT for it.**

---

### 1. Path Resolution (MOST IMPORTANT)
**ALL writes go to global storage**: `~/.prjct-cli/projects/{projectId}/`

- **NEVER** write to `.prjct/` (config only, read-only)
- **NEVER** write to `./` (current directory)
- **ALWAYS** resolve projectId first from `.prjct/prjct.config.json`

### 2. Before Any Command
```
1. Read .prjct/prjct.config.json → get projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Execute command using globalPath for all writes
4. Log to {globalPath}/memory/events.jsonl
```

### 3. Timestamps & UUIDs
```bash
# Timestamp (NEVER hardcode)
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"

# UUID
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

### 4. Git Commit Footer (CRITICAL - ALWAYS INCLUDE)

**Every commit made with prjct MUST include this footer:**

```
Generated with [p/](https://www.prjct.app/)
```

**This is NON-NEGOTIABLE. The prjct signature must appear in ALL commits.**

### 5. Storage Rules (CROSS-AGENT COMPATIBILITY)

**NEVER use temporary files** - Write directly to final destination:
- WRONG: Create `.tmp/file.json`, then `mv` to final path
- CORRECT: Write directly to `{globalPath}/storage/state.json`

**JSON formatting** - Always use consistent format:
- 2-space indentation
- No trailing commas
- Keys in logical order (as defined in storage schemas)

**Atomic writes for JSON**:
```javascript
// Read → Modify → Write (no temp files)
const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
data.newField = value
fs.writeFileSync(path, JSON.stringify(data, null, 2))
```

**Timestamps**: Always ISO-8601 with milliseconds (`.000Z`)
**UUIDs**: Always v4 format (lowercase)
**Line endings**: LF (not CRLF)
**Encoding**: UTF-8 without BOM

**NEVER**:
- Use `.tmp/` directories
- Use `mv` or `rename` operations for storage files
- Create backup files like `*.bak` or `*.old`
- Modify existing lines in `events.jsonl`

**Full specification**: Install prjct-cli and see `{npm root -g}/prjct-cli/templates/global/STORAGE-SPEC.md`

---

## CORE WORKFLOW

```
p. sync  →  p. task "description"  →  [work]  →  p. done  →  p. ship
   │              │                                  │            │
   │              └─ Creates branch, breaks down     │            │
   │                 task, starts tracking           │            │
   │                                                 │            │
   └─ Analyzes project, generates agents             │            │
                                                     │            │
                              Completes subtask ─────┘            │
                                                                  │
                                        Ships feature, PR, tag ───┘
```

### Quick Reference

| Trigger | What It Does |
|---------|--------------|
| `p. sync` | Analyze project, generate domain agents |
| `p. task <desc>` | Start task with auto-classification |
| `p. done` | Complete current subtask |
| `p. ship [name]` | Ship feature with PR + version bump |
| `p. pause` | Pause current task |
| `p. resume` | Resume paused task |
| `p. bug <desc>` | Report bug with auto-priority |

---

## ARCHITECTURE: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

| Layer | Path | Purpose |
|-------|------|---------|
| **Storage** | `storage/*.json` | Source of truth |
| **Context** | `context/*.md` | Claude-readable summaries |
| **Memory** | `memory/events.jsonl` | Audit trail (append-only) |
| **Agents** | `agents/*.md` | Domain specialists |
| **Sync** | `sync/pending.json` | Backend sync queue |

### File Structure
```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   ├── state.json      # Current task (SOURCE OF TRUTH)
│   ├── queue.json      # Task queue
│   └── shipped.json    # Shipped features
├── context/
│   ├── now.md          # Current task (generated)
│   └── next.md         # Queue (generated)
├── config/
│   └── skills.json     # Agent-to-skill mappings (NEW)
├── memory/
│   └── events.jsonl    # Audit trail
├── agents/             # Domain specialists (auto-generated)
└── sync/
    └── pending.json    # Events for backend
```

---

## INTELLIGENT BEHAVIOR

### When Starting Tasks (`p. task`)
1. **Analyze** - Understand what user wants to achieve
2. **Classify** - Determine type: feature, bug, improvement, refactor, chore
3. **Explore** - Find similar code, patterns, affected files
4. **Ask** - Clarify ambiguities (use AskUserQuestion)
5. **Design** - Propose 2-3 approaches, get approval
6. **Break down** - Create actionable subtasks
7. **Track** - Update storage/state.json

### When Completing Tasks (`p. done`)
1. Check if there are more subtasks
2. If yes, advance to next subtask
3. If no, task is complete
4. Update storage, generate context

### When Shipping (`p. ship`)
1. Run tests (if configured)
2. Create PR (if on feature branch)
3. Bump version
4. Update CHANGELOG
5. Create git tag

### Key Intelligence Rules
- **Read before write** - Always read existing files before modifying
- **Explore before coding** - Use Task(Explore) to understand codebase
- **Ask when uncertain** - Use AskUserQuestion to clarify
- **Adapt templates** - Templates are guidance, not rigid scripts
- **Log everything** - Append to memory/events.jsonl

---

## OUTPUT FORMAT

Concise responses (< 4 lines):
```
✅ [What was done]

[Key metrics]
Next: [suggested action]
```

---

## CLEAN TERMINAL UX (CRITICAL)

**Tool calls MUST be user-friendly.** The terminal output represents prjct's quality.

### Rules for Tool Calls

1. **ALWAYS use clear descriptions** in Bash tool calls:
   ```
   GOOD: description: "Building project"
   BAD:  description: "bun run build 2>&1 | tail -5"
   ```

2. **Hide implementation details** - Users don't need to see:
   - Pipe chains (`| tail -5`, `| grep`, `2>&1`)
   - Internal paths (`/Users/jj/.prjct-cli/...`)
   - JSON parsing (`jq -r '.field'`)

3. **Use action verbs** for descriptions:
   - "Building project"
   - "Running tests"
   - "Checking git status"
   - "Fetching Linear issues"

4. **Group related operations** - Don't show 5 separate tool calls when 1 will do

5. **Prefer prjct CLI over raw commands**:
   ```
   GOOD: bun $PRJCT_CLI/core/cli/linear.ts list
   BAD:  curl -X POST https://api.linear.app/graphql...
   ```

### Examples

```
# GOOD - Clean, understandable
⏺ Bash: Building project
  ✓ Build complete

# BAD - Technical noise
⏺ Bash(cd /Users/jj/Apps/prjct && bun run build 2>&1 | tail -5)
  → core/infrastructure/editors-config.js
  → core/utils/version.js
```

### When Reading Files

- Don't announce every file read
- Group related reads
- Only mention files relevant to user's question

### When Running Commands

- Show WHAT you're doing, not HOW
- Suppress stderr noise when possible
- Return only meaningful output

---

## LOADING DOMAIN AGENTS

When working on tasks, load relevant agents from `{globalPath}/agents/`:
- `frontend.md` - Frontend patterns, components
- `backend.md` - Backend patterns, APIs
- `database.md` - Database patterns, queries
- `uxui.md` - UX/UI guidelines
- `testing.md` - Testing patterns
- `devops.md` - CI/CD, containers

These agents contain project-specific patterns. **USE THEM**.

---

## SKILL INTEGRATION (NEW in v0.27 - AGENTIC)

Agents are linked to Claude Code skills from claude-plugins.dev.

**Skills are discovered AGENTICALLY** - Claude searches the marketplace dynamically.

### How Skills Work

1. **During `p. sync`**: Search claude-plugins.dev, install best matches
2. **During `p. task`**: Skills are auto-invoked for domain expertise
3. **Agent frontmatter** has `skills: [discovered-skill-name]` field

### Agentic Discovery Process

```
FOR EACH generated agent:
  1. Read search hints from templates/config/skill-mappings.json
  2. Search: https://claude-plugins.dev/skills?q={searchTerm}
  3. Analyze results (prefer @anthropics, high downloads)
  4. Download skill markdown from GitHub
  5. Write to ~/.claude/skills/{name}.md
  6. Update agent frontmatter
```

### Search Terms by Agent

| Agent | Search Terms |
|-------|-------------|
| `frontend.md` | "frontend-design", "react", "ui components" |
| `uxui.md` | "ux-designer", "frontend-design", "ui ux" |
| `backend.md` | "{ecosystem} backend", "api design" |
| `testing.md` | "testing automation", "test patterns" |
| `devops.md` | "devops", "ci cd", "docker kubernetes" |
| `prjct-planner.md` | "architecture patterns", "feature development" |
| `prjct-shipper.md` | "code review", "pr review" |

### Skill Location

Skills are markdown files in `~/.claude/skills/`

### Skill Configuration

After sync: `{globalPath}/config/skills.json` contains discovered mappings.

---

**Auto-managed by prjct-cli** | https://prjct.app | v0.27.0

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
