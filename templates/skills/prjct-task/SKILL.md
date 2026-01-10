---
name: prjct-task
description: Start and manage development tasks. Use when user says "p. task", wants to start working on something, or mentions starting a feature/bug/improvement/refactor.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
user-invocable: true
---

# prjct Task Manager

Start and track development tasks with intelligent classification.

## Context Loading (ALWAYS FIRST)

```
1. Read `.prjct/prjct.config.json` → extract projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Read {globalPath}/storage/state.json → current state
4. Read {globalPath}/agents/*.md → domain expertise (if exists)
```

## Task Workflow

### 1. Classify Task Type
- **feature**: New functionality
- **bug**: Fix broken behavior
- **improvement**: Enhance existing feature
- **refactor**: Code restructure without behavior change
- **chore**: Maintenance, deps, config

### 2. Explore Codebase
Use Task(Explore) to:
- Find related code patterns
- Identify affected files
- Understand dependencies

### 3. Break Down (if complex)
Create subtasks with clear scope:
```json
{
  "subtasks": [
    { "id": "1", "title": "...", "status": "pending" }
  ]
}
```

### 4. Track in Storage
Write to `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "uuid",
    "title": "Task description",
    "type": "feature",
    "status": "in_progress",
    "subtasks": [...],
    "startedAt": "ISO timestamp"
  }
}
```

### 5. Generate Context
Write to `{globalPath}/context/now.md`:
```markdown
# Current Task
**{title}** ({type})
Started: {timestamp}
Subtasks: {completed}/{total}
```

### 6. Log Event
Append to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp": "...", "action": "task_started", "task": {...}}
```

## Paths (CRITICAL)

| Type | Path | Access |
|------|------|--------|
| Config | `.prjct/prjct.config.json` | Read-only |
| Storage | `{globalPath}/storage/*.json` | Read-Write |
| Context | `{globalPath}/context/*.md` | Read-Write |
| Memory | `{globalPath}/memory/events.jsonl` | Append-only |
| Agents | `{globalPath}/agents/*.md` | Read-only |

## Output Format

```
✅ Task started: {title}

Type: {type} | Subtasks: {n}
Next: {first subtask or suggested action}
```

## Git Commit Footer

When committing, ALWAYS include:
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```
