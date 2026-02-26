# prjct-cli

CLI tool that generates runtime context for AI coding agents. TypeScript + Hono.

## Commands

| Action | Command |
|--------|---------|
| Build | `npm run build` |
| Test | `npm test` |
| Lint | `npm run lint` |
| Format | `npm run format` |

## Architecture

```
core/
  commands/       CLI command handlers (analysis, planning, workflow)
  services/       Business logic (sync-service, context-selector, memory-service)
  domain/         Algorithms (bm25, import-graph, git-cochange, file-ranker)
  agentic/        Agent runtime (orchestrator, context-builder, smart-context)
  storage/        SQLite persistence (database.ts, metrics-storage, state-storage)
  types/          All type definitions (project-sync, domain, commands, services)
  infrastructure/ Config, path resolution, command installation
templates/
  commands/       Skill templates (task.md, ship.md, sync.md)
  subagents/      Agent templates (workflow only: prjct-workflow, planner, shipper)
```

## Key paths

- Project data: `~/.prjct-cli/projects/{projectId}/`
- Global rules: `~/.claude/CLAUDE.md` (between `<!-- prjct:start -->` markers)
- Agent files: `~/.prjct-cli/projects/{projectId}/agents/*.md`
- SQLite DB: `~/.prjct-cli/prjct.db`
- Never write prjct data to repo root or `.prjct/`

## Sync pipeline (sync-service.ts)

1. Git analysis → stats → stack detection
2. Build indexes: BM25 (text search), import graph, co-change matrix
3. Generate workflow agents from templates
4. Record metrics from real index data (not estimates)
5. Install global CLAUDE.md section + verify

## Conventions

- Strict TypeScript, no `any` without justification
- All storage through SQLite (`core/storage/database.ts`)
- Tests with `bun:test` — run `npm test`
- Biome for lint/format (pre-commit hook via lefthook)
