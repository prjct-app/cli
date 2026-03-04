⚡ prjct
⚡ prjct

---

## ⚡ Refactor the authentication system to support OAuth2 with Google and GitHub providers, add session management with Redis, implement RBAC middleware, and write integration tests for all auth flows
> Branch: `main` | Type: feature | ~1pts | ~10min | Domains: auth

### Context Contract
- **Goal**: Refactor the authentication system to support OAuth2 with Google and GitHub providers, add session management with Redis, implement RBAC middleware, and write integration tests for all auth flows
- **Scope**: feature · ~1pts · ~10min (history)
- **Domains**: auth
- **Key files**: `core/sync/auth-config.ts`, `core/session/git-helpers.ts`, `core/integrations/linear/service.ts`, `core/integrations/jira/service.ts`, `core/integrations/issue-tracker/base-service.ts`, `core/services/session-tracker.ts`

### Relevant Files
- `core/sync/auth-config.ts` — keyword:auth, domain:auth, recent:1m, history:penalized
- `core/session/git-helpers.ts` — keyword:session, domain:auth, recent:1w, history:penalized
- `core/integrations/linear/service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w, history:penalized
- `core/integrations/jira/service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w, history:penalized
- `core/integrations/issue-tracker/base-service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w, history:penalized
- `core/services/session-tracker.ts` — keyword:session, domain:backend, domain:auth, recent:1w, history:penalized
- `core/session/compaction.ts` — keyword:session, domain:auth, recent:1m, history:boosted
- `core/schemas/session-snapshot.ts` — keyword:session, domain:backend, domain:auth, history:penalized
- `core/integrations/linear/cache.ts` — keyword:integration, domain:testing, recent:1w, history:penalized
- `core/integrations/jira/cache.ts` — keyword:integration, domain:testing, recent:1w, history:penalized
- `core/integrations/issue-tracker/cache-factory.ts` — keyword:integration, domain:testing, recent:1w, history:penalized
- `core/infrastructure/author-detector.ts` — keyword:auth, domain:auth, recent:1w, history:penalized
- `core/session/task-session-manager.ts` — keyword:session, domain:auth, recent:1w, history:penalized
- `core/session/session-snapshot.ts` — keyword:session, domain:auth, recent:1w, history:penalized
- `core/session/utils.ts` — keyword:session, domain:auth, recent:1w, history:penalized

### Previously Useful Files
`core/__tests__/agentic/prompt-assembly.test.ts`, `core/agentic/orchestrator-executor.ts`, `core/agentic/prompt-builder.ts`, `core/commands/analytics.ts`, `core/commands/workflow.ts`

### Pattern Briefing (for this task)

**1. Hono API validation via Context7** [context7]
   Validate Hono APIs against current documentation through Context7 before implementation.

### RPI Phase
**Phase: RESEARCH** — Explore the codebase first. Use the **Agent tool** (sub-agents) for broad exploration.
Produce a truth snapshot: exact files + lines, function call chains, test locations.
Save findings with `prjct compact --md` when done exploring.

### Efficiency
- Be concise. No preamble, no filler.
- **Use sub-agents (Agent tool) for exploration that produces >5 file reads.** Sub-agents isolate context and prevent the main conversation from bloating.
- Prefer `file:line` references over dumping full file contents.
- When context grows large, use `prjct compact --md` to create a truth snapshot.

### Next
| Command | Action |
|---|---|
| `prjct context files "Refactor the authentication system to support OAuth2 with Google and GitHub providers, add session management with Redis, implement RBAC middleware, and write integration tests for all auth flows"` | Find relevant files |
| `prjct done --md` | Complete subtask |
| `prjct pause --md` | Pause task |

---
⚡ prjct · v1.50.2
⚡ prjct
