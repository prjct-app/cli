<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

## CRITICAL RULES (READ FIRST)

### 1. Path Resolution (MOST IMPORTANT)
**ALL writes go to global storage**: `~/.prjct-cli/projects/{projectId}/`

- **NEVER** write to `.prjct/` (config only)
- **NEVER** write to `./` (current directory)
- **ALWAYS** use global storage path

### 2. Project Detection
Read `.prjct/prjct.config.json` → extract `projectId`
- If missing: "No prjct project. Run /p:init first." → STOP

### 3. Timestamps
```bash
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```
Result: `"2025-12-20T10:30:00.000Z"` - NEVER hardcode

### 4. Git Commit Footer
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/p:sync` | Analyze project, generate agents |
| `/p:task <description>` | Start task (auto-classifies type) |
| `/p:done` | Complete current task |
| `/p:ship [feature]` | Ship with quality checks |

**Workflow**: `/p:sync` → `/p:task` → [work] → `/p:done` → `/p:ship`

### Natural Language Triggers

Messages starting with `p.` trigger commands:
- `p. task add auth` → /p:task "add auth"
- `p. done` → /p:done
- `p. ship login` → /p:ship "login"

---

## Detailed Documentation

For detailed information, read these files:

| Topic | File |
|-------|------|
| Architecture (Write-Through, file structure) | `~/.prjct-cli/docs/architecture.md` |
| All commands and examples | `~/.prjct-cli/docs/commands.md` |
| Validation patterns | `~/.prjct-cli/docs/validation.md` |
| Using agents | `~/.prjct-cli/docs/agents.md` |

---

## Before Any Command

1. Read `.prjct/prjct.config.json` → get `projectId`
2. Read `~/.prjct-cli/projects/{projectId}/CLAUDE.md` → project context
3. Execute using global storage paths
4. Log to `memory/events.jsonl`

---

**Auto-managed by prjct-cli** | https://prjct.app | v0.24.0

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
