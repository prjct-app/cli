<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

**Developer momentum tool** - Track progress through natural language commands without PM overhead.

## HOW TO USE PRJCT (Read This First)

When user types `p. <command>`, resolve the command in this order:

### Command Resolution Order

1. **Quick Commands (User-defined)**: `~/.prjct-cli/commands/{command}.md`
2. **Built-in Commands**: `templates/commands/{command}.md`

```
p. sync     → templates/commands/sync.md (built-in)
p. task X   → templates/commands/task.md (built-in)
p. deploy   → ~/.prjct-cli/commands/deploy.md (user quick command)
p. test     → ~/.prjct-cli/commands/test.md (user quick command)
```

**Key Insight**: Templates are GUIDANCE, not scripts. Use your intelligence to adapt them to the situation.

---

## QUICK COMMANDS (User-Defined)

Users can create custom commands in `~/.prjct-cli/commands/`. These are checked FIRST before built-in commands.

### Command Format (Full)

```yaml
---
# Required
description: Brief explanation shown in help

# Optional - Execution control
agent: {agent-name}              # Which agent executes (e.g., "testing", "frontend")
model: sonnet                    # Override model (sonnet | opus | haiku)
temperature: 0.3                 # Override temperature (0.0-1.0)

# Optional - Permissions for this command
permissions:
  Bash: allow                    # Override default permissions
  "npm *": allow
---

{Prompt template with variables and shell injection}
```

### Variable Substitution

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | All arguments concatenated | `p. test src/` → "src/" |
| `$1`, `$2`, `$3`... | Positional arguments | `p. diff main dev` → $1="main", $2="dev" |

### Shell Injection

Use `` !`command` `` to embed shell output:

```yaml
---
description: Review current branch changes
---

# Branch: !`git branch --show-current`

## Recent Commits
!`git log --oneline -5`

## Changed Files
!`git diff --name-only`

Review these changes for:
- Code quality issues
- Security vulnerabilities
- Missing tests
```

### File References

Use `@filepath` to include file contents:

```yaml
---
description: Review a specific component
---

Review the component in @$1 for:
- Performance issues
- Accessibility
- Best practices

Suggest improvements.
```

### Example Commands

**~/.prjct-cli/commands/test.md**
```yaml
---
description: Run and fix tests
agent: testing
permissions:
  Bash: allow
---

Run tests for $ARGUMENTS. If any fail, analyze and fix them.

Current test status:
!`{project test command} --reporter=dot 2>&1 | tail -20`
```

**~/.prjct-cli/commands/pr.md**
```yaml
---
description: Create PR with AI-generated description
permissions:
  Bash:
    "git *": allow
    "gh *": allow
---

Create a pull request for branch !`git branch --show-current`.

Changes since main:
!`git log main..HEAD --oneline`

Files changed:
!`git diff --stat main`

Generate a descriptive PR title and body based on these changes.
```

**~/.prjct-cli/commands/component.md**
```yaml
---
description: Create a new React component
agent: frontend
---

Create a new React component named $1 in the appropriate directory.

Follow existing patterns from:
@src/components/Button.tsx

Match the project's:
- File structure
- Naming conventions
- Styling approach
- Type patterns
```

---

## CRITICAL RULES

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
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)

```

**This is NON-NEGOTIABLE. The prjct signature (`🤖 Generated with [p/]`) must appear in ALL commits.**

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

## INTEGRATIONS (v0.27+)

Skills and MCP servers are auto-configured during `/p:sync`.

**See:** `templates/guides/integrations.md` for complete documentation.

### Quick Reference

| Feature | What Happens |
|---------|--------------|
| **Skills** | Auto-invoked when agent loads (`skills: [skill-name]`) |
| **MCP** | Auto-queried for library docs (`mcp: [context7]`) |

### Pipeline

```
Load Agent → Invoke Skills → Query MCP → Execute with Context
```

---

## CLAUDE CODE SYNERGY

prjct is designed to maximize Claude Code's capabilities:

### Slash Commands
All `/p:*` commands are optimized for Claude Code execution.

### Agent System
Domain agents (`frontend.md`, `backend.md`, etc.) integrate with Claude's Task tool.

### Skill + MCP Pipeline
```
Task → Load Agent → Invoke Skills → Query MCP → Execute with Full Context
```

### Think Blocks
Destructive commands (`/p:ship`, `/p:cleanup`) use `<think>` blocks for verification.

---

**Auto-managed by prjct-cli** | https://prjct.app | v0.28.3

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
