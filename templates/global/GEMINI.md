<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

**Context layer for AI agents** - Project context for Claude Code, Gemini CLI, and more.

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
Designed for [Gemini](https://geminicli.com/)

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

## SKILL INTEGRATION

Agents can be linked to skills for specialized expertise.

### How Skills Work

1. **During `p. sync`**: Skills are discovered and installed
2. **During `p. task`**: Skills are auto-invoked for domain expertise
3. **Agent frontmatter** has `skills: [skill-name]` field

### Skill Location

Skills are SKILL.md files in `~/.gemini/skills/{skill-name}/`

**Note**: Gemini CLI and Claude Code use the same SKILL.md format, so skills are compatible between both agents.

### Skill Configuration

After sync: `{globalPath}/config/skills.json` contains skill mappings.

---

## GEMINI-SPECIFIC FEATURES

### Context Hierarchy

Gemini CLI loads GEMINI.md files hierarchically:
1. Global: `~/.gemini/GEMINI.md`
2. Project ancestors: Walk up to `.git` root
3. Subdirectories: Scan below cwd (respects `.geminiignore`)

### Modular Imports

You can import content from other files using `@file.md` syntax:
```markdown
@./components/instructions.md
@../shared/style-guide.md
```

### Memory Commands

- `/memory show` - Display loaded context
- `/memory refresh` - Reload all GEMINI.md files
- `/memory add <text>` - Add to global context

---

**Auto-managed by prjct-cli** | https://prjct.app | v0.27.0

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
