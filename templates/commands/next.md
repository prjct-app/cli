---
allowed-tools: [Read]
description: 'Show priority queue'
---

# /p:next

## Flow
1. Check `core/now.md` → warn if active
2. Read `core/next.md` → top 5 non-blocked

## Response
**Active**: `⚠️ Active: {task} | Complete: /p:done`
**Queue**: Show 1-5 → `/p:work {N}`
