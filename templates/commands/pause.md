---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Pause task'
timestamp-rule: 'GetTimestamp() for paused'
---

# /p:pause

## Check
Requires active in `core/stack.jsonl`

## Flow
1. Find active → Set status='paused', paused={GetTimestamp()}
2. Update stack.jsonl + now.md
3. Log: `{"ts":"{GetTimestamp()}","type":"task_pause","task":"{t}"}`

## Response
`⏸️ {task} | Active: {duration} | Resume: /p:resume`