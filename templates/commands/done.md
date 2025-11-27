---
allowed-tools: [Read, Write]
description: 'Complete task'
think-triggers: [report_complete]
---

# /p:done

## Think First
Before marking complete, verify:
1. Is the task actually finished?
2. Were all acceptance criteria met?
3. Should this trigger a /p:ship?

## Check
Requires: `core/now.md` has content

## Flow
1. Read `core/now.md` → calculate duration
2. Clear now.md → Update metrics → Log

## Response
`✅ {task} ({duration}) | Next: /p:now or /p:ship`
