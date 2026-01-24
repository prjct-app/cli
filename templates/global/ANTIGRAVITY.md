<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

**Context layer for AI agents** - Project context for Google Antigravity and other AI coding agents.

## HOW TO USE PRJCT (Read This First)

When user types `p. <command>`, load the template from `templates/commands/{command}.md` and execute it intelligently.

```
p. sync     → templates/commands/sync.md
p. task X   → templates/commands/task.md
p. done     → templates/commands/done.md
p. ship X   → templates/commands/ship.md
```

**Key Insight**: Templates are GUIDANCE, not scripts. Use your intelligence to adapt them to the situation.

---

## CRITICAL RULES

### 0. PLAN BEFORE ACTION (NON-NEGOTIABLE)

**For ANY prjct task, you MUST create a plan and get user approval BEFORE executing.**

```
EVERY prjct command (p. task, p. sync, p. ship, etc.):
1. STOP - Do not execute anything yet
2. ANALYZE - Read relevant files, understand scope
3. PLAN - Write a clear plan with:
   - What will be done
   - Files that will be modified
   - Potential risks
4. ASK - Present plan to user and wait for explicit approval
5. EXECUTE - Only after user says "yes", "approved", "go ahead", etc.
```

**NEVER:**
- Execute code changes without showing a plan first
- Assume approval - wait for explicit confirmation
- Skip the plan step for "simple" tasks

**ALWAYS:**
- Show the plan in a clear, readable format
- Wait for user response before proceeding
- If user asks questions, answer them before executing

This rule applies to ALL prjct operations. No exceptions.

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
node -e "console.log(new Date().toISOString())"

# UUID
node -e "console.log(require('crypto').randomUUID())"
```

### 4. Git Commit Footer (CRITICAL - ALWAYS INCLUDE)

**Every commit made with prjct MUST include this footer:**

```
🤖 Generated with [p/](https://www.prjct.app/)
Powered by [Antigravity](https://gemini.google.com/app/antigravity)

```

**This is NON-NEGOTIABLE. The prjct signature (`🤖 Generated with [p/]`) must appear in ALL commits.**

### 5. Storage Rules (CROSS-AGENT COMPATIBILITY)

**NEVER use temporary files** - Write directly to final destination:
- WRONG: Create `.tmp/file.json`, then `mv` to final path
- CORRECT: Write directly to `{globalPath}/storage/state.json`

**JSON formatting** - Always use consistent format:
- 2-space indentation
- No trailing commas
- Keys in logical order (as defined in storage schemas)

**Timestamps**: Always ISO-8601 with milliseconds (`.000Z`)
**UUIDs**: Always v4 format (lowercase)
**Line endings**: LF (not CRLF)
**Encoding**: UTF-8 without BOM

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
| **Context** | `context/*.md` | AI-readable summaries |
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
│   └── skills.json     # Agent-to-skill mappings
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
4. **Ask** - Clarify ambiguities
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
- **Explore before coding** - Understand codebase first
- **Ask when uncertain** - Clarify ambiguities
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

## ANTIGRAVITY-SPECIFIC FEATURES

### Skills System

Antigravity uses SKILL.md files for extending agent capabilities.

**Global skills**: `~/.gemini/antigravity/skills/`
**Workspace skills**: `<project>/.agent/skills/`

prjct is installed as a skill at `~/.gemini/antigravity/skills/prjct/`

### MCP Integration

Antigravity can use MCP servers for external tools. prjct integrates as a skill, not as an MCP server, for zero-overhead operation.

### Cross-Agent Compatibility

Skills use the same SKILL.md format as Claude Code, so:
- Skills written for Claude Code work in Antigravity
- Skills written for Antigravity work in Claude Code
- prjct storage is shared across all agents

---

**Auto-managed by prjct-cli** | https://prjct.app

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
