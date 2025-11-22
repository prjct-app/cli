---
allowed-tools: [Read, Write]
description: 'Complete task'
---

# /p:done

## Check
Requires: `core/now.md` has content

## Flow
1. Read `core/now.md` → calculate duration
2. Clear now.md → Update metrics → Log

## Response
`✅ {task} ({duration}) | Next: /p:now or /p:ship`
