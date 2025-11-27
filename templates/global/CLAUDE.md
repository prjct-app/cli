<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct Configuration

This section provides global context for all `/p:*` commands across any prjct project.

**Auto-managed by prjct-cli** - This section is automatically updated when you install or update prjct.

## 🤖 Project Context (OBLIGATORIO)

**ANTES de trabajar en un proyecto prjct, LEE el contexto del proyecto:**

1. Lee `.prjct/prjct.config.json` → obtén `projectId`
2. Lee `~/.prjct-cli/projects/{projectId}/CLAUDE.md` → contexto dinámico del proyecto
3. Para detalles de implementación, lee los archivos en `agents/`

El archivo `CLAUDE.md` del proyecto contiene:
- Stack detectado del proyecto
- Agentes disponibles (varían por proyecto)
- Tarea actual
- Cola de prioridades
- Rutas a documentación detallada

**Si no existe CLAUDE.md**: Sugiere ejecutar `/p:sync` para generarlo.

## 🎯 Path Resolution for ALL /p:* Commands

**CRITICAL**: Every `/p:*` command operates on **global storage**, NOT local files.

### Resolution Steps:

1. **Detect prjct project**: Check if `.prjct/prjct.config.json` exists in current working directory
2. **Read config**: Extract `projectId` from `.prjct/prjct.config.json`
3. **Construct base path**: `~/.prjct-cli/projects/{projectId}/`
4. **Resolve all file operations**: All paths in command templates are relative to base path

### Examples:

```
Template says: "Write: core/now.md"
Actual path:  ~/.prjct-cli/projects/{projectId}/core/now.md

Template says: "Read: memory/context.jsonl"
Actual path:  ~/.prjct-cli/projects/{projectId}/memory/context.jsonl

Template says: "Update: progress/shipped.md"
Actual path:  ~/.prjct-cli/projects/{projectId}/progress/shipped.md
```

### Validation Rules:

- ❌ **NEVER** write to `.prjct/core/now.md` (local project directory)
- ❌ **NEVER** write to `./core/now.md` (current working directory)
- ✅ **ALWAYS** write to `~/.prjct-cli/projects/{projectId}/core/now.md` (global storage)

### When NOT in prjct Project:

If `.prjct/prjct.config.json` doesn't exist in current directory:
- Respond: "No prjct project detected. Initialize first with `/p:init`"
- Do NOT execute the command
- Do NOT create files

## 📁 File Structure

All prjct data lives in global storage with session-based architecture:

```
~/.prjct-cli/projects/{projectId}/
├── core/                 # Current focus (always small)
│   ├── now.md           # Single current task
│   ├── next.md          # Priority queue (max 100 tasks)
│   └── context.md       # Project context summary
├── progress/            # Completed work
│   ├── shipped.md       # Recent ships (last 30 days)
│   ├── metrics.md       # Aggregated metrics
│   ├── sessions/        # Daily session logs (JSONL)
│   │   └── 2025-10/
│   │       └── 2025-10-05.jsonl
│   └── archive/         # Monthly archives
│       └── shipped-2025-10.md
├── planning/            # Future planning
│   ├── ideas.md         # Active ideas (last 30 days)
│   ├── roadmap.md       # Active roadmap (lightweight)
│   ├── sessions/        # Daily planning sessions (JSONL)
│   │   └── 2025-10/
│   │       └── 2025-10-05.jsonl
│   └── archive/         # Monthly archives
│       └── roadmap-2025-10.md
├── analysis/            # Technical analysis
│   └── repo-summary.md
├── memory/              # Decision history
│   ├── context.jsonl    # Global decisions (append-only)
│   └── sessions/        # Daily context (structured)
│       └── 2025-10/
│           └── 2025-10-05.jsonl
└── agents/              # Dynamic AI agents
    ├── coordinator.md
    ├── ux.md
    ├── fe.md
    ├── be.md
    ├── qa.md
    └── scribe.md
```

### Session Format (JSONL):

One JSON object per line, append-only:

```jsonl
{"ts":"2025-10-05T14:30:00Z","type":"feature_add","name":"auth","tasks":5,"impact":"high","effort":"6h"}
{"ts":"2025-10-05T15:00:00Z","type":"task_start","task":"JWT middleware","agent":"be","estimate":"2h"}
{"ts":"2025-10-05T17:15:00Z","type":"task_complete","task":"JWT middleware","duration":"2h15m"}
{"ts":"2025-10-05T18:00:00Z","type":"feature_ship","name":"auth","tasks_done":5,"total_time":"6h"}
```

## 🤖 Git Commit Format

**ALL commits made by prjct MUST use this footer:**

```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

**Never use:**
- ❌ "Generated with Claude Code"
- ❌ "Co-Authored-By: Claude"

**Always use:**
- ✅ The prjct footer format above

## 👤 Author Detection

All operations include author information. Detection order:

1. **GitHub CLI**: `gh api user` (preferred)
   - Provides: name, email, username, avatarUrl
2. **Git Config**: Fallback if GitHub CLI not available
   - `git config user.name`
   - `git config user.email`
3. **Default**: If both fail
   - name: "Unknown"
   - email: "unknown@localhost"

Every log entry in `memory/context.jsonl` includes author field.

## ⚠️ Common Validation Patterns

### Before Executing /p:done:
```javascript
// Check if there's an active task
const nowContent = await Read('~/.prjct-cli/projects/{projectId}/core/now.md')
if (!nowContent || nowContent.trim() === '') {
  return "Not working on anything. Use /p:now to start a task."
}
```

### Before Executing /p:ship:
```javascript
// Check if there's something to ship
const shippedContent = await Read('~/.prjct-cli/projects/{projectId}/progress/shipped.md')
const nowContent = await Read('~/.prjct-cli/projects/{projectId}/core/now.md')
if ((!nowContent || nowContent.trim() === '') &&
    (!shippedContent || shippedContent.trim() === '')) {
  return "Nothing to ship yet. Build something first with /p:now."
}
```

### Reading Project Config:
```javascript
// Always read config first
const configPath = '.prjct/prjct.config.json'
const configContent = await Read(configPath)
const config = JSON.parse(configContent)
const projectId = config.projectId
const basePath = `~/.prjct-cli/projects/${projectId}/`
```

## 🔧 Error Handling

### File Not Found:
- If `core/now.md` doesn't exist when reading → return empty state
- If `core/next.md` doesn't exist → return "No tasks in queue"
- Always check file existence before operations

### Invalid JSON:
- If config file is corrupted → suggest running `/p:init` again
- Log error to `memory/context.jsonl` for debugging

### Permission Issues:
- If can't write to `~/.prjct-cli/` → check directory permissions
- Suggest: `chmod -R u+w ~/.prjct-cli/`

## 📊 Performance Guidelines

### Archive Rules:
- Index files (roadmap.md, shipped.md) keep only last 30 days
- Sessions older than 30 days → automatically moved to archive/
- When querying across time: read relevant session files from archive/
- Commands only read current index + today's session for performance

### File Size Limits:
- `core/now.md`: Single task only (< 1KB)
- `core/next.md`: Max 100 tasks (< 50KB)
- `progress/shipped.md`: Last 30 days only (auto-archive older)
- Session files: One file per day, JSONL format for efficient appending

## 🎯 Command Execution Flow

Standard pattern for all `/p:*` commands:

1. **Validate environment**: Check `.prjct/prjct.config.json` exists
2. **Read config**: Extract projectId
3. **Construct paths**: Build all file paths using base path
4. **Execute operations**: Read/write files in global storage
5. **Log action**: Append to `memory/context.jsonl` with timestamp and author
6. **Return response**: Formatted response with next action suggestions

## 📚 Additional Context

- **Website**: https://prjct.app
- **Documentation**: https://prjct.app/docs
- **Repository**: Private (proprietary software)
- **Support**: jlopezlira@gmail.com
- **Version**: Auto-updated with prjct-cli

---

**Last updated**: Auto-managed by prjct-cli
**Config version**: 0.8.2

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
