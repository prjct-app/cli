<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

**Developer momentum tool** - Track progress through natural language commands.

## Command Resolution

```
p. <command> → 1. ~/.prjct-cli/commands/{command}.md (user)
             → 2. templates/commands/{command}.md (built-in)
```

Templates are GUIDANCE, not scripts. Adapt to the situation.

---

## Quick Commands (User-Defined)

Create custom commands in `~/.prjct-cli/commands/`:

```yaml
---
description: Brief explanation
agent: testing          # Optional: which agent
model: sonnet           # Optional: sonnet | opus | haiku
---

{Prompt with $ARGUMENTS, $1, $2...}
!`shell command`        # Shell injection
@filepath               # File inclusion
```

---

## Critical Rules

### Path Resolution
**ALL writes**: `~/.prjct-cli/projects/{projectId}/`
- NEVER write to `.prjct/` (read-only config)
- NEVER write to `./` for prjct data

### Before Any Command
```
1. Read .prjct/prjct.config.json → projectId
2. globalPath = ~/.prjct-cli/projects/{projectId}
3. Execute using globalPath for writes
```

### Timestamps & UUIDs
```bash
node -e "console.log(new Date().toISOString())"
node -e "console.log(require('crypto').randomUUID())"
```

### Git Commit Footer (REQUIRED)
```
🤖 Generated with [p/](https://www.prjct.app/)
```

---

## Core Workflow

```
p. sync → p. task "desc" → [work] → p. done → p. ship
```

| Command | Action |
|---------|--------|
| `p. sync` | Analyze project, generate agents |
| `p. task` | Start task with classification |
| `p. done` | Complete subtask |
| `p. ship` | Ship with PR + version bump |
| `p. bug` | Report bug with auto-priority |

---

## Architecture

```
Action → Storage (JSON) → Context (MD) → Sync Events
```

```
~/.prjct-cli/projects/{projectId}/
├── storage/     # state.json, queue.json (SOURCE OF TRUTH)
├── context/     # now.md, next.md (generated)
├── agents/      # Domain specialists
├── memory/      # events.jsonl
└── sync/        # pending.json
```

---

## Intelligent Behavior

| Action | Steps |
|--------|-------|
| `p. task` | Analyze → Classify → Explore → Ask → Design → Breakdown |
| `p. done` | Check subtasks → Advance/Complete → Update storage |
| `p. ship` | Tests → PR → Version bump → CHANGELOG → Tag |

**Rules:**
- Read before write
- Use Task(Explore) before coding
- AskUserQuestion when uncertain
- Log to memory/events.jsonl

---

## Domain Agents

Load from `{globalPath}/agents/`:
- `frontend.md`, `backend.md`, `database.md`
- `uxui.md`, `testing.md`, `devops.md`

Agents contain project-specific patterns. **USE THEM**.

---

## Output Format

```
✅ [Action]
[Metrics]
Next: [suggestion]
```

Keep output < 4 lines.

---

## Claude Code UX Enhancements

### Status Line

prjct provides a custom status line showing:
- ⚡ Current prjct task
-  Git branch with dirty indicator
- +/- Lines changed this session
- Context usage bar
- Model icon (🎭/📝/🍃)

**Setup:** `p. setup-statusline`

### Themes

Available at `~/.prjct-cli/statusline/themes/`:
- `default.json` - prjct brand (cyan/purple)
- `gentleman.json` - Elegant blues/golds
- `minimal.json` - Clean grayscale

### Output Styles

Available at `~/.prjct-cli/output-styles/`:
- `prjct.md` - Concise, actionable (default)
- `verbose.md` - Detailed explanations
- `ship-fast.md` - Minimum output, max velocity

**Use:** `/output-style prjct`

### Hooks

Metrics tracked automatically:
- `update-metrics.sh` - Tracks tool usage
- `session-summary.sh` - Shows session stats on stop

---

**prjct-cli** | https://prjct.app | v0.28.3

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
