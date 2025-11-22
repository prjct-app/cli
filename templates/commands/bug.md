---
allowed-tools: [Read, Write]
description: 'Report bug with auto-priority'
---

# /p:bug

## Severity Keywords
- **Critical**: crash, down, broken, production
- **High**: error, fail, issue
- **Medium**: bug, incorrect
- **Low**: minor, typo

## Flow
1. Detect severity → Format: `🐛 [LEVEL] {desc}`
2. Insert: top if critical/high, bottom if med/low
3. Update `core/next.md` + log

## Response
`🐛 {severity} | Queued #{position} | Start: /p:now`
