# Architecture

## Top-level layout

```
bin/prjct                       Thin JS shim that dispatches to core/index.ts
                                + subprocess entry points (linear/jira CLI, daemon, MCP)

core/
  index.ts                      Main CLI dispatcher (help, command routing)
  cli/                          Standalone CLI entry points (linear.ts, jira.ts)
                                spawned as subprocesses from bin/prjct
  commands/                     CLI command handlers (task, sync, ship, done, …)
  services/                     Cross-cutting business logic (sync-service,
                                skill-generator, pattern-extractor, …)
  domain/                       Pure algorithms — no IO, no singletons
                                (bm25, import-graph, git-cochange, file-ranker)
  agentic/                      Agent runtime (orchestrator, template-loader,
                                command-executor, memory system)
  storage/                      SQLite persistence (one DB file per project)
  infrastructure/               Config, path resolution, install, providers
  schemas/                      Zod schemas — source of truth for runtime + types
  types/                        Plain TypeScript type aliases (no runtime code)
  utils/                        Small reusable helpers
  workflows/                    Long-running workflows (onboarding, outcomes)
  mcp/                          MCP server (context tools for agents)
  daemon/                       Background daemon (file watching, sync)
  server/                       Local HTTP + SSE server (web dashboard API)
  sync/                         Cloud sync (auth, batch, push/pull)
  tools/context/                Context-filtering tools (files, signatures,
                                imports, recent, summary, token-counter)

templates/                      Skill and command templates (thin; the CLI
                                emits --md output that templates consume)

docs/                           This directory
```

## Runtime flow

```
  Terminal
     │
     │  `prjct task "fix login"`
     ▼
  bin/prjct (JS shim)
     │
     │  dynamic import('../core/index')
     ▼
  core/index.ts (CLI dispatcher)
     │
     │  validateCommandParams → registry.ts lookup
     ▼
  core/commands/*            → core/services/*       → core/storage/*
  (handlers register          (business logic,          (SQLite; one DB
   methods with a              pure-ish functions)       per project at
   PrjctCommandsBase                                     ~/.prjct-cli/
   facade)                                               projects/{id}/prjct.db)
```

For CLI commands that gateway to MCP servers (`prjct linear …`, `prjct jira …`),
`bin/prjct` spawns a dedicated subprocess (`core/cli/linear.ts` or
`core/cli/jira.ts`) via `child_process.spawn`. These paths do **not** go through
`core/index.ts` — they have their own entry points.

## Retrieval triad

Agent-facing context filtering is powered by three independent signals that
combine in `core/domain/file-ranker.ts`:

```
  Task description               Seed file paths
        │                                │
        ▼                                ▼
┌──────────────┐   ┌────────────────┐   ┌─────────────────┐
│   BM25       │   │ Import graph   │   │  Git co-change  │
│   lexical    │   │ (forward +     │   │  matrix         │
│   index      │   │  reverse)      │   │  (co-edited in  │
│              │   │                │   │   same commit)  │
└──────┬───────┘   └────────┬───────┘   └────────┬────────┘
       │                    │                    │
       │ bm25.ts             │ import-graph.ts    │ git-cochange.ts
       │                    │                    │
       └──────────┬─────────┴──────────┬─────────┘
                  ▼                    ▼
            file-ranker.ts (weighted score → top-N)
```

- **BM25** (`core/domain/bm25.ts`) — lexical scoring over file contents and
  path segments. Tokenizer extracts function names, class names, path parts;
  applies stop-word filter and length penalty.
- **Import graph** (`core/domain/import-graph.ts`) — parses TypeScript/JS
  `import` statements, builds forward and reverse adjacency lists. Used to
  propagate relevance from a seed file to its dependency graph.
- **Git co-change** (`core/domain/git-cochange.ts`) — walks recent git
  commits, records files that change together. Files frequently co-edited
  with a seed get a relevance boost.
- **File ranker** (`core/domain/file-ranker.ts`) — combines the three signals
  with configurable weights and returns the top-N ranked files.

All three indexes are built once per `prjct sync` and stored in the project's
SQLite database. Subsequent `prjct task` / `prjct context files` calls read
from the cached index.

## Schemas: Zod as source of truth

Runtime validation and TypeScript types must never drift. The convention is:

```ts
// core/schemas/state.ts
export const StateJsonSchema = z.object({ … })
export type StateJson = z.infer<typeof StateJsonSchema>
```

Consumers import either the schema (for `parse` / `safeParse` at boundaries)
or the inferred type (for static checking inside the app). Never re-declare
the shape as a plain `interface`.

Parse at system boundaries only: when reading a file, responding to an HTTP
request, or accepting external input. Internal code operates on already-typed
data.

## Storage: SQLite since v1.24.1

One SQLite file per project: `~/.prjct-cli/projects/{projectId}/prjct.db`.
All reads and writes go through `core/storage/database.ts` and the per-entity
storage modules (`state-storage.ts`, `ideas-storage.ts`, `queue-storage.ts`,
…). Connections are LRU-cached with WAL mode enabled.

Legacy JSON state files are only touched by the one-time migration
(`core/storage/migrate-json.ts`). See `docs/sqlite-migration.md` for the
migration story, inspection tips, and troubleshooting.

**Never** `fs.readFile` a legacy JSON state file directly. Go through the CLI.

## Skill-on-demand templates

`templates/commands/*.md` files are thin (~17 lines each). They do not contain
logic — they call the CLI with a `--md` flag and read the markdown the CLI
emits:

```bash
prjct task "fix login" --md      # → markdown task context, ready for agent
prjct sync --md                  # → sync report + analysis payload
prjct status --md                # → current task + queue summary
```

The heavy lifting lives in `core/utils/md-formatter.ts` and the per-command
implementations under `core/commands/`. This keeps templates under version
control in the shipped package while allowing every command to feed
structured context to any agent.

## Testing

- Framework: `bun:test` (native Bun test runner).
- Tests live in `core/__tests__/`, mirroring the source tree.
- Filesystem-touching tests use `os.tmpdir()` fixtures created in `beforeEach`
  and cleaned in `afterEach`.
- Database tests use a real SQLite file in a temp directory. **Do not mock
  the database layer** — mocked tests have historically masked real
  migration and integrity bugs.
- Mock only external HTTP (Linear API, Jira API, prjct cloud API) by
  stubbing `globalThis.fetch` per test.
- Run: `bun test` (or `bun test path/to/file.test.ts` for a single file).

## Lint and dead code

- **Biome** (`biome.json`) enforces style and catches unused imports,
  variables, and void-typed returns at `"error"` level — CI fails if any
  show up.
- **Knip** (`knip.json`) finds unused exports, orphan files, and unused
  dependencies. Run `bun run knip` locally before large cleanups.

## Key code rules

- **No barrel files, no re-exports.** Import directly from the source
  module: `import { X } from './y'`, never `export { X } from './y'`.
- **All data in SQLite.** Never `fs.readFile` the legacy JSON state files.
- **Biome errors are blocking.** Do not commit code with lint errors.
- **Schemas are source of truth.** Define with Zod, infer TypeScript types.
