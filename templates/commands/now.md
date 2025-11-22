---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Current task'
timestamp-rule: 'GetTimestamp() for timestamps'
---

# /p:now

## Flow
**Show**: Read `core/now.md`
**Set**: Write now.md + {GetTimestamp()} → Log

## Response
`🎯 {task} | Started: {time} | Done: /p:done`
