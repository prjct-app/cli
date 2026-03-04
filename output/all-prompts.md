# All --md Outputs (2026-03-03 15:28)

---

## Command: prjct task 'implement context health monitor' --md

```
---

## implement context health monitor
> Branch: `main` | Type: feature | ~1pts | ~10min | Domains: general

### Context Contract
- **Key files**: `core/agentic/context-health.ts`, `core/commands/context-contract.ts`, `core/tools/context/imports-tool.ts`, `core/types/context-tools.ts`, `core/commands/context.ts`, `core/services/context-selector.ts`

### Relevant Files
- `core/agentic/context-health.ts` — keyword:context, keyword:health, domain:frontend, history:penalized
- `core/commands/context-contract.ts` — keyword:context, domain:frontend, recent:1m, history:boosted
- `core/tools/context/imports-tool.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/types/context-tools.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/commands/context.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/services/context-selector.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/services/context7-service.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/tools/context/recent-tool.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/tools/context/files-tool.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/tools/context/token-counter.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/agentic/smart-context.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/agentic/context-builder.ts` — keyword:context, domain:frontend, recent:1w, history:penalized
- `core/tools/context/index.ts` — keyword:context, domain:frontend, recent:1m, import:0, history:penalized
- `core/agentic/command-context.ts` — keyword:context, domain:frontend, recent:1m, history:penalized
- `core/storage/context-feedback-storage.ts` — keyword:context, domain:frontend, recent:1m, history:penalized

### Previously Useful Files
`core/commands/workflow.ts`, `core/__tests__/agentic/prompt-assembly.test.ts`, `core/agentic/orchestrator-executor.ts`, `core/commands/analytics.ts`, `core/session/compaction.ts`

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
prjct v1.50.2
```

---

## Command: prjct done --md

```
> **idle**: no active task

- Start a task: `prjct task "description" --md`
- Check queue: `prjct next --md`
No active task to complete
```

---

## Command: prjct status --md

```
---

## Status: prjct-cli

| Metric | Value |
|---|---|
| Staleness | fresh |
| Last sync | today |
| Commits since sync | 0 |
| Reason | Context is up to date |

### Analysis
- Draft: a2df291 (pending seal)
- Previous: null (rollback available)

---
prjct v1.50.2
```

---

## Command: prjct next --md

```
---

### Queue
50 tasks

1. no se hace la actualizacion al instalar la nueva version en npm i prjct-cli [bug] high
2. Skills de Notion no registrados - /p:notion setup|sync|push no reconocidos aunque templates y código existen [bug] medium
3. Add prjctId + lastUpdated columns to Notion databases [feature] high
4. Add notionPageId field to prjct storage types (shipped, ideas, queue) [feature] high
5. Enhance push sync to include ALL fields (description, commit, metrics, duration) [feature] high
6. Implement pull sync function (Notion → prjct) for all databases [feature] high
7. Add conflict resolution with lastUpdated timestamp comparison [feature] high
8. Create /p:notion sync command template for bidirectional sync [feature] high
9. Create runtime detector utility (core/utils/runtime.ts) [feature] high
10. Add TypeScript build script with esbuild [feature] high
11. Create wrapper entry point (bin/prjct shell script) [feature] high
12. Rename current bin/prjct to bin/prjct.ts for bun [feature] high
13. Update server with @hono/node-server adapter [feature] high
14. Update postinstall to build dist/ for Node [feature] high
15. Update package.json with build scripts and bin mapping [feature] high
16. Test both runtimes work correctly [feature] high
17. Remove unnecessary shell:true from bin/serve.js and bin/dev.js [security] high
18. Add whitelist validation for dynamic agent imports in base.ts [security] high
19. Differentiate error types in catch blocks (ENOENT vs parse errors) [security] high
20. Implement cache expiration in StorageManager [performance] normal
21. Add LRU cache limit to template-loader [performance] normal
22. Fix type safety - replace 'as unknown' with proper interfaces [architecture] normal
23. Resolve circular dependency in config-manager.ts [architecture] normal
24. Create custom error hierarchy (ProjectNotFound, ConfigError, etc.) [architecture] low
25. Simplify logger level detection logic [quality] low
26. Create path constants file to reduce duplication [quality] low
27. test bug [bug] medium
28. test bug 2 [bug] medium
29. Workflow templates (ship, done) not enforced as mandatory. LLM skips ship workflow after task completion. Requirements: (1) done should be implicit when ship runs, (2) ship workflow must be mandatory after task completion, (3) workflow templates should be editable per-project with a base template, (4) LLM must prompt 'ready to ship?' after completing work [bug] medium
30. Claude Code NO ENTIENDE EL CONTEXTO QUE LE ESTAMOS PASANDO - tiene que repetir las cosas 10 veces, no sirve o entiende lo que le pasa prjct-cli. Necesitamos solución real, no parches. Aplica para todos los LLMs. [bug] medium
31. Codex p. router metadata mismatch causes sync to fail with: Codex skill metadata mismatch (outdated router). Run prjct start or prjct setup to repair. [bug] medium
32. linear sync --force no limpia queue: el queue local en SQLite no se reconcilia con el estado de Linear. Tickets Done/In Review permanecen en el queue local. [bug] medium
33. Codex: prjct sync returns no_changes when context should update. In fluenty-widget, returns {success:true, action:no_changes} without syncing. [bug] medium
34. codex sigue igual [bug] medium
35. Context routing broken: agent runs 'prjct skill <cmd>' instead of 'prjct <cmd>' - template router prepends 'skill' to commands causing Command not found errors. Works in some projects, fails in others depending on how the skill was invoked. [bug] high
36. Workflows solo soportan shell hooks y gates, pero deberían soportar instrucciones de texto/proceso con contenido dinámico (ej: comentario de Linear con contenido que depende de lo implementado) [bug] medium
37. prjct update command doesn't work correctly - npm update/install doesn't apply changes, legacy files/commands/config persist, daemon stays stale after updates. Need to redesign prjct update to: 1) effectively update npm package globally, 2) apply migrations/cleanup removing all legacy artifacts including homebrew, 3) restart daemon to avoid stale state [bug] medium
38. Cleanup binding error: expected string, TypedArray, boolean, number, bigint or null for project e7e7e2eb [bug] high
39. p. bug command doesn't work in OpenAI Codex - need to investigate Codex compatibility [bug] medium
40. Daemon analyze/cleanup/design commands ignore request.cwd - uses daemon cwd instead of project cwd, causing cross-project context contamination [bug] medium
41. update command shows stale version: reports v1.39.0 → v1.42.3 but actual installed version is v1.42.4. Running update multiple times always shows the same stale version detection. [bug] medium
42. prjct update fails to restart daemon after update [bug] medium
43. p. workflow add with natural language fails - template passes raw text to CLI instead of parsing intent agentically [bug] medium
44. templates directory empty in globally installed prjct-cli — npm root -g points to /opt/homebrew/lib/node_modules/prjct-cli/templates/commands/ which is empty, so all p. commands fail with template not found [bug] medium
45. p. jira list command not recognized - Claude says jira command doesn't exist even though prjct CLI has jira integration. Template missing from installed commands or not being found. [bug] medium
46. test bug command [bug] medium
47. Login fails on mobile Safari [bug] medium
48. Login fails on mobile Safari [bug] medium
49. test bug description [bug] medium
50. test bug description [bug] medium

### Next
| Command | Action |
|---|---|
| `prjct task "..." --md` | Start top task |

---
prjct v1.50.2
```

---

## Command: prjct pause 'switching context' --md

```
> **idle**: no active task

- Start a task: `prjct task "description" --md`
No active task to pause
```

---

## Command: prjct resume --md

```
> **idle**: no paused task

- Start a new task: `prjct task "description" --md`
No paused task found
```

---

## Command: prjct dash --md

```
---

## Dashboard: prjct-cli

### Current Focus
No active task

### Queue (50)
1. no se hace la actualizacion al instalar la nueva version en npm i prjct-cli [high]
2. Skills de Notion no registrados - /p:notion setup|sync|push no reconocidos aunque templates y código existen [medium]
3. Add prjctId + lastUpdated columns to Notion databases [high]
4. Add notionPageId field to prjct storage types (shipped, ideas, queue) [high]
5. Enhance push sync to include ALL fields (description, commit, metrics, duration) [high]

### Recent Ships
- current work (2/21/2026)
- current work (2/21/2026)
- Code cleanup — eliminate duplicates, barrel files, re-exports (2/20/2026)
- extract context contract from workflow.ts (2/20/2026)
- extract context contract from workflow.ts (2/20/2026)

### Ideas
8 pending

### Next
| Command | Action |
|---|---|
| `prjct task "..." --md` | Start task |
| `prjct done --md` | Complete |
| `prjct ship --md` | Ship |

---
prjct v1.50.2
```

---

## Command: prjct sync --md --yes

```
---

## Sync Complete

| Metric | Value |
|---|---|
| Duration | 2.0s |
| Skills | 15 generated |
| Files indexed | 354 |
| Tokens indexed | 46K |
| Import edges | 1170 |
| Co-change commits | 39 |

> **WARNING:** Uncommitted changes detected

## LLM Analysis (hybrid pipeline)

After sync, run the analysis payload builder:
```bash
prjct analysis-payload --md
```

If the output says "Analysis is current", skip analysis.

Otherwise, analyze the JSON payload and produce a structured `LLMAnalysis` JSON:

```json
{
  "version": 1,
  "commitHash": "from payload git data",
  "analyzedAt": "ISO timestamp",
  "architecture": {
    "style": "monolith|monorepo|microservices|modular-monolith",
    "insights": ["key architectural observations"],
    "domains": ["identified modules/domains"]
  },
  "patterns": [{"name": "", "description": "", "locations": [], "confidence": 0.0, "category": ""}],
  "antiPatterns": [{"issue": "", "reasoning": "", "files": [], "suggestion": "", "severity": "low|medium|high", "confidence": 0.0}],
  "techDebt": [{"description": "", "area": "", "effort": "small|medium|large", "impact": "", "priority": "low|medium|high"}],
  "riskAreas": [{"path": "", "reason": "", "risk": "", "severity": "low|medium|high"}],
  "refactorSuggestions": [{"description": "", "files": [], "benefit": "", "effort": "small|medium|large"}],
  "projectInsights": ["key insights about the project"],
  "conventions": [{"category": "naming|file-structure|imports|error-handling", "rule": "", "example": ""}],
  "commands": {"build": "", "test": "", "lint": "", "dev": "", "format": "", "install": ""},
  "stack": {"languages": [], "frameworks": [], "packageManager": "npm|bun|pnpm|yarn|cargo|go"}
}
```

Save the analysis:
```bash
prjct analysis-save-llm '<your JSON here>' --md
```

### Next
| Command | Action |
|---|---|
| `prjct task --md` | Start new task |
| `prjct next --md` | View task queue |

---
prjct v1.50.2
```

---

## Command: prjct bug 'test bug description' --md

```
---

### Bug Reported
test bug description

| Metric | Value |
|---|---|
| Severity | medium |
| Priority | medium |

### Next
| Command | Action |
|---|---|
| `prjct task "fix: test bug description" --md` | Fix now |
| `prjct next --md` | View queue |

---
prjct v1.50.2
```

---

## Command: prjct idea 'test idea description' --md

```
---

### Idea Captured
test idea description

| Metric | Value |
|---|---|
| Mode | capture |

### Next
| Command | Action |
|---|---|
| `prjct task "test idea description" --md` | Start working on it |
| `prjct dash ideas` | View ideas |

---
prjct v1.50.2
```

---

## Command: prjct velocity --md

```

Sprint Velocity (last 6 sprints)
════════════════════════════════════════════════════════════
  Sprint  1: 15 pts | 31 tasks | accuracy: 84%
  Sprint  2: 11 pts | 6 tasks | accuracy: 17%
  Sprint  4: 11 pts | 11 tasks | accuracy: 0%

  Average: 12.3 pts/sprint | Trend: ↓ declining
  Estimation accuracy: 56% (±20% tolerance)

  Patterns:
    ✓ feature tasks estimated within 86%
    ✓ bug tasks estimated within 44%
════════════════════════════════════════════════════════════

```

---

## Command: prjct plan --md

```

✗ Unknown command: plan
  💡 Run 'prjct --help' to see available commands

```

