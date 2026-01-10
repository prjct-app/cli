---
name: prjct-done
description: Complete current task or subtask. Use when user says "p. done", "finished", "completed", or indicates they finished working on something.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, TodoWrite]
user-invocable: true
---

# prjct Done

Mark current task or subtask as complete and advance workflow.

## Context Loading (ALWAYS FIRST)

```
1. Read `.prjct/prjct.config.json` → extract projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Read {globalPath}/storage/state.json → current task
```

## Done Workflow

### 1. Check Current State

Read `{globalPath}/storage/state.json`:
- If no currentTask: "No active task. Use p. task to start one."
- If has subtasks: Check which is in_progress

### 2. Complete Subtask (if applicable)

If task has subtasks:
```json
{
  "subtasks": [
    { "id": "1", "status": "completed", "completedAt": "..." },
    { "id": "2", "status": "in_progress" },  // ← Mark complete, advance
    { "id": "3", "status": "pending" }        // ← Start this one
  ]
}
```

### 3. Complete Task (if no more subtasks)

When all subtasks done OR no subtasks:
```json
{
  "currentTask": null,
  "lastCompleted": {
    "id": "...",
    "title": "...",
    "completedAt": "ISO timestamp"
  }
}
```

### 4. Update Context

Write to `{globalPath}/context/now.md`:
- If more subtasks: Show next subtask
- If task complete: Show completion + suggest next

### 5. Log Event

Append to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp": "...", "action": "subtask_completed", "subtask": {...}}
```
or
```json
{"timestamp": "...", "action": "task_completed", "task": {...}}
```

## Paths (CRITICAL)

| Type | Path | Access |
|------|------|--------|
| Config | `.prjct/prjct.config.json` | Read-only |
| Storage | `{globalPath}/storage/state.json` | Read-Write |
| Context | `{globalPath}/context/now.md` | Write |
| Memory | `{globalPath}/memory/events.jsonl` | Append |

## Output Format

**Subtask completed:**
```
✅ Subtask completed: {title}

Progress: {completed}/{total}
Next: {next subtask title}
```

**Task completed:**
```
✅ Task completed: {title}

Duration: {time}
Next: p. ship "{feature}" or p. task "next thing"
```
