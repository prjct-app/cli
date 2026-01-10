---
name: prjct-sync
description: Analyze and sync project state. Use when user says "p. sync", wants to analyze the codebase, or needs to generate/update domain agents.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
user-invocable: true
---

# prjct Sync

Analyze codebase and sync project state with intelligent agent generation.

## Context Loading (ALWAYS FIRST)

```
1. Read `.prjct/prjct.config.json` → extract projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Read {globalPath}/project.json → project metadata
```

## Sync Workflow

### 1. Analyze Codebase

Use Task(Explore) to understand:
- Tech stack (languages, frameworks)
- Project structure (src/, lib/, etc.)
- Key patterns (API routes, components, etc.)
- Test coverage

### 2. Update Project Metadata

Write to `{globalPath}/project.json`:
```json
{
  "projectId": "...",
  "name": "project-name",
  "repoPath": "/path/to/repo",
  "techStack": ["typescript", "react", "node"],
  "fileCount": 150,
  "cliVersion": "0.28.0",
  "lastSync": "ISO timestamp"
}
```

### 3. Generate Domain Agents

Based on tech stack, create agents in `{globalPath}/agents/`:

| Agent | When to Generate |
|-------|------------------|
| `frontend.md` | React, Vue, Svelte, CSS |
| `backend.md` | Node, Express, APIs |
| `database.md` | SQL, MongoDB, Prisma |
| `testing.md` | Jest, Vitest, Playwright |
| `devops.md` | Docker, CI/CD, K8s |

Agent template:
```yaml
---
name: {agent-name}
description: {domain expertise}
tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# {Agent Name} Specialist

## Patterns Found
- {pattern 1}
- {pattern 2}

## Conventions
- {convention 1}
- {convention 2}
```

### 4. Sync Context Files

Regenerate `{globalPath}/context/`:
- `now.md` - Current task (if any)
- `next.md` - Queue summary
- `shipped.md` - Recently shipped

### 5. Log Event

Append to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp": "...", "action": "sync_completed", "agents": [...], "stats": {...}}
```

## Paths (CRITICAL)

| Type | Path | Access |
|------|------|--------|
| Config | `.prjct/prjct.config.json` | Read-only |
| Project | `{globalPath}/project.json` | Read-Write |
| Agents | `{globalPath}/agents/*.md` | Write |
| Context | `{globalPath}/context/*.md` | Write |
| Memory | `{globalPath}/memory/events.jsonl` | Append |

## Output Format

```
✅ Project synced

Files: {n} | Stack: {techs}
Agents: {list}
Next: p. task "start working"
```
