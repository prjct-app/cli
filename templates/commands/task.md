---
allowed-tools: [Read, Write, TodoWrite, Task, Glob]
description: 'Break down complex tasks'
---

# /p:task

## Agent Delegation (REQUIRED)

Before executing task, delegate to specialist agent:

1. **List agents**: `Glob("~/.prjct-cli/projects/{projectId}/agents/*.md")`
2. **Analyze task domain**: Match to agent expertise
3. **Delegate via Task tool**:

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent
    Read: ~/.prjct-cli/projects/{projectId}/agents/{agent}.md

    ## Task
    {task description}

    ## Flow
    1. Read agent file
    2. Apply expertise
    3. Execute task
  '
)
```

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
