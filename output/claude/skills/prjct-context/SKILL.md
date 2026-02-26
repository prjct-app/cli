---
description: "Project context with state and user patterns (prjct-cli, TypeScript)"
allowed-tools: []
user-invocable: false
---

# prjct-cli
TypeScript | 331 files | v1.47.2 | Branch: refactor/kill-static-context-generation

## Patterns
- **Zod schema-first validation**: All domain schemas defined with Zod, types inferred via z.infer. Runtime validation at boundaries. (core/schemas/)
- **Singleton service classes**: Services instantiated as module-level singletons exported as default (AuthConfigManager, DoctorService, SyncManager). (core/sync/auth-config.ts)
- **Storage adapter pattern**: Each domain has a dedicated typed storage class wrapping SQLite. (core/storage/)
- **Centralized type definitions**: All shared types consolidated in core/types/ with domain-specific files. (core/types/)
- **Template-driven CLI commands**: CLI commands load markdown templates from templates/commands/ and execute structured workflows. (templates/commands/)

## Anti-Patterns
- LOW: Unbounded any in test files in `core/__tests__/services/pattern-extractor.test.ts` — Create typed test fixtures or use unknown with type narrowing.
- MEDIUM: Unscoped @ts-ignore directives in `core/services/pattern-extractor.ts` — Replace with @ts-expect-error including rationale comment.

## Recent Deliveries
- "kill static context generation" — feature
- "exquisite-terminal-ux" — feature
- "current work" — feature

## Velocity
0 pts/sprint | stable | Estimation accuracy: 0%

## Commands
| Action | Command |
|--------|---------|
| Build | `bun run build` |
| Test | `bun test` |
| Lint | `bun run lint` |
| Dev | `bun run dev` |
| Format | `bun run format` |

## State
Paused: mejorar logo de prjct - cambiar a minusculas y colores neutros estilo ASCII art (2026-02-23T17:49:26.467Z)
Paused: Add user authentication with login form and database ()
Shipped: 3
