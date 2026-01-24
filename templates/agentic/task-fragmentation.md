# Task Fragmentation

Break complex multi-domain tasks into subtasks.

## When to Fragment

- Spans 3+ domains (frontend + backend + database)
- Has natural dependency order
- Too large for single execution

## When NOT to Fragment

- Single domain only
- Small, focused change
- Already atomic

## Dependency Order

1. **Database** (models first)
2. **Backend** (API using models)
3. **Frontend** (UI using API)
4. **Testing** (tests for all)
5. **DevOps** (deploy)

## Subtask Format

```json
{
  "subtasks": [{
    "id": "subtask-1",
    "description": "Create users table",
    "domain": "database",
    "agent": "database.md",
    "dependsOn": []
  }]
}
```

## Output

```
🎯 Task: {task}

📋 Subtasks:
├─ 1. [database] Create schema
├─ 2. [backend] Create API
└─ 3. [frontend] Create form
```

## Delegation

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    Read: {agentsPath}/{domain}.md
    Subtask: {description}
    Previous: {previousSummary}
    Focus ONLY on this subtask.
  '
)
```

## Progress

```
📊 Progress: 2/4 (50%)
✅ 1. [database] Done
✅ 2. [backend] Done
▶️ 3. [frontend] ← CURRENT
⏳ 4. [testing]
```

## Error Handling

```
❌ Subtask 2/4 failed

Options:
1. Retry
2. Skip and continue
3. Abort
```

## Anti-Patterns

- Over-fragmentation: 10 subtasks for "add button"
- Under-fragmentation: 1 subtask for "add auth system"
- Wrong order: Frontend before backend
