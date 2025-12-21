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

## Architecture: Write-Through

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

| Layer | Path | Purpose |
|-------|------|---------|
| Storage | `storage/*.json` | Source of truth |
| Context | `context/*.md` | Claude-readable (generated) |
| Sync | `sync/pending.json` | Backend events |
| Memory | `memory/events.jsonl` | Audit trail |

### File Structure
```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   ├── state.json         # Current task (source of truth)
│   ├── shipped.json       # Shipped features
│   └── queue.json         # Task queue
├── context/
│   ├── now.md             # Generated from state.json
│   └── shipped.md         # Generated from shipped.json
├── sync/pending.json      # Backend events
├── memory/events.jsonl    # Audit trail
└── agents/                # Domain specialists
```

## Core Workflow

```
/p:sync → /p:now "task" → [work] → /p:done → /p:ship
```

## Commands

| Command | Purpose |
|---------|---------|
| `/p:sync` | Analyze repo, generate agents |
| `/p:now [task]` | Start/show current task |
| `/p:done` | Complete current task |
| `/p:ship [feature]` | Ship with quality checks |
| `/p:feature` | Add to roadmap |
| `/p:idea` | Quick idea capture |
| `/p:recap` | Project overview |

## Natural Language Trigger

Messages starting with `p.` trigger commands:
```
p. start auth → /p:now "auth"
p. done       → /p:done
p. ship login → /p:ship "login"
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
