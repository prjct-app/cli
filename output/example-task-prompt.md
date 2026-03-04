# Example: What Claude Code receives from `prjct task --md`

> This is the EXACT output that Claude Code reads when a skill invokes
> `prjct task "..." --md`. Every section below is injected into Claude's context.
>
> **v1.50.2+**: Locked Decisions, Task Patterns, Project, and Commands sections
> removed — they live in CLAUDE.md global context (installed by `prjct start`).
> Only task-specific context is injected per-task.

---

## ⚡ Refactor the authentication system to support OAuth2 with Google and GitHub providers, add session management with Redis, implement RBAC middleware, and write integration tests for all auth flows
> Branch: `main` | Type: feature | ~1pts | ~10min | Domains: auth

### Context Contract
- **Goal**: Refactor the authentication system to support OAuth2 with Google and GitHub providers, add session management with Redis, implement RBAC middleware, and write integration tests for all auth flows
- **Scope**: feature · ~1pts · ~10min (history)
- **Domains**: auth
- **Key files**: `core/sync/auth-config.ts`, `core/session/git-helpers.ts`, `core/integrations/linear/service.ts`, `core/integrations/jira/service.ts`, `core/integrations/issue-tracker/base-service.ts`, `core/services/session-tracker.ts`

### Relevant Files
- `core/sync/auth-config.ts` — keyword:auth, domain:auth, recent:1m
- `core/session/git-helpers.ts` — keyword:session, domain:auth, recent:1w
- `core/integrations/linear/service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w
- `core/integrations/jira/service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w
- `core/integrations/issue-tracker/base-service.ts` — keyword:integration, domain:backend, domain:testing, recent:1w
- `core/services/session-tracker.ts` — keyword:session, domain:backend, domain:auth, recent:1w
- `core/session/compaction.ts` — keyword:session, domain:auth, recent:1m, history:boosted
- `core/integrations/linear/cache.ts` — keyword:integration, domain:testing, recent:1w
- `core/integrations/jira/cache.ts` — keyword:integration, domain:testing, recent:1w
- `core/integrations/issue-tracker/cache-factory.ts` — keyword:integration, domain:testing, recent:1w
- `core/infrastructure/author-detector.ts` — keyword:auth, domain:auth, recent:1w
- `core/session/task-session-manager.ts` — keyword:session, domain:auth, recent:1w
- `core/session/session-snapshot.ts` — keyword:session, domain:auth, recent:1w
- `core/session/utils.ts` — keyword:session, domain:auth, recent:1w
- `core/types/session.ts` — keyword:session, domain:auth, history:boosted

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
| `prjct context files "..."` | Find relevant files |
| `prjct done --md` | Complete subtask |
| `prjct pause --md` | Pause task |

---

# Analysis: How Claude Code processes this

## Section flow (what Claude reads top-to-bottom):

1. **Task header** — What to do, branch, type, estimate, domains
2. **Context Contract** — Goal, scope, key files (+ high-severity anti-pattern guards if any)
3. **Relevant Files** — Scored file list with relevance reasons
4. **Previously Useful Files** — Files from past tasks boosted/penalized by feedback
5. **Pattern Briefing** — Must-follow patterns ranked by metadata (repo > context7 > feedback > baseline)
6. **RPI Phase** — Explicit phase guidance with sub-agent recommendation
7. **Efficiency** — Sub-agent directive + context management rules
8. **Next Steps** — Available commands to continue the workflow

## What moved to CLAUDE.md global (no longer per-task):

| Section | Reason |
|---------|--------|
| Locked Decisions (commit rules) | Same for every task — installed once by `prjct start` |
| Task Patterns (repo rules) | Redundant with Pattern Briefing — patterns already appear there |
| Project (ecosystem, languages) | Static project info — doesn't change per task |
| Commands (install, test, build...) | Static — same for every task in the project |

## Sub-agent enforcement points:

| Location | Directive | Trigger |
|----------|-----------|---------|
| RPI Phase (research) | "Use the **Agent tool** (sub-agents) for broad exploration" | Always on first task invocation |
| RPI Phase (plan) | "Use sub-agents to verify assumptions" | When research doc exists |
| RPI Phase (implement) | "Minimal exploration" / scoped files only | When both docs exist |
| Efficiency | "**Use sub-agents (Agent tool) for exploration >5 file reads**" | Always present |
| Efficiency | "use `prjct compact --md` to create a truth snapshot" | Always present |

## What Claude Code does with this:

- Reads "Agent tool" → maps to its available `Agent` tool
- Reads "sub-agents" → understands these as isolated context workers
- Reads ">5 file reads" → concrete threshold for when to delegate
- Reads "truth snapshot" → knows to compact before context bloats
- High-severity anti-patterns (if any) → task-specific guardrails only
