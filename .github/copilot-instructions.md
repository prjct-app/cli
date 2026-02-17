# Copilot Instructions

This is prjct-cli, a JavaScript project.

<!-- source: package.json, detected -->
## Project Info
- Type: enterprise
- Stack: Hono

## Code Patterns
- **Prefer strict typing contracts**: Functions and component props should be explicitly typed; avoid implicit any boundaries.
- **Type-first API surfaces**: Exported modules should define reusable domain types for inputs and outputs.
- **Hono API validation via Context7**: Validate Hono APIs against current documentation through Context7 before implementation.
- **Image rendering via next/image**: Project uses next/image for optimized image delivery. (app/** or src/**)
- **Use UiButton abstraction**: Buttons are wrapped in UiButton instead of native button in app UI. (components/**)

## Anti-Patterns
- **Unbounded any type** in `multiple` — Use explicit types or unknown with narrowing. Add inline justification for unavoidable any.
- **Unscoped @ts-ignore** in `multiple` — Prefer @ts-expect-error with rationale and follow-up cleanup ticket.
- **Unchecked @ts-ignore usage** in `core/services/pattern-extractor.ts` — Use @ts-expect-error with reason or refactor typings.

<!-- source: package.json, detected -->
## Commands
- Test: `npm test`
- Build: `npm run build`

## prjct Rules

Path: `~/.prjct-cli/projects/bc401c41-c8b9-436a-ac78-c91cac82ab4f/`
Workflow: `p. sync` → `p. task "desc"` → work → `p. done` → `p. ship`

## Project State

| Field | Value |
|-------|-------|
| Name | prjct-cli |
| Version | 1.44.10 |
| Ecosystem | JavaScript |
| Branch | bug/daemon-restart-after-update |
| Files | ~362 |
| Commits | 621 |

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
