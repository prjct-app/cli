---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Start task'
timestamp-rule: 'GetTimestamp() for id and started'
---

# /p:build

## Check
Block if `core/now.md` active

## Flow
1. Parse task/# → Detect agent + complexity
2. Write now.md: id={GetTimestamp()}, agent, started={GetTimestamp()}

## Response
`🎯 {task} | {agent} | Est: {time} | Done: /p:done`
