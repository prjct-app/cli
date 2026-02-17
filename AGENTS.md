<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli - Project Rules
<!-- projectId: bc401c41-c8b9-436a-ac78-c91cac82ab4f -->
<!-- Generated: 2026-02-17T02:56:23.371Z -->
<!-- Ecosystem: JavaScript | Type: enterprise -->

## THIS PROJECT (JavaScript)

**Type:** enterprise
**Path:** /Users/jj/Apps/prjct/prjct-cli

### Commands (USE THESE, NOT OTHERS)

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Run dev server | `npm run dev` |
| Run tests | `npm test` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format | `npm run format` |

### Code Conventions

- **Languages**: TypeScript
- **Frameworks**: Hono

### Code Patterns (Follow These)

- **Prefer strict typing contracts**: Functions and component props should be explicitly typed; avoid implicit any boundaries.
- **Type-first API surfaces**: Exported modules should define reusable domain types for inputs and outputs.
- **Hono API validation via Context7**: Validate Hono APIs against current documentation through Context7 before implementation.
- **Image rendering via next/image**: Project uses next/image for optimized image delivery. (app/** or src/**)
- **Use UiButton abstraction**: Buttons are wrapped in UiButton instead of native button in app UI. (components/**)
- **Strict type/lint hygiene**: Detected 6 any, 2 ts-ignore, 0 raw img potential violations.

### Anti-Patterns (Avoid These)

- **Unbounded any type** in `multiple` — Use explicit types or unknown with narrowing. Add inline justification for unavoidable any.
- **Unscoped @ts-ignore** in `multiple` — Prefer @ts-expect-error with rationale and follow-up cleanup ticket.
- **Unchecked @ts-ignore usage** in `core/services/pattern-extractor.ts` — Use @ts-expect-error with reason or refactor typings.
- **Unbounded any usage** in `core/__tests__/services/pattern-extractor.test.ts` — Replace with specific types or justified unknown + narrowing.
- **Unbounded any usage** in `core/__tests__/domain/bm25.test.ts` — Replace with specific types or justified unknown + narrowing.
- **Unbounded any usage** in `core/storage/workflow-rule-storage.ts` — Replace with specific types or justified unknown + narrowing.

---

## prjct Rules

### Path Resolution
**ALL prjct writes go to**: `~/.prjct-cli/projects/bc401c41-c8b9-436a-ac78-c91cac82ab4f/`
- NEVER write to `.prjct/`
- NEVER write to `./` for prjct data

### Workflow
```
p. sync → p. task "desc" → [work] → p. done → p. ship
```

| Command | Action |
|---------|--------|
| `p. sync` | Re-analyze project |
| `p. task X` | Start task |
| `p. done` | Complete subtask |
| `p. ship X` | Ship feature |

## Project State

| Field | Value |
|-------|-------|
| Name | prjct-cli |
| Version | 1.45.2 |
| Ecosystem | JavaScript |
| Branch | fix/jira-linear-mcp-setup-templates |
| Files | ~362 |
| Commits | 623 |

## Agents

Load from `~/.prjct-cli/projects/bc401c41-c8b9-436a-ac78-c91cac82ab4f/agents/`:

**Workflow**: prjct-workflow, prjct-planner, prjct-shipper
**Domain**: backend, database

## Recent Learnings

### Shipped Features
- **JIRA Integration** (v0.31.0): Full JIRA integration with IssueTrackerProvider, p. jira commands, and statusline component
- **Enrichment enabled by default** (v0.30.3): Fixed CONFIG_ENRICHMENT_ENABLED not set in statusline config. Enrichment now enabled by default.
- **PM Expert auto-enrichment + statusline fixes** (v0.30.2): PM Expert 5-phase enrichment runs automatically in p. task. Quick Technical Analysis in p. bug. Fixed statusline installation issues.
- **Modular statusline with Linear integration** (v0.29.0): Modular statusline with 8 components, Linear integration, graceful degradation, optimized performance
- **Per-project task filtering for status bar** (v0.28.0): Extended API with cwd-based filtering. Status bar can now auto-detect and show per-project tasks.

<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->