---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Resume paused task'
timestamp-rule: 'GetTimestamp() for resumed'
---

# /p:resume

## Check
- Requires paused tasks
- Blocks if active exists

## Flow
1. Select: last/ID/# → Set status='active', resumed={GetTimestamp()}
2. Update stack.jsonl + now.md → Log resume

## Response
`▶️ {task} | Paused: {duration} | {agent} | Done: /p:done`

## Examples

### Resume last paused
```
/p:resume
→ Resumes most recently paused task
→ Picks up exactly where you left off
```

### Resume specific task
```
/p:resume task-1234567890
→ Resumes task by ID
```

### Resume by number
```
/p:resume 2
→ Resumes 2nd task from paused list
→ Useful when shown list by /p:stack
```

## Stack Display Format

When multiple paused tasks exist:
```
⏸️  Paused tasks (3):

1. Fix login validation bug
   Paused 10m ago | Active time: 45m

2. Implement dark mode toggle
   Paused 2h ago | Active time: 1h 20m

3. Update documentation
   Paused yesterday | Active time: 30m

Resume: /p:resume {1-3}
```

## Natural Language Support

Detect intent for resume:
- "p. resume" → Resume last paused
- "p. continue" → Resume last paused
- "p. back to {task}" → Resume matching task
- "p. resume 2" → Resume task #2

## Error Handling

### No paused tasks
```
❌ No paused tasks to resume

See what's in queue:
→ /p:next

Start new task:
→ /p:work "{task}"
```

### Active task exists
```
❌ Already working on: {current_task}

Options:
→ /p:done (complete current)
→ /p:pause (pause current)
→ /p:switch {task_id} (atomic switch)
```

### Invalid task ID
```
❌ Task {id} not found or not paused

See paused tasks:
→ /p:stack
```