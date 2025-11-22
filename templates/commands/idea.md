---
allowed-tools: [Read, Write, GetTimestamp, GetDate]
description: 'Quick idea capture'
timestamp-rule: 'GetTimestamp() and GetDate() for timestamps'
---

# /p:idea

## Flow
1. Log: `planning/sessions/{YY-MM}/{DD}.jsonl`
   `{"ts":"{GetTimestamp()}","type":"idea_add","idea":"{text}"}`
2. Update: `planning/ideas.md` with {GetDate()}
3. If actionable → `core/next.md`

## Response
`💡 {idea} | Saved | Start: /p:feature "{idea}"`