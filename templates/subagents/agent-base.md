## prjct Project Context

### Setup
1. Read `.prjct/prjct.config.json` → extract `projectId`
2. All data is in SQLite (`prjct.db`) — accessed via `prjct` CLI commands

### Data Access

| CLI Command | Data |
|-------------|------|
| `prjct dash compact` | Current task & state |
| `prjct next` | Task queue |
| `prjct task "desc"` | Start task |
| `prjct done` | Complete task |
| `prjct pause "reason"` | Pause task |
| `prjct resume` | Resume task |

### Rules
- All state is in **SQLite** — use `prjct` CLI for all data ops
- NEVER read/write JSON storage files directly
- NEVER hardcode timestamps — use system time
