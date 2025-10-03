---
allowed-tools: [Read, Write, TodoWrite]
description: "Break down complex tasks"
---

# /p:task

## Usage
```
/p:task <description>
```

## Flow
1. Analyze: task complexity
2. Break down: into 3-7 subtasks
3. Create: execution plan
4. Execute: each subtask with validation
5. Track: progress in `planning/tasks/`

## Response
```
📋 Task Plan: {description}

Breakdown:
1. {subtask} (~{time})
2. {subtask} (~{time})
3. {subtask} (~{time})

Est total: {total_time}

🚀 Starting execution...
[1/{N}] {subtask}... ✅
[2/{N}] {subtask}... 🔄
```

