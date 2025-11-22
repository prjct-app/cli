---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Ship feature workflow'
timestamp-rule: 'GetTimestamp() and GetDate() for timestamps'
---

# /p:ship

## Workflow (non-blocking)
1. Lint → Tests → Docs update
2. Version bump → CHANGELOG
3. Commit + push (prjct footer)
4. Log: `progress/sessions/{YY-MM}/{DD}.jsonl`
5. Update: `progress/shipped.md` (30 days)
6. Recommend: compact

## Data
Session: `{"ts":"{GetTimestamp()}","type":"feature_ship","name":"{f}","agent":"{a}","version":"{v}"}`

Commit footer:
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

## Response
`🚀 {feature} | {agent} | {time} | v{version} | Next: compact`
