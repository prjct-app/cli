# CLAUDE.md

This file provides guidance to Claude Code when working with prjct-cli.

## Project Overview

**prjct-cli** is a developer momentum tool. Track progress through slash commands without meetings or traditional PM overhead.

## CRITICAL RULES

### 1. Path Resolution
**ALL writes go to global storage**: `~/.prjct-cli/projects/{projectId}/`
- NEVER write to `.prjct/` (config only)
- NEVER write to `./` (current directory)

### 2. Timestamps
```bash
# Prefer bun, fallback to node
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```
- Result: `"2025-12-20T10:30:00.000Z"`
- NEVER hardcode dates or times

### 3. UUIDs
```bash
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

### 4. Git Commit Footer
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

### Layer System (10 layers)

| Layer | Path | Purpose |
|-------|------|---------|
| **Storage** | `storage/*.json` | Source of truth (state, queue, shipped) |
| **Context** | `context/*.md` | Claude-readable generated files |
| **Core** | `core/` | Current task data |
| **Progress** | `progress/` | Historical progress tracking |
| **Planning** | `planning/` | Ideas, roadmap, specs, tasks |
| **Analysis** | `analysis/` | Repo analysis, tech stack |
| **Memory** | `memory/` | Events, patterns, semantic memories |
| **Agents** | `agents/` | Domain specialists (auto-generated) |
| **Sessions** | `sessions/YYYY/MM/DD/` | Daily session logs |
| **Sync** | `sync/` | Backend sync events |

### File Structure
```
~/.prjct-cli/projects/{projectId}/
├── project.json           # Project config (authors, version)
├── storage/
│   ├── state.json         # Current task (source of truth)
│   ├── queue.json         # Priority queue
│   └── shipped.json       # Shipped features
├── context/
│   ├── now.md             # Generated from state.json
│   ├── next.md            # Generated from queue.json
│   └── shipped.md         # Generated from shipped.json
├── core/                  # Current task context
├── progress/              # Historical metrics
├── planning/
│   ├── ideas.json         # Captured ideas
│   ├── roadmap.json       # Feature roadmap
│   └── tasks/             # Task breakdowns
├── analysis/
│   └── repo-analysis.json # Tech stack, patterns
├── memory/
│   ├── events.jsonl       # Audit trail
│   └── context.jsonl      # Semantic memories
├── agents/                # Auto-generated domain specialists
├── sessions/              # Daily session logs (YYYY/MM/DD/)
└── sync/
    ├── pending.json       # Events pending sync
    └── last-sync.json     # Last sync timestamp
```

## Core Workflow

```
p. sync → p. task "description" → [work] → p. done → p. ship
```

## Commands

Use `p. <command>` to trigger any prjct command.

### Core Commands
| Trigger | Purpose |
|---------|---------|
| `p. init` | Initialize project with deep analysis |
| `p. idea` | Transform ideas into architectures |
| `p. task` | Start task with agentic classification + 7-phase workflow |
| `p. spec` | Create detailed specifications |
| `p. pause` | Pause active task |
| `p. resume` | Resume paused task |
| `p. next` | Show priority queue |
| `p. done` | Complete current task |
| `p. ship` | Ship with quality checks |
| `p. bug` | Report bug with auto-priority |
| `p. dash` | Unified dashboard |
| `p. sync` | Analyze repo, generate agents |
| `p. suggest` | Context-aware recommendations |

### Deprecated Commands
| Trigger | Migration |
|---------|-----------|
| `p. now` | Use `p. task` instead |
| `p. feature` | Use `p. task` instead |
| `p. work` | Use `p. task` instead |

### Optional Commands
| Trigger | Purpose |
|---------|---------|
| `p. design` | System architecture design |
| `p. cleanup` | Clean temp files |
| `p. analyze` | Deep repo analysis |
| `p. undo` / `p. redo` | Snapshot management |
| `p. git` | Smart git operations |
| `p. test` | Run tests with auto-fix |

## How It Works

Messages starting with `p.` trigger prjct commands:
```
p. task add auth   → starts task "add auth"
p. task fix login  → starts task "fix login"
p. done            → completes current task
p. ship login      → ships "login" feature
```

## Template-Driven Execution

Templates define command behavior:
```
templates/commands/{command}.md
```

Claude reads template → executes flow → generates response.

## Key Rules

1. **Read files before editing** - Never assume structure
2. **Use node commands for timestamps** - Never hardcode dates
3. **Follow template instructions** - Templates are source of truth
4. **Log to memory** - Append to `memory/events.jsonl`
5. **Suggest next actions** - Maintain user momentum

## Output Format

Concise responses (< 4 lines):
```
✅ [What was done]

[Key metrics]
Next: [suggested action]
```

## Documentation

For detailed information:
- Architecture: `~/.prjct-cli/docs/architecture.md`
- Commands: `~/.prjct-cli/docs/commands.md`
- Validation: `~/.prjct-cli/docs/validation.md`
- Agents: `~/.prjct-cli/docs/agents.md`
