---
allowed-tools: [Read, Write]
description: 'Manage current focus task'
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

1. Write: `core/now.md` with task + timestamp
2. Update: `core/context.md`, `progress/metrics.md`
3. Log: `memory/context.jsonl`

## Response

```
🎯 {task}
Started: {time}

Done? → /p:done
Stuck? → /p:stuck
```
