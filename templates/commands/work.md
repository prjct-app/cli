---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Show current task or start new one'
timestamp-rule: 'GetTimestamp() for all timestamps'
required-agent: auto-detect
enforce-agent: true
---

# /p:work

## Flow

**No params**: Show active task from `core/stack.jsonl`
**With task**: Start new (pause current if exists)
**With number**: Start task #N from `core/next.md`

### Starting Task
1. Check active → Pause if exists
2. Parse input → String or number
3. **ASSIGN AGENT** → Detect expertise, filter context (70-90% reduction)
4. Create entry → status='active', agent, filtered_context
5. Update → `core/stack.jsonl` + `core/now.md`
6. Log → Agent usage to memory

## Responses

**Active**: `🎯 {task} | {agent} | {duration}`
**Empty**: `💤 No active task | {paused_count} paused`
**Started**: `🚀 {task} | Agent: {agent}`
**Switched**: `⏸️ Paused {old} → Started {new}`

## Agent Detection
Keywords → Agent:
- UI/frontend/React → `fe`
- API/backend/database → `be`
- design/UX → `ux`
- test/QA/bug → `qa`
- docs/README → `docs`
- else → `general`

## Errors
**Active exists**: Show options (pause/done/switch)
**Invalid #**: Task not in queue
**Migration**: Replaces /p:now and /p:build