---
allowed-tools: [Read]
description: "Get unstuck"
---

# /p:stuck

## Usage
```
/p:stuck <issue>
```

## Flow
1. Detect: issue type (bug/design/perf/feature)
2. Check: context from analysis + memory
3. Provide: type-specific guidance
4. Suggest: breakdown + next actions
5. Log: `memory/context.jsonl`

## Guidance by Type
- **Bug**: 🔍 Check logs → Isolate → Search error
- **Design**: 🎨 Define requirements → Start simple → Ship MVP
- **Performance**: ⚡ Profile first → Fix slowest → Cache ops
- **Default**: 💡 Break into tasks → Start smallest → Ship it

## Response
```
💡 {type_guidance}

Let's break it down:
1. {subtask} (~{time})
2. {subtask} (~{time})

/p:now "{first}" | /p:task
```

