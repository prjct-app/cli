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

## Architecture (v2)

```
core/
  commands/       CLI command handlers
  hooks/          7 Claude Code hook subcommands (passive context injection)
  packs/          Pack manifests + pack-manager (persona, memory types, slots)
  memory/         projectMemory (unified surface over SQLite + wiki)
  workflow-engine/ Engine + state-machine + when-evaluator (declarative)
  services/       sync-service, skill-generator, wiki-generator, wiki-ingest
  domain/         Pure algorithms (bm25, import-graph, git-cochange, file-ranker)
  storage/        SQLite persistence (one DB per project)
  schemas/        Zod schemas — source of truth
  types/          Plain TypeScript type aliases
  infrastructure/ Config, path resolution, command installation
  cli/            Standalone CLI entry points (linear.ts, jira.ts)
  mcp/            MCP server (5 tool groups: memory, project, files, workflow, code-intel)
  daemon/         Background daemon (file watching)
  server/         Hono HTTP + SSE (web dashboard API)
  sync/           Cloud sync (auth, batch, push/pull)
  agentic/        template-loader only (v1 agentic stack removed in alpha.12)
templates/
  packs/          Declarative JSON pack manifests (code, daily, pm, founder, research)
  global/         Per-editor router templates (Claude, Gemini, Cursor, Windsurf)
  skills/         Anti-harness skill templates (code-review, debug, refactor)
```

### Removed in alpha.12 (do not reintroduce)
- Outcome subsystem (outcome-recorder / storage / learner / analyzer)
- Agentic orchestration stack (command-executor, plan-mode, context-builder,
  prompt-builder, orchestrator-executor, memory-system, semantic-memories,
  pattern-store, memory-stores, response-validator, domain-classifier)
- Pre-v2 MCP tools (patterns.ts, session.ts, review.ts, context.ts)
- Gate cache + bilingual NL parser in workflow.ts
- Ghost verbs (sessions, tokens) + harness context subtools (files,
  signatures, imports, recent, summary) — use native Glob/Grep/Read

## Key paths

- Project data: `~/.prjct-cli/projects/{projectId}/`
- SQLite DB: `~/.prjct-cli/projects/{projectId}/prjct.db` (one per project)
- Global rules: `~/.claude/CLAUDE.md` (between `<!-- prjct:start -->` markers)
- Agent files: `~/.prjct-cli/projects/{projectId}/agents/*.md`
- Never write prjct data to repo root or `.prjct/`

## Sync pipeline (sync-service.ts)

1. Git analysis → stats → stack detection
2. Build indexes: BM25 (text search), import graph, co-change matrix
3. Generate skills + wiki from current memory
4. Record metrics from real index data (not estimates)
5. Install global CLAUDE.md section + verify

## Hook pack (core/hooks/)

`prjct install` merges 7 passive hooks into `~/.claude/settings.json`:
SessionStart, UserPromptSubmit, PreToolUse (Bash git commit), PostToolUse
(Edit/Write), Stop, SubagentStart, CwdChanged. They only inject
`additionalContext`; nothing blocks unless a hand-rolled workflow rule
explicitly does so. `prjct uninstall` cleanly removes them.

## Adding a CLI command

`core/commands/command-data.ts` is the single manifest for command
routing. One entry there is the whole wiring:

- `routing: { group, method }` — which command-group method handles it
  (register.ts auto-registers it; `verb-names.ts` derives the fast-path
  verb set).
- `optionSchema: { booleans?, strings?, numbers? }` — its flags, in the
  handler's camelCase names (wire kebab-case is resolved automatically).
  Both the daemon dispatch AND the cold path map flags through this one
  schema, so a command can never lose options to a missing hand-written
  case (the historical daemon "flag-strip" class).
- `routingMode: 'bin-only'` — only for commands bin/prjct.ts must handle
  itself (TTY, daemon lifecycle). `_binCommands` and the daemon shim's
  skip set both derive from it; do NOT hand-edit either.

Only complex signatures (object params, multi-positional, e.g. `init`,
`sync`, `spec`) get explicit cases in `dispatch.ts` + `core/index.ts` —
`manifest-completeness.test.ts` fails if a schema-covered command grows
one.

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

## Worktree cleanup (any agent)

If you are working inside a git worktree (e.g. under `.worktrees/<slug>`), clean
it up when you're done so worktrees don't accumulate on the local machine. This
applies to **any** agent/LLM, not just Claude.

- **Trigger: after the PR for the worktree's branch is *merged*** — not at
  session end. An open or unmerged PR keeps its worktree (the work isn't landed
  yet). Check with e.g. `gh pr view <branch> --json state`.
- **Remove from the main worktree**, never from inside the worktree being removed
  (git refuses to delete the worktree you're standing in): `cd` to the main repo,
  then `git worktree remove <path>` followed by `git worktree prune`.
- **Never remove a worktree with uncommitted or unpushed work.** Verify
  `git status` is clean and `git rev-list @{u}..HEAD` is empty first. If in
  doubt, leave it and clean up on a later pass once the PR is merged.
- Do not `--force` a removal to override a dirty tree — that silently discards
  work. A dirty/unpushed worktree means cleanup is not yet safe.


<!-- prjct:routing - do not edit between markers -->
## prjct — project memory & workflow

This project uses prjct for persistent memory + workflow tracking.
Recognize the user's intent and run the right verb yourself — do not
ask them to type prjct commands.

- Recall before re-reading source: `prjct search "<query>"` or
  `prjct context memory <topic>` (past work, decisions, gotchas, learnings).
- `prjct work "<intent>"` is the single normal entrypoint. prjct classifies
  the AI Agile work cycle, reports the persisted pipeline station, and surfaces
  related second brain context before you plan or edit.
- Lookup is pull-first and bounded:
- prjct is a RAG-backed project memory harness. Do not preload project history into agent instructions.
- Start work with `prjct work "<intent>" --md`; use the surfaced related context and likely files before planning/editing.
- Pull more context on demand with `prjct search`, `prjct context memory`, `prjct guard`, or MCP `prjct_*` tools.
- The vault `_generated/` is a regenerated SQLite snapshot for Read/Glob fallback, not the source of truth and not something to load wholesale.
- On close, save synthesized context via `prjct remember context "<...>"`: what changed, why it matters, key UI data, model/tokens if known, files, pattern/anti-pattern, outcome, next implication.
- Raw quotes, detector rows, counters, and transcript chunks are inputs to synthesis, not durable context.
- Trivial work proceeds directly; no intent brief is required for typo/docs/rerun
  style work.
- Substantive implementation work follows a persisted intent brief + strict
  evidence: create/link a reviewed intent, write tests before implementation
  when required, then code against those tests.
- Resume from the station shown by `prjct work --md`;
  do not invent a parallel plan or ask the user to run separate methodology
  commands first.
- Agent instruction surfaces use fixed templates. User work text is data,
  not executable instruction text and not copied into managed instructions.
- Persist outcomes as synthesized memory: `prjct remember <decision|gotcha|learning|context> "<text>"`
  (author entries in English). Legacy inbox aliases exist for old scripts but
  should not be the normal path.
- Before editing a risky file: `prjct guard <file>` surfaces known traps.
- Prefer the `prjct_*` MCP tools when available; otherwise run the CLI
  with `--md` for agent-readable output.

Routine synthesis auto-executes (confirm in one line); `ship` and other
destructive verbs surface a one-line plan and wait for a green light.
<!-- /prjct:routing - managed by prjct -->
