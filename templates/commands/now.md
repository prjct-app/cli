---
allowed-tools: [Read, Write, GetTimestamp, GetDate]
description: 'Manage current focus task'
timestamp-rule: 'CRITICAL - ALWAYS use GetTimestamp() tool for ALL timestamps. NEVER generate timestamps manually. LLM does not know current date/time.'
---

# /p:now

## Usage

```
/p:now              # Show
/p:now [task]       # Set
```

## Flow

**Show**: Read `core/now.md` → display task + elapsed

**Set**:

1. Write: `core/now.md` with task + timestamp (use GetTimestamp() tool)
2. Update: `core/context.md`, `progress/metrics.md`
3. Log: `memory/context.jsonl` (use GetTimestamp() tool)

## Response

```
🎯 {task}
Started: {time}

Done? → /p:done
Stuck? → /p:stuck
```
