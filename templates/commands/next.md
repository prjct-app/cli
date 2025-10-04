---
allowed-tools: [Read]
description: 'Show priority queue (top 5 non-blocking)'
---

# /p:next

## Flow

1. Check: `core/now.md` → if active task, show warning
2. Read: `core/next.md` → filter blocked tasks
3. Return: top 5 actionable

## Response (active task)

```
⚠️  Active: {current_task}
Started: {time_ago}

Complete first: /p:done

📋 Queue preview:
{top_5_numbered}
```

## Response (no active)

```
📋 Priority Queue

{numbered_tasks_1_to_5}

/p:build {1-5} | /p:build "{task}"
```
