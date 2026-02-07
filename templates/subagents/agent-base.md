## prjct Project Context

### Setup
1. Read `.prjct/prjct.config.json` → extract `projectId`
2. Set `globalPath = ~/.prjct-cli/projects/{projectId}`

### Available Storage

| File | Contents |
|------|----------|
| `{globalPath}/storage/state.json` | Current task & subtasks |
| `{globalPath}/storage/queue.json` | Task queue |
| `{globalPath}/storage/shipped.json` | Shipping history |
| `{globalPath}/storage/roadmap.json` | Feature roadmap |

### Rules
- Storage (JSON) is **SOURCE OF TRUTH**
- Context (MD) is **GENERATED** from storage
- NEVER hardcode timestamps — use system time
- Log significant actions to `{globalPath}/memory/events.jsonl`
