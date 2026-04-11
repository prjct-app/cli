# prjct-cli

CLI tool that generates runtime context for AI coding agents. TypeScript + Hono.

See [`docs/architecture.md`](docs/architecture.md) for the full architecture
walkthrough (layers, retrieval triad, schemas, testing) and
[`docs/sqlite-migration.md`](docs/sqlite-migration.md) for the v1.24.1
JSON → SQLite migration and DB inspection tips.

## Commands

| Action | Command |
|--------|---------|
| Build | `npm run build` |
| Test | `bun test` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Dead code | `bun run knip` |

## Architecture

```
core/
  commands/       CLI command handlers (analysis, planning, workflow)
  services/       Business logic (sync-service, context-selector, memory-service)
  domain/         Pure algorithms (bm25, import-graph, git-cochange, file-ranker)
  agentic/        Agent runtime (orchestrator, context-builder, smart-context)
  storage/        SQLite persistence (database.ts, state-storage, metrics-storage)
  schemas/        Zod schemas — source of truth for runtime validation + types
  types/          Plain TypeScript type aliases
  infrastructure/ Config, path resolution, command installation
  cli/            Standalone CLI entry points (linear.ts, jira.ts)
  mcp/            MCP server for agent context tools
  daemon/         Background daemon
  sync/           Cloud sync (auth, batch, push/pull)
templates/
  commands/       Skill templates (task.md, ship.md, sync.md)
  subagents/      Agent templates (workflow only: prjct-workflow, planner, shipper)
```

## Key paths

- Project data: `~/.prjct-cli/projects/{projectId}/`
- SQLite DB: `~/.prjct-cli/projects/{projectId}/prjct.db` (one per project)
- Global rules: `~/.claude/CLAUDE.md` (between `<!-- prjct:start -->` markers)
- Agent files: `~/.prjct-cli/projects/{projectId}/agents/*.md`
- Never write prjct data to repo root or `.prjct/`

## Sync pipeline (sync-service.ts)

1. Git analysis → stats → stack detection
2. Build indexes: BM25 (text search), import graph, co-change matrix
3. Generate workflow agents from templates
4. Record metrics from real index data (not estimates)
5. Install global CLAUDE.md section + verify

## Code rules

These are enforced by lint/CI, not just convention:

- **No barrel files, no re-exports.** Import directly from the source module.
  - ✗ `export { X } from './y'`
  - ✓ `import { X } from './y'` in the consumer
- **All data in SQLite.** Never `fs.readFile` the legacy JSON state files
  (`state.json`, `queue.json`, etc.). Use the `prjct` CLI or a
  `*-storage.ts` module. See [`docs/sqlite-migration.md`](docs/sqlite-migration.md).
- **Biome errors are blocking.** `noUnusedImports`, `noUnusedVariables`, and
  `noVoidTypeReturn` are set to `"error"` in `biome.json`. Fix before commit.
- **Schemas are source of truth.** Define with Zod in `core/schemas/`,
  infer TypeScript types with `z.infer<typeof Schema>`. Do not duplicate the
  shape as a plain `interface`.
- **Strict TypeScript.** No `any` without explicit justification.
- **Tests hit real SQLite, not mocks.** Per-test tmpdir via `os.tmpdir()`;
  see `core/__tests__/storage/sqlite-migration.test.ts` for the pattern.
- **Biome + lefthook** handle format on pre-commit. Run `bun run check:fix`
  to apply all Biome fixes at once.
